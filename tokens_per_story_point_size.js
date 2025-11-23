#!/usr/bin/env node

/**
 * Analyze token usage by story point size
 * Shows: 1 SP tickets use X tokens, 2 SP tickets use Y tokens, etc.
 *
 * Usage:
 *   node tokens_per_story_point_size.js
 *   node tokens_per_story_point_size.js --weeks '[{...}]' --json-output ticket_token_data.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}
loadEnv();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  REPO: 'hmcts/cath-service',
  JIRA_TOKEN: process.env.JIRA_TOKEN,
  SESSIONS_FILE: 'sessions.csv',
  COSTS_FILE: 'costs.csv'
};

// Parse command line arguments
const args = process.argv.slice(2);
let WEEKS = null;
let JSON_OUTPUT = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--weeks' && args[i + 1]) {
    WEEKS = JSON.parse(args[i + 1]);
    i++;
  } else if (args[i] === '--json-output' && args[i + 1]) {
    JSON_OUTPUT = args[i + 1];
    i++;
  }
}

// Use dedicated analytics folder separate from plugin's auto-generated data
const ANALYTICS_DIR = path.join(__dirname, 'analytics 4');

if (!fs.existsSync(ANALYTICS_DIR)) {
  console.error('❌ Analytics directory not found:', ANALYTICS_DIR);
  process.exit(1);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract JIRA ticket ID from text
 */
function extractJiraTicket(text) {
  if (!text) return null;
  const match = text.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Load sessions from analytics CSV
 */
function loadSessions() {
  const filePath = path.join(ANALYTICS_DIR, CONFIG.SESSIONS_FILE);
  if (!fs.existsSync(filePath)) {
    console.error('❌ sessions.csv not found');
    return [];
  }

  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.trim().split('\n');

  // Skip header
  const sessions = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('session_id')) continue; // Skip header duplicates

    const parts = line.split(',');
    if (parts.length < 8) continue;

    const sessionId = parts[0];
    const startedAt = parseInt(parts[6]);
    const endedAt = parseInt(parts[7]);

    // Deduplicate by session_id
    if (seen.has(sessionId)) continue;
    seen.add(sessionId);

    sessions.push({
      sessionId,
      userId: parts[1],
      branch: parts[4],
      startedAt,
      endedAt
    });
  }

  return sessions;
}

/**
 * Load costs from analytics CSV and sum tokens per session
 */
function loadCosts() {
  const filePath = path.join(ANALYTICS_DIR, CONFIG.COSTS_FILE);
  if (!fs.existsSync(filePath)) {
    console.error('❌ costs.csv not found');
    return [];
  }

  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.trim().split('\n');

  // Group tokens by session (costs.csv has per-turn data)
  const sessionTotals = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('session_id')) continue; // Skip header duplicates

    const parts = line.split(',');
    if (parts.length < 8) continue;

    const sessionId = parts[0];
    const totalTokens = parseInt(parts[7]); // total_tokens column

    if (!sessionTotals.has(sessionId)) {
      sessionTotals.set(sessionId, 0);
    }
    sessionTotals.set(sessionId, sessionTotals.get(sessionId) + totalTokens);
  }

  // Convert to array
  const costs = [];
  for (const [sessionId, totalTokens] of sessionTotals) {
    costs.push({
      sessionId,
      totalTokens
    });
  }

  return costs;
}

/**
 * Get PRs with ticket info and timestamps
 */
function getPRs() {
  console.log('Fetching PRs from GitHub...');
  const prListJson = execSync(
    `gh pr list --repo ${CONFIG.REPO} --limit 100 --state merged --json number,title,body,createdAt,mergedAt,headRefName,author`,
    { encoding: 'utf8' }
  );

  return JSON.parse(prListJson);
}

/**
 * Fetch story points for a ticket from JIRA
 */
