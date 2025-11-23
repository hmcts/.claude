#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const transcriptDir = path.join(__dirname, '-workspaces-cath-service');

/**
 * Extract ticket ID from branch name (e.g., "feature/VIBE-123-description" -> "VIBE-123")
 */
function extractTicketFromBranch(branch) {
  if (!branch) return null;
  const match = branch.match(/VIBE-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Process a single transcript file and attribute tokens per-turn
 */
async function processTranscript(file) {
  const filePath = path.join(transcriptDir, file);
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let sessionId = null;
  let firstTimestamp = null;
  let currentBranch = null;
  let currentTicketFromBranch = null;
  let currentTicketFromWorkflow = null;
  let turnNumber = 0;

  const tokensByTicket = {};
  const details = [];

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);

      // Capture session metadata
      if (!sessionId && data.sessionId) {
        sessionId = data.sessionId;
      }

      if (data.timestamp && !firstTimestamp) {
        firstTimestamp = data.timestamp;
      }

      // Track turn increments
      if (data.type === "user") {
        turnNumber++;
      }

      // Track branch updates and extract ticket from branch
      if (data.gitBranch) {
        currentBranch = data.gitBranch;
        currentTicketFromBranch = extractTicketFromBranch(data.gitBranch);
      }

      // Check for workflow command override (persists until changed)
      if (data.message && data.message.content) {
        let content = '';
        if (typeof data.message.content === 'string') {
          content = data.message.content;
        } else if (Array.isArray(data.message.content)) {
          content = JSON.stringify(data.message.content);
        }

        const argsMatch = content.match(/<command-args>([^<]+)<\/command-args>/);
        if (argsMatch && argsMatch[1].startsWith('VIBE-')) {
          currentTicketFromWorkflow = argsMatch[1];
        }
      }

      // Determine current ticket: workflow command overrides branch extraction
      const currentTicket = currentTicketFromWorkflow || currentTicketFromBranch || 'UNATTRIBUTED';

      // Attribute output tokens to current ticket when assistant responds
      if (data.type === "assistant" && data.message && data.message.usage) {
        const usage = data.message.usage;
        const outputTokens = usage.output_tokens || 0;

        if (outputTokens > 0) {
          if (!tokensByTicket[currentTicket]) {
            tokensByTicket[currentTicket] = 0;
          }
          tokensByTicket[currentTicket] += outputTokens;

          details.push({
            turn: turnNumber,
            ticket: currentTicket,
            branch: currentBranch,
            outputTokens,
            source: currentTicketFromWorkflow ? 'workflow' : (currentTicketFromBranch ? 'branch' : 'none'),
            timestamp: data.timestamp
          });
        }
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  return {
    sessionId,
    firstTimestamp,
    tokensByTicket,
    details
  };
}

/**
 * Main execution
 */
async function main() {
  const files = fs.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

  console.log('='.repeat(80));
  console.log('TOKEN ATTRIBUTION BY TICKET (PER-TURN TRACKING)');
  console.log('='.repeat(80));
  console.log();

  // Process all transcripts
  const allResults = [];
  for (const file of files) {
    const result = await processTranscript(file);
    allResults.push(result);
  }

  console.log(`Sessions Analyzed: ${allResults.length}`);
  console.log();
  console.log('-'.repeat(80));

  // Global ticket totals
  const globalTicketTotals = {};

  // Show per-session breakdown
  allResults.forEach(result => {
    const date = new Date(result.firstTimestamp).toISOString().split('T')[0];
    const totalTokens = Object.values(result.tokensByTicket).reduce((sum, t) => sum + t, 0);

    console.log(`Session: ${result.sessionId}`);
    console.log(`  Date: ${date}`);
    console.log(`  Total output tokens: ${totalTokens.toLocaleString()}`);
    console.log(`  Tickets:`);

    Object.entries(result.tokensByTicket)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ticket, tokens]) => {
        console.log(`    ${ticket.padEnd(20)} ${tokens.toLocaleString().padStart(10)} tokens`);

        // Add to global totals
        if (!globalTicketTotals[ticket]) {
          globalTicketTotals[ticket] = 0;
        }
        globalTicketTotals[ticket] += tokens;
      });

    console.log();
  });

  console.log('='.repeat(80));
  console.log('TOTAL OUTPUT TOKENS BY TICKET (NOV 12-14):');
  console.log('-'.repeat(80));

  const sortedTickets = Object.entries(globalTicketTotals)
    .filter(([ticket]) => ticket !== 'UNATTRIBUTED')
    .sort((a, b) => b[1] - a[1]);

  sortedTickets.forEach(([ticket, tokens]) => {
    console.log(`${ticket.padEnd(20)} ${tokens.toLocaleString().padStart(15)} output tokens`);
  });

  if (globalTicketTotals['UNATTRIBUTED']) {
    console.log();
    console.log(`${'UNATTRIBUTED'.padEnd(20)} ${globalTicketTotals['UNATTRIBUTED'].toLocaleString().padStart(15)} output tokens`);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY:');
  console.log('-'.repeat(80));

  const totalAttributed = sortedTickets.reduce((sum, [_, tokens]) => sum + tokens, 0);
  const totalUnattributed = globalTicketTotals['UNATTRIBUTED'] || 0;
  const grandTotal = totalAttributed + totalUnattributed;

  console.log(`Total attributed:   ${totalAttributed.toLocaleString().padStart(15)} (${((totalAttributed / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`Total unattributed: ${totalUnattributed.toLocaleString().padStart(15)} (${((totalUnattributed / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`Grand total:        ${grandTotal.toLocaleString().padStart(15)}`);

  console.log();
  console.log('ATTRIBUTION METHOD:');
  console.log('  ✓ Per-turn tracking enabled');
  console.log('  ✓ Workflow commands (/expressjs-monorepo:*) used as primary source');
  console.log('  ✓ Git branch extraction as fallback');
  console.log('  ✓ Workflow command persists until changed');

  console.log();
  console.log('CONFIDENCE LEVEL:');
  const unattributedRate = (totalUnattributed / grandTotal) * 100;
  if (unattributedRate < 5) {
    console.log('  ✅ HIGH (>95% attributed)');
  } else if (unattributedRate < 15) {
    console.log('  ⚠️  MEDIUM (85-95% attributed)');
  } else {
    console.log('  ❌ LOW (<85% attributed)');
  }
  console.log(`  Unattributed work was done on 'master' branch without workflow commands`);

  console.log('='.repeat(80));

  // Generate JSON output for programmatic use
  const output = {
    sessions: allResults.length,
    tickets: sortedTickets.map(([ticket, tokens]) => ({ ticket, tokens })),
    unattributed: totalUnattributed,
    total: grandTotal,
    attributionRate: ((totalAttributed / grandTotal) * 100).toFixed(1)
  };

  fs.writeFileSync(
    path.join(__dirname, 'tokens_per_ticket.json'),
    JSON.stringify(output, null, 2)
  );

  console.log();
  console.log(`✓ JSON output saved to: tokens_per_ticket.json`);
}

main().catch(console.error);