function getStoryPoints(ticketId) {
  try {
    const url = `https://tools.hmcts.net/jira/rest/api/2/issue/${ticketId}?fields=customfield_10004`;
    const response = execSync(
      `curl -s -H "Authorization: Bearer ${CONFIG.JIRA_TOKEN}" "${url}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    const data = JSON.parse(response);
    return data.fields?.customfield_10004 || null;
  } catch (error) {
    console.error(`  Warning: Could not fetch ${ticketId}`);
    return null;
  }
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

console.log('='.repeat(80));
console.log('TOKENS PER STORY POINT SIZE ANALYSIS');
console.log('='.repeat(80));
console.log();

// Load analytics data
console.log('Loading analytics data...');
const sessions = loadSessions();
const costs = loadCosts();
console.log(`✓ Loaded ${sessions.length} sessions and ${costs.length} cost entries`);
console.log();

// Create session -> tokens map
const sessionTokens = new Map();
costs.forEach(c => {
  sessionTokens.set(c.sessionId, c.totalTokens);
});

// Get all merged PRs
const allPRs = getPRs();

// Determine analytics date range from sessions
const sessionTimestamps = sessions.map(s => s.startedAt).filter(t => !isNaN(t) && t > 0);
const analyticsStart = sessionTimestamps.length > 0 ? Math.min(...sessionTimestamps) : 0;
const analyticsEnd = sessionTimestamps.length > 0 ? Math.max(...sessionTimestamps) : Date.now();

if (sessionTimestamps.length > 0) {
  console.log(`Analytics period: ${new Date(analyticsStart).toISOString()} to ${new Date(analyticsEnd).toISOString()}`);
} else {
  console.log('Analytics period: No valid sessions found');
}

// Use all merged PRs (getPRs already filters to merged state)
// No filtering by author - whoever has sessions in the CSV is the developer
const prs = allPRs;

console.log(`✓ Fetched ${allPRs.length} total merged PRs`);
console.log();

// For each PR, estimate tokens used
console.log('Analyzing tokens per ticket...');
const ticketData = []; // [{ticket, sp, tokens, prNumber, title}]
const missingBranches = []; // PRs without analytics data

for (const pr of prs) {
  const ticketId = extractJiraTicket(pr.title) || extractJiraTicket(pr.body);
  if (!ticketId) continue;

  // Find sessions by matching git branch
  const prBranch = pr.headRefName;
  const prSessions = sessions.filter(s => {
    return s.branch === prBranch;
  });

  // Sum tokens from those sessions
  let totalTokens = 0;
  prSessions.forEach(s => {
    const tokens = sessionTokens.get(s.sessionId);
    if (tokens) totalTokens += tokens;
  });

  // Get story points from JIRA
  const sp = getStoryPoints(ticketId);

  if (sp) {
    if (totalTokens > 0) {
      // Determine which week this PR belongs to (based on creation date)
      let week = null;
      if (WEEKS) {
        const createdAt = new Date(pr.createdAt).getTime();
        const foundWeek = WEEKS.find(w => {
          const weekStart = new Date(w.start).getTime();
          const weekEnd = new Date(w.end).getTime() + (24 * 60 * 60 * 1000) - 1;
          return createdAt >= weekStart && createdAt <= weekEnd;
        });
        week = foundWeek ? foundWeek.name : null;
      }

      ticketData.push({
        ticket: ticketId,
        sp,
        tokens: totalTokens,
        prNumber: pr.number,
        title: pr.title.substring(0, 60),
        branch: prBranch,
        mergedAt: pr.mergedAt,
        createdAt: pr.createdAt,
        week: week
      });
    } else {
      missingBranches.push({
        ticket: ticketId,
        sp,
        prNumber: pr.number,
        title: pr.title.substring(0, 60),
        branch: prBranch
      });
    }
  }

  // Rate limiting
  execSync('sleep 0.1');
}

console.log(`✓ Analyzed ${ticketData.length} tickets with story points and token data`);
console.log();

// Group by story point value
const spGroups = {};
ticketData.forEach(t => {
  if (!spGroups[t.sp]) {
    spGroups[t.sp] = [];
  }
  spGroups[t.sp].push(t);
});

// Calculate averages
console.log('='.repeat(80));
console.log('TOKENS PER STORY POINT SIZE');
console.log('='.repeat(80));
console.log();

const spValues = Object.keys(spGroups).map(Number).sort((a, b) => a - b);

spValues.forEach(sp => {
  const tickets = spGroups[sp];
  const totalTokens = tickets.reduce((sum, t) => sum + t.tokens, 0);
  const avgTokens = Math.round(totalTokens / tickets.length);
  const minTokens = Math.min(...tickets.map(t => t.tokens));
  const maxTokens = Math.max(...tickets.map(t => t.tokens));

  console.log(`${sp} SP tickets: ${avgTokens.toLocaleString()} tokens/ticket (avg)`);
  console.log(`  Count: ${tickets.length} tickets`);
  console.log(`  Range: ${minTokens.toLocaleString()} - ${maxTokens.toLocaleString()} tokens`);
  console.log(`  Total: ${totalTokens.toLocaleString()} tokens`);
  console.log();

  console.log(`  Tickets:`);
  tickets.forEach(t => {
    console.log(`    ${t.ticket} (PR #${t.prNumber}): ${t.tokens.toLocaleString()} tokens - ${t.title}`);
  });
  console.log();
});

// Calculate overall stats
console.log('='.repeat(80));
console.log('SUMMARY STATISTICS');
console.log('='.repeat(80));
console.log();

const allTokens = ticketData.map(t => t.tokens);
const allSP = ticketData.map(t => t.sp);
const totalTokens = allTokens.reduce((a, b) => a + b, 0);
const totalSP = allSP.reduce((a, b) => a + b, 0);

console.log(`Total tickets analyzed: ${ticketData.length}`);
console.log(`Total story points: ${totalSP} SP`);
console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
console.log(`Overall average: ${Math.round(totalTokens / totalSP).toLocaleString()} tokens/SP`);
console.log();

// Check for linear relationship
console.log('Linearity Check:');
console.log('If relationship is linear, 2 SP ≈ 2x tokens of 1 SP');
console.log();

spValues.forEach(sp => {
  const tickets = spGroups[sp];
  const avgTokens = Math.round(tickets.reduce((sum, t) => sum + t.tokens, 0) / tickets.length);
  const tokensPerSP = Math.round(avgTokens / sp);
  console.log(`  ${sp} SP: ${tokensPerSP.toLocaleString()} tokens per story point`);
});
console.log();

// Report on PRs without analytics data
if (missingBranches.length > 0) {
  console.log('='.repeat(80));
  console.log('TICKETS WITHOUT ANALYTICS DATA');
  console.log('='.repeat(80));
  console.log();
  console.log(`${missingBranches.length} tickets have story points but no Claude Code sessions found`);
  console.log();

  missingBranches.forEach(t => {
    console.log(`${t.ticket} (${t.sp} SP) - PR #${t.prNumber}`);
    console.log(`  Branch: ${t.branch}`);
    console.log(`  Title: ${t.title}`);
    console.log();
  });

  console.log('Possible reasons:');
  console.log('  - Work done without Claude Code');
  console.log('  - Analytics not captured for that time period');
  console.log('  - Branch name mismatch between PR and sessions');
  console.log();
}

// Output JSON if requested
if (JSON_OUTPUT) {
  const outputPath = path.join(__dirname, JSON_OUTPUT);
  fs.writeFileSync(outputPath, JSON.stringify(ticketData, null, 2));
  console.log(`✓ Saved JSON output to: ${outputPath}`);
  console.log();
}

console.log('='.repeat(80));
console.log('DONE!');
console.log('='.repeat(80));
