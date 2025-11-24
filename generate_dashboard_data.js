#!/usr/bin/env node

/**
 * Dashboard Data Generator
 * Runs all metric collection scripts and updates weekly_metrics_plot.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { analyzePromptCategories } = require('./prompt_categories_analysis.js');

// Week definitions
const WEEKS = [
  { name: 'Week 1', start: '2025-10-07', end: '2025-10-10', period: 'Oct 7-10' },   // Tue-Fri
  { name: 'Week 2', start: '2025-10-13', end: '2025-10-17', period: 'Oct 13-17' },  // Mon-Fri
  { name: 'Week 3', start: '2025-10-20', end: '2025-10-24', period: 'Oct 20-24' },  // Mon-Fri
  { name: 'Week 4', start: '2025-10-27', end: '2025-10-31', period: 'Oct 27-31' },  // Mon-Fri
  { name: 'Week 5', start: '2025-11-03', end: '2025-11-07', period: 'Nov 3-7' },    // Mon-Fri
  { name: 'Week 6', start: '2025-11-10', end: '2025-11-14', period: 'Nov 10-14' }   // Mon-Fri
];

const ANALYTICS_DIR = path.join(__dirname, 'analytics-merged');

// Load analytics CSVs if they exist
let sessions = [];
let costs = [];
let compactions = [];
let analyticsAvailable = false;
let compactionsAvailable = false;

try {
  console.log('Loading analytics data...');

  const sessionsCsv = fs.readFileSync(path.join(ANALYTICS_DIR, 'sessions.csv'), 'utf8');
  const sessionsLines = sessionsCsv.trim().split('\n');

  // Track unique sessions to avoid duplicates
  const seenSessions = new Set();

  for (let i = 1; i < sessionsLines.length; i++) {
    const line = sessionsLines[i].trim();
    if (!line) continue;

    // Skip duplicate header rows (check for both old and new schema)
    if (line.startsWith('session_id,agent_id,') || line.startsWith('session_id,user_id,')) continue;

    const cols = line.split(',');

    // NEW SCHEMA: session_id,agent_id,user_id,repo_url,repo_name,branch,head_commit,started_at,ended_at,turn_count,total_cost_usd,interrupted_turns
    // Detect schema by checking if cols[1] looks like agent_id (starts with 'agent_')
    const hasAgentId = cols[1] && cols[1].startsWith('agent_');

    let sessionId, branch, startedAt, endedAt, turns, cost, interruptedTurns;

    if (hasAgentId) {
      // NEW SCHEMA with agent_id
      sessionId = cols[0];
      branch = cols[5];
      startedAt = parseInt(cols[7]);
      endedAt = parseInt(cols[8]);
      turns = parseInt(cols[9]);
      cost = parseFloat(cols[10]);
      interruptedTurns = parseInt(cols[11]) || 0;
    } else {
      // OLD SCHEMA without agent_id (for backwards compatibility)
      sessionId = cols[0];
      branch = cols[4];
      startedAt = parseInt(cols[6]);
      endedAt = parseInt(cols[7]);
      turns = parseInt(cols[8]);
      cost = parseFloat(cols[9]);
      interruptedTurns = parseInt(cols[10]) || 0;
    }

    // Create unique key to detect duplicates
    // Multiple sessions can have same ID, so we need branch + timestamps
    const uniqueKey = `${sessionId}_${branch}_${startedAt}_${endedAt}`;

    // Skip if we've already seen this session
    if (seenSessions.has(uniqueKey)) continue;

    seenSessions.add(uniqueKey);
    sessions.push({
      sessionId: sessionId,
      branch: branch,
      startedAt: startedAt,
      endedAt: endedAt,
      turns: turns,
      cost: cost,
      interruptedTurns: interruptedTurns
    });
  }

  const costsCsv = fs.readFileSync(path.join(ANALYTICS_DIR, 'costs.csv'), 'utf8');
  const costsLines = costsCsv.trim().split('\n');

  // Track unique costs to avoid duplicates
  const seenCosts = new Set();

  for (let i = 1; i < costsLines.length; i++) {
    const line = costsLines[i].trim();
    if (!line) continue;

    // Skip duplicate header rows (check for both old and new schema)
    if (line.startsWith('session_id,agent_id,') || line.startsWith('session_id,user_id,')) continue;

    const cols = line.split(',');

    // NEW SCHEMA: session_id,agent_id,user_id,turn_number,message_id,model,branch,ticket_id,input_tokens,output_tokens,total_tokens,...
    // Detect schema by checking if cols[1] looks like agent_id (starts with 'agent_')
    const hasAgentId = cols[1] && cols[1].startsWith('agent_');

    let sessionId, turnNumber, messageId, totalTokens;

    if (hasAgentId) {
      // NEW SCHEMA with agent_id
      sessionId = cols[0];
      turnNumber = cols[3];
      messageId = cols[4];
      totalTokens = parseInt(cols[10]) || 0; // total_tokens is now at index 10
    } else {
      // OLD SCHEMA without agent_id (for backwards compatibility)
      sessionId = cols[0];
      turnNumber = cols[2];
      messageId = cols[3];
      totalTokens = parseInt(cols[9]) || 0; // total_tokens was at index 9
    }

    // Create unique key: session_id + turn_number + message_id
    const uniqueKey = `${sessionId}_${turnNumber}_${messageId}`;

    // Skip if we've already seen this cost entry
    if (seenCosts.has(uniqueKey)) continue;

    seenCosts.add(uniqueKey);
    costs.push({
      sessionId: sessionId,
      totalTokens: totalTokens
    });
  }

  analyticsAvailable = true;
  console.log(`✓ Loaded ${sessions.length} sessions and ${costs.length} cost entries`);

  // Load compactions data for time to context window
  try {
    const compactionsCsv = fs.readFileSync(path.join(ANALYTICS_DIR, 'compactions.csv'), 'utf8');
    const compactionsLines = compactionsCsv.trim().split('\n');

    if (compactionsLines.length > 1) {
      const headers = compactionsLines[0].split(',');
      const seenCompactions = new Set();

      for (let i = 1; i < compactionsLines.length; i++) {
        const line = compactionsLines[i].trim();
        if (!line) continue;
        const cols = line.split(',');

        const row = {};
        headers.forEach((header, index) => {
          row[header] = cols[index];
        });

        // Create unique key to detect duplicates (session_id + timestamp within 10ms)
        const timestamp = parseInt(row.timestamp);
        const roundedTimestamp = Math.floor(timestamp / 10) * 10; // Round to nearest 10ms
        const uniqueKey = `${row.session_id}_${roundedTimestamp}`;

        // Skip if we've already seen this compaction
        if (seenCompactions.has(uniqueKey)) continue;

        seenCompactions.add(uniqueKey);
        compactions.push(row);
      }

      compactionsAvailable = true;
      console.log(`✓ Loaded ${compactions.length} compaction entries`);
    }
  } catch (error) {
    console.log('⚠ Compactions CSV not found - time to context window metrics will be null');
  }
} catch (error) {
  console.log('⚠ Analytics CSVs not found - token/cost metrics will be null');
}

const weeklyData = [];

console.log('='.repeat(80));
console.log('GENERATING DASHBOARD DATA');
console.log('='.repeat(80));
console.log();

for (const week of WEEKS) {
  console.log(`Processing ${week.name} (${week.period})...`);

  const metrics = {
    week: week.name,
    period: week.period,
    featurePRs: null,
    locPerPR: null,
    locPerDev: null,
    locPerToken: null,
    commentsPerPR: null,
    testCoverage: null,
    cves: null,
    duplicatedLines: null,
    maintainability: null,
    reliability: null,
    security: null,
    codeSmells: null,
    nkt: null,
    cycleTime: null,
    tokensPerSP: null,
    costPerLOC: null,
    costPerPR: null,
    costPerSP: null,
    storyPoints: null,
    wipSP: null,
    totalCost: null,
    timeToContextWindow: null,
    autoCompactions: null,
    manualCompactions: null,
    note: ''
  };

  // Run comprehensive_pr_metrics.js for this week
  console.log(`  Running comprehensive_pr_metrics.js...`);
  try {
    const cmd = `node comprehensive_pr_metrics.js --start "${week.start}" --end "${week.end}" 2>&1`;
    const output = execSync(cmd, { encoding: 'utf8', cwd: __dirname });

    // Parse output for metrics
    const prCountMatch = output.match(/Feature PRs analyzed:\s+(\d+)/);
    const locPerPRMatch = output.match(/Average LOC per PR:\s+([\d,]+)/);
    const totalLocMatch = output.match(/Total Lines Changed:\s+([\d,]+)/);
    const commentsMatch = output.match(/Average Developer Comments per PR:\s+([\d.]+)/);
    const coverageMatch = output.match(/Test Coverage:\s+Average:\s+([\d.]+)%/);
    const cveMatch = output.match(/CVEs \(Vulnerabilities\):\s+Average:\s+([\d.]+)/);
    const dupMatch = output.match(/Duplicated Lines:\s+Average:\s+([\d.]+)%/);
    const maintMatch = output.match(/Maintainability Rating:\s+Average:\s+([\d.]+)/);
    const reliMatch = output.match(/Reliability Rating:\s+Average:\s+([\d.]+)/);
    const secMatch = output.match(/Security Rating:\s+Average:\s+([\d.]+)/);
    const smellsMatch = output.match(/Code Smells:\s+([\d.]+)\s+average/);
    const spMatch = output.match(/Total Story Points.*?:\s+([\d.]+)/);
    const wipMatch = output.match(/WIP.*?Story Points.*?:\s+([\d.]+)/);

    // Parse COST metrics from bedrock-costs.csv (via comprehensive_pr_metrics.js)
    const totalCostMatch = output.match(/AWS Bedrock total cost:\s+\$([\d.]+)/);
    const costPerSPMatch = output.match(/Cost per Story Point:\s+\$([\d.]+)/);
    const costPerPRMatch = output.match(/Cost per PR:\s+\$([\d.]+)/);
    const costPerLOCMatch = output.match(/Cost per LOC:\s+\$([\d.]+)/);

    if (prCountMatch) metrics.featurePRs = parseInt(prCountMatch[1]);
    if (locPerPRMatch) metrics.locPerPR = parseInt(locPerPRMatch[1].replace(/,/g, ''));
    if (totalLocMatch) metrics.totalLOC = parseInt(totalLocMatch[1].replace(/,/g, ''));
    if (commentsMatch) metrics.commentsPerPR = parseFloat(commentsMatch[1]);
    if (coverageMatch) metrics.testCoverage = parseFloat(coverageMatch[1]);
    if (cveMatch) metrics.cves = parseFloat(cveMatch[1]);
    if (dupMatch) metrics.duplicatedLines = parseFloat(dupMatch[1]);
    if (maintMatch) metrics.maintainability = parseFloat(maintMatch[1]);
    if (reliMatch) metrics.reliability = parseFloat(reliMatch[1]);
    if (secMatch) metrics.security = parseFloat(secMatch[1]);
    if (smellsMatch) metrics.codeSmells = parseFloat(smellsMatch[1]);
    if (spMatch) metrics.storyPoints = parseFloat(spMatch[1]);
    if (wipMatch) metrics.wipSP = parseFloat(wipMatch[1]);

    // Cost metrics from bedrock CSV
    if (totalCostMatch) metrics.totalCost = parseFloat(totalCostMatch[1]);
    if (costPerSPMatch) metrics.costPerSP = parseFloat(costPerSPMatch[1]);
    if (costPerPRMatch) metrics.costPerPR = parseFloat(costPerPRMatch[1]);
    if (costPerLOCMatch) metrics.costPerLOC = parseFloat(costPerLOCMatch[1]);
  } catch (error) {
    console.log(`  Error running comprehensive_pr_metrics: ${error.message}`);
  }

  // Run nkt_metrics.js for this week
  console.log(`  Running nkt_metrics.js...`);
  try {
    const cmd = `node nkt_metrics.js --start "${week.start}" --end "${week.end}" 2>&1`;
    const output = execSync(cmd, { encoding: 'utf8', cwd: __dirname });

    const nktMatch = output.match(/=\s+([\d.]+)\s+files per day/);
    const cycleMatch = output.match(/Average cycle time:\s+([\d.]+)\s+days/);

    if (nktMatch) metrics.nkt = parseFloat(nktMatch[1]);
    if (cycleMatch) metrics.cycleTime = parseFloat(cycleMatch[1]);
  } catch (error) {
    console.log(`  Error running nkt_metrics: ${error.message}`);
  }

  // Calculate TOKEN metrics only from analytics CSVs (costs come from bedrock-costs.csv via comprehensive_pr_metrics.js)
  if (analyticsAvailable) {
    console.log(`  Calculating token metrics from analytics...`);

    const weekStart = new Date(week.start).getTime();
    const weekEnd = new Date(week.end).getTime() + (24 * 60 * 60 * 1000) - 1; // End of day

    // Get sessions for this week
    const weekSessions = sessions.filter(s => {
      return s.startedAt >= weekStart && s.startedAt <= weekEnd;
    });

    // Get total tokens for this week (NOT cost - that comes from bedrock CSV)
    const sessionIds = new Set(weekSessions.map(s => s.sessionId));
    let totalTokens = 0;

    costs.forEach(cost => {
      if (sessionIds.has(cost.sessionId)) {
        totalTokens += cost.totalTokens;
      }
    });

    // Calculate NEW token-based metrics only
    if (totalTokens > 0) {
      // Tokens per story point
      if (metrics.storyPoints && metrics.storyPoints > 0) {
        metrics.tokensPerSP = Math.round(totalTokens / metrics.storyPoints);
      }

      // LOC per token
      if (metrics.totalLOC && metrics.totalLOC > 0) {
        metrics.locPerToken = (metrics.totalLOC / totalTokens).toFixed(4);
      }

      // Tokens per time to pass PR = (tokens per PR) / cycle time
      if (metrics.cycleTime && metrics.cycleTime > 0 && metrics.featurePRs && metrics.featurePRs > 0) {
        const tokensPerPR = totalTokens / metrics.featurePRs;
        metrics.tokensPerCycleTime = Math.round(tokensPerPR / metrics.cycleTime);
      }
    }

    console.log(`  ✓ Tokens: ${totalTokens.toLocaleString()}`);

    // Calculate TIME TO CONTEXT WINDOW metrics
    if (compactionsAvailable && compactions.length > 0) {
      console.log(`  Calculating time to context window metrics...`);

      // Calculate time to context window for sessions in this week
      const timeToContextWindow = [];
      let autoCompactions = 0;
      let manualCompactions = 0;

      // For each session in this week, find its compactions
      weekSessions.forEach(session => {
        const sessionStartTime = session.startedAt;
        const sessionEndTime = session.endedAt;

        // Find all compactions for this specific session that occurred during the session
        const sessionCompactions = compactions.filter(compaction => {
          if (compaction.session_id !== session.sessionId) return false;

          const compactionTime = parseInt(compaction.timestamp);
          // Compaction must occur between session start and end (or shortly after)
          return compactionTime >= sessionStartTime && compactionTime <= sessionEndTime + (60 * 60 * 1000); // within 1 hour of session end
        });

        if (sessionCompactions.length > 0) {
          // Sort compactions by timestamp to find the first one
          sessionCompactions.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

          const firstCompaction = sessionCompactions[0];
          const firstCompactionTime = parseInt(firstCompaction.timestamp);

          const timeToWindow = firstCompactionTime - sessionStartTime;

          // Only include if positive (compaction after session start)
          if (timeToWindow > 0) {
            // Convert to minutes
            const timeToWindowMinutes = timeToWindow / (1000 * 60);
            timeToContextWindow.push(timeToWindowMinutes);
          }

          // Count all compactions by type for this session
          sessionCompactions.forEach(compaction => {
            const compactionTime = parseInt(compaction.timestamp);
            if (compactionTime >= weekStart && compactionTime <= weekEnd) {
              if (compaction.compaction_type === 'manual') {
                manualCompactions++;
              } else {
                autoCompactions++;
              }
            }
          });
        }
      });

      // Calculate average time to context window for this week
      if (timeToContextWindow.length > 0) {
        const avgTime = timeToContextWindow.reduce((sum, t) => sum + t, 0) / timeToContextWindow.length;
        metrics.timeToContextWindow = parseFloat(avgTime.toFixed(2));
        console.log(`  ✓ Time to context window: ${metrics.timeToContextWindow} min (${timeToContextWindow.length} sessions)`);
      }

      metrics.autoCompactions = autoCompactions;
      metrics.manualCompactions = manualCompactions;
      console.log(`  ✓ Compactions: ${autoCompactions} auto, ${manualCompactions} manual`);
    }
  }

  weeklyData.push(metrics);
  console.log(`  ✓ Completed ${week.name}`);
  console.log();
}

// Now run loc_per_dev_analysis.js to get LOC per dev for all weeks
console.log('Running loc_per_dev_analysis.js for all weeks...');
try {
  const weeksJson = JSON.stringify(WEEKS);
  const output = execSync(`node loc_per_dev_analysis.js '${weeksJson}' 2>&1`, { encoding: 'utf8', cwd: __dirname });

  // Parse LOC per dev for each week
  WEEKS.forEach((week, idx) => {
    const regex = new RegExp(`${week.name}:.*?(\\d+)\\s+LOC/dev`, 's');
    const match = output.match(regex);
    if (match) {
      weeklyData[idx].locPerDev = parseInt(match[1]);
    }
  });
} catch (error) {
  console.log(`  Error running loc_per_dev_analysis: ${error.message}`);
}

// Run prompt categories analysis
console.log('Running prompt categories analysis...');
try {
  const promptCategoriesData = analyzePromptCategories(WEEKS);

  // Merge prompt categories data into weekly data
  promptCategoriesData.forEach((promptData, idx) => {
    if (weeklyData[idx]) {
      weeklyData[idx].totalPrompts = promptData.totalPrompts;
      weeklyData[idx].avgPromptLength = promptData.avgPromptLength;
      weeklyData[idx].topCategory = promptData.topCategory;
      weeklyData[idx].topCategoryCount = promptData.topCategoryCount;
      weeklyData[idx].topSubcategory = promptData.topSubcategory;
      weeklyData[idx].topSubcategoryCount = promptData.topSubcategoryCount;
      weeklyData[idx].promptCategories = promptData.categories;
    }
  });
  console.log('  ✓ Prompt categories analysis completed');
} catch (error) {
  console.log(`  Error running prompt categories analysis: ${error.message}`);
}

// Collect per-ticket token data for scatter plot using tokens_per_story_point_size.js
console.log('Collecting per-ticket token data...');
let ticketTokenData = [];
try {
  const weeksJson = JSON.stringify(WEEKS);
  const output = execSync(
    `node tokens_per_story_point_size.js --weeks '${weeksJson}' --json-output ticket_token_data.json 2>&1`,
    { encoding: 'utf8', cwd: __dirname }
  );

  // Read the generated JSON file
  const ticketTokenFile = path.join(__dirname, 'ticket_token_data.json');
  if (fs.existsSync(ticketTokenFile)) {
    ticketTokenData = JSON.parse(fs.readFileSync(ticketTokenFile, 'utf8'));
    console.log(`  ✓ Collected ${ticketTokenData.length} tickets with token data`);
  } else {
    console.log('  ⚠ No ticket token data file generated');
  }
} catch (error) {
  console.log(`  Error collecting ticket token data: ${error.message}`);
}

console.log('='.repeat(80));
console.log('COLLECTED METRICS');
console.log('='.repeat(80));
console.log();
console.log(JSON.stringify(weeklyData, null, 2));
console.log();

// Save to timestamped JSON file
const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const outputFile = path.join(__dirname, `collected_metrics_${timestamp}.json`);
fs.writeFileSync(outputFile, JSON.stringify(weeklyData, null, 2));
console.log(`Saved to: ${outputFile}`);

// Save ticket token data with timestamp
const ticketTokenFile = path.join(__dirname, `ticket_token_data_${timestamp}.json`);
fs.writeFileSync(ticketTokenFile, JSON.stringify(ticketTokenData, null, 2));
console.log(`Saved ticket token data to: ${ticketTokenFile}`);
console.log();

// Calculate cost breakdown from bedrock-costs.csv for all weeks
console.log('Calculating cost breakdown from bedrock-costs.csv...');
let costBreakdown = {
  sonnet: 0,
  haiku: 0,
  keyMgmt: 0,
  secHub: 0,
  cloudWatch: 0,
  config: 0,
  tax: 0,
  other: 0
};

try {
  const bedrockCsv = fs.readFileSync(path.join(__dirname, 'bedrock-costs.csv'), 'utf8');
  const bedrockLines = bedrockCsv.split('\n');

  const startDate = new Date(WEEKS[0].start);
  const endDate = new Date(WEEKS[WEEKS.length - 1].end);

  for (let i = 3; i < bedrockLines.length; i++) {
    const parts = bedrockLines[i].split('\t');
    if (parts.length < 2) continue;

    const date = parts[0];
    if (!date || date === 'Service total') continue;

    const lineDate = new Date(date);
    if (lineDate >= startDate && lineDate <= endDate) {
      costBreakdown.sonnet += parseFloat(parts[1]) || 0;
      costBreakdown.haiku += parseFloat(parts[2]) || 0;
      costBreakdown.keyMgmt += parseFloat(parts[3]) || 0;
      costBreakdown.config += parseFloat(parts[4]) || 0;
      costBreakdown.secHub += parseFloat(parts[5]) || 0;
      costBreakdown.tax += parseFloat(parts[6]) || 0;
      costBreakdown.cloudWatch += parseFloat(parts[7]) || 0;

      // Sum remaining columns for 'other'
      for (let j = 8; j < parts.length - 1; j++) {
        costBreakdown.other += parseFloat(parts[j]) || 0;
      }
    }
  }

  const infraTotal = costBreakdown.keyMgmt + costBreakdown.secHub + costBreakdown.cloudWatch +
                      costBreakdown.config + costBreakdown.tax + costBreakdown.other;
  const keyMgmtPct = (costBreakdown.keyMgmt / infraTotal * 100).toFixed(1);
  const secHubPct = (costBreakdown.secHub / infraTotal * 100).toFixed(1);
  const cloudWatchPct = (costBreakdown.cloudWatch / infraTotal * 100).toFixed(1);
  const configPct = (costBreakdown.config / infraTotal * 100).toFixed(1);
  const taxPct = (costBreakdown.tax / infraTotal * 100).toFixed(1);
  const otherPct = (costBreakdown.other / infraTotal * 100).toFixed(1);

  costBreakdown.infraBreakdown = `Key Management: $${costBreakdown.keyMgmt.toFixed(2)} (${keyMgmtPct}%)<br>Security Hub: $${costBreakdown.secHub.toFixed(2)} (${secHubPct}%)<br>CloudWatch: $${costBreakdown.cloudWatch.toFixed(2)} (${cloudWatchPct}%)<br>Config: $${costBreakdown.config.toFixed(2)} (${configPct}%)<br>Tax: $${costBreakdown.tax.toFixed(2)} (${taxPct}%)<br>Other: $${costBreakdown.other.toFixed(2)} (${otherPct}%)`;
  costBreakdown.infraTotal = infraTotal;
  costBreakdown.claudeTotal = costBreakdown.sonnet + costBreakdown.haiku;
  costBreakdown.sonnetPct = (costBreakdown.sonnet / costBreakdown.claudeTotal * 100).toFixed(1);
  costBreakdown.haikuPct = (costBreakdown.haiku / costBreakdown.claudeTotal * 100).toFixed(1);

  console.log(`✓ Calculated costs for Weeks 1-${WEEKS.length}:`);
  console.log(`  Sonnet: $${costBreakdown.sonnet.toFixed(2)}, Haiku: $${costBreakdown.haiku.toFixed(2)}`);
  console.log(`  Infrastructure: $${costBreakdown.infraTotal.toFixed(2)}`);
  console.log();
} catch (error) {
  console.log(`  Warning: Could not calculate cost breakdown: ${error.message}`);
}

// Now update weekly_metrics_plot.js
console.log('Updating weekly_metrics_plot.js...');
const plotFile = path.join(__dirname, 'weekly_metrics_plot.js');
let plotContent = fs.readFileSync(plotFile, 'utf8');

// Find the allWeeks array and replace it
const weekDataStr = weeklyData.map(w => `  {
    week: '${w.week}',
    period: '${w.period}',
    featurePRs: ${w.featurePRs},
    locPerPR: ${w.locPerPR},
    locPerDev: ${w.locPerDev},
    locPerToken: ${w.locPerToken},
    commentsPerPR: ${w.commentsPerPR !== null ? w.commentsPerPR.toFixed(2) : 'null'},
    testCoverage: ${w.testCoverage},
    cves: ${w.cves},
    duplicatedLines: ${w.duplicatedLines},
    maintainability: ${w.maintainability},
    reliability: ${w.reliability},
    security: ${w.security},
    codeSmells: ${w.codeSmells},
    nkt: ${w.nkt},
    cycleTime: ${w.cycleTime},
    tokensPerSP: ${w.tokensPerSP},
    tokensPerCycleTime: ${w.tokensPerCycleTime},
    costPerLOC: ${w.costPerLOC},
    costPerPR: ${w.costPerPR},
    costPerSP: ${w.costPerSP},
    storyPoints: ${w.storyPoints},
    wipSP: ${w.wipSP},
    totalCost: ${w.totalCost},
    timeToContextWindow: ${w.timeToContextWindow},
    autoCompactions: ${w.autoCompactions},
    manualCompactions: ${w.manualCompactions},
    totalPrompts: ${w.totalPrompts || 0},
    avgPromptLength: ${w.avgPromptLength || 0},
    topCategory: ${w.topCategory ? `'${w.topCategory}'` : 'null'},
    topCategoryCount: ${w.topCategoryCount || 0},
    topSubcategory: ${w.topSubcategory ? `'${w.topSubcategory}'` : 'null'},
    topSubcategoryCount: ${w.topSubcategoryCount || 0},
    promptCategories: ${w.promptCategories ? JSON.stringify(w.promptCategories) : 'null'},
    note: '${w.note}'
  }`).join(',\n');

const newWeeksArray = `const weeklyData = [\n${weekDataStr}\n];`;

// Replace the weeklyData array
const weekArrayRegex = /const weeklyData = \[[\s\S]*?\];/;
plotContent = plotContent.replace(weekArrayRegex, newWeeksArray);

// Replace cost breakdown values if we calculated them
if (costBreakdown.sonnet > 0) {
  // Update cost by model chart
  plotContent = plotContent.replace(
    /labels: \['Claude Sonnet 4\.5', 'Claude Haiku'\],\s+values: \[[^\]]+\],/,
    `labels: ['Claude Sonnet 4.5', 'Claude Haiku'],\n      values: [${costBreakdown.sonnet.toFixed(2)}, ${costBreakdown.haiku.toFixed(2)}],`
  );

  // Update cost model chart title
  plotContent = plotContent.replace(
    /text: 'Cost by Model \(Weeks 1-\d+\)'/,
    `text: 'Cost by Model (Weeks 1-${WEEKS.length})'`
  );

  // Update cost by category chart
  plotContent = plotContent.replace(
    /labels: \['Claude API', 'Infrastructure'\],\s+values: \[[^\]]+\],/,
    `labels: ['Claude API', 'Infrastructure'],\n      values: [${costBreakdown.claudeTotal.toFixed(2)}, ${costBreakdown.infraTotal.toFixed(2)}],`
  );

  // Update infrastructure breakdown
  plotContent = plotContent.replace(
    /const infraBreakdown = '[^']+';/,
    `const infraBreakdown = '${costBreakdown.infraBreakdown}';`
  );

  // Update customdata for Claude API breakdown
  plotContent = plotContent.replace(
    /customdata: \[\s+\['Sonnet 4\.5: [^\]]+\],/,
    `customdata: [\n        ['Sonnet 4.5: $${costBreakdown.sonnet.toFixed(2)} (${costBreakdown.sonnetPct}%)<br>Haiku: $${costBreakdown.haiku.toFixed(2)} (${costBreakdown.haikuPct}%)'],`
  );

  // Update cost category chart title
  plotContent = plotContent.replace(
    /text: 'Cost by Category \(Weeks 1-\d+\)'/,
    `text: 'Cost by Category (Weeks 1-${WEEKS.length})'`
  );

  console.log('✓ Updated cost breakdown values');
}

// Replace ticket token data for scatter plot
plotContent = plotContent.replace(
  /const ticketTokenData = \[\];.*$/m,
  `const ticketTokenData = ${JSON.stringify(ticketTokenData)};`
);
console.log('✓ Updated ticket token data for scatter plot');

fs.writeFileSync(plotFile, plotContent);
console.log('✓ Updated weekly_metrics_plot.js');
console.log();

// Generate the dashboard
console.log('Generating dashboard HTML...');
execSync('node weekly_metrics_plot.js', { cwd: __dirname });
console.log('✓ Dashboard generated: weekly_metrics.html');
console.log();

// Calculate and update performance highlights and period averages
console.log('Calculating performance highlights and period averages...');

// Filter weeks with data (exclude weeks with no PRs)
const weeksWithData = weeklyData.filter(w => w.featurePRs > 0);

// Performance Highlights
const peakNKT = Math.max(...weeksWithData.filter(w => w.nkt !== null).map(w => w.nkt));
const peakNKTWeek = weeksWithData.find(w => w.nkt === peakNKT);

const maxTestCoverage = Math.max(...weeksWithData.filter(w => w.testCoverage !== null).map(w => w.testCoverage));
const maxTestCoverageWeek = weeksWithData.find(w => w.testCoverage === maxTestCoverage);

const optimalCostPerSP = Math.min(...weeksWithData.filter(w => w.costPerSP !== null).map(w => w.costPerSP));
const optimalCostPerSPWeek = weeksWithData.find(w => w.costPerSP === optimalCostPerSP);

const totalStoryPoints = weeksWithData.reduce((sum, w) => sum + (w.storyPoints || 0), 0);
const totalCost = weeklyData.reduce((sum, w) => sum + w.totalCost, 0);

// Period Averages
const avgNKT = weeksWithData.filter(w => w.nkt !== null).reduce((sum, w) => sum + w.nkt, 0) / weeksWithData.filter(w => w.nkt !== null).length;
const avgTestCoverage = weeksWithData.filter(w => w.testCoverage !== null).reduce((sum, w) => sum + w.testCoverage, 0) / weeksWithData.filter(w => w.testCoverage !== null).length;
const blendedCostPerSP = totalCost / totalStoryPoints;
const avgPRRate = weeksWithData.reduce((sum, w) => sum + w.featurePRs, 0) / weeksWithData.length;
const totalLOC = weeksWithData.reduce((sum, w) => sum + w.totalLOC, 0);
const totalPRs = weeksWithData.reduce((sum, w) => sum + w.featurePRs, 0);
const avgLinesPerPR = totalLOC / totalPRs;
const avgCodeSmells = weeksWithData.filter(w => w.codeSmells !== null).reduce((sum, w) => sum + w.codeSmells, 0) / weeksWithData.filter(w => w.codeSmells !== null).length;

// Update HTML file
const htmlFile = path.join(__dirname, 'weekly_metrics.html');
let htmlContent = fs.readFileSync(htmlFile, 'utf8');

// Update period subtitle
const firstPeriod = WEEKS[0].period;  // "Oct 7-13"
const lastPeriod = WEEKS[WEEKS.length - 1].period;  // "Nov 12-18"
const startDate = firstPeriod.split('-')[0].trim();  // "Oct 7"
const endDate = lastPeriod.split('-')[1].trim();  // "18"
const endMonth = lastPeriod.split(' ')[0];  // "Nov"
htmlContent = htmlContent.replace(
  /<div class="subtitle">Performance Analysis Period: [^<]+<\/div>/,
  `<div class="subtitle">Performance Analysis Period: ${startDate} - ${endMonth} ${endDate}, 2025</div>`
);

// Update Performance Highlights
htmlContent = htmlContent.replace(
  /<div class="insight-title">Peak Options Value \(NK\/T\)<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Achieved in [^<]+<\/div>/,
  `<div class="insight-title">Peak Options Value (NK/T)</div>\n        <div class="insight-value">${peakNKT.toFixed(2)}</div>\n        <div class="insight-desc">Achieved in ${peakNKTWeek.week}</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Maximum Test Coverage<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Achieved in [^<]+<\/div>/,
  `<div class="insight-title">Maximum Test Coverage</div>\n        <div class="insight-value">${maxTestCoverage.toFixed(1)}%</div>\n        <div class="insight-desc">Achieved in ${maxTestCoverageWeek.week}</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Optimal Cost Efficiency<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Cost per story point in [^<]+<\/div>/,
  `<div class="insight-title">Optimal Cost Efficiency</div>\n        <div class="insight-value">$${optimalCostPerSP.toFixed(2)}</div>\n        <div class="insight-desc">Cost per story point in ${optimalCostPerSPWeek.week}</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Delivered Story Points<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Total story points completed across [^<]+<\/div>/,
  `<div class="insight-title">Delivered Story Points</div>\n        <div class="insight-value">${totalStoryPoints} SP</div>\n        <div class="insight-desc">Total story points completed across the ${WEEKS.length}-week development period</div>`
);

// Update Period Averages
htmlContent = htmlContent.replace(
  /<div class="section-subtitle">Aggregate metrics for [^<]+<\/div>/,
  `<div class="section-subtitle">Aggregate metrics for ${startDate} - ${endMonth} ${endDate}, 2025</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Mean Options Value \(NK\/T\)<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Average options value across [^<]+<\/div>/,
  `<div class="insight-title">Mean Options Value (NK/T)</div>\n        <div class="insight-value">${avgNKT.toFixed(2)}</div>\n        <div class="insight-desc">Average options value across weeks with data</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Mean Test Coverage<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Average code coverage across [^<]+<\/div>/,
  `<div class="insight-title">Mean Test Coverage</div>\n        <div class="insight-value">${avgTestCoverage.toFixed(1)}%</div>\n        <div class="insight-desc">Average code coverage across ${totalPRs} feature pull requests</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Blended Cost per Story Point<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Total expenditure of [^<]+<\/div>/,
  `<div class="insight-title">Blended Cost per Story Point</div>\n        <div class="insight-value">$${blendedCostPerSP.toFixed(2)}</div>\n        <div class="insight-desc">Total expenditure of $${totalCost.toFixed(2)} divided by ${totalStoryPoints} story points delivered</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Mean Pull Request Rate<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Average feature pull requests merged per week over [^<]+<\/div>/,
  `<div class="insight-title">Mean Pull Request Rate</div>\n        <div class="insight-value">${avgPRRate.toFixed(1)}</div>\n        <div class="insight-desc">Average feature pull requests merged per week over the ${WEEKS.length}-week period</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Mean Lines Changed per PR<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Average code changes per pull request \([^)]+\)<\/div>/,
  `<div class="insight-title">Mean Lines Changed per PR</div>\n        <div class="insight-value">${Math.round(avgLinesPerPR).toLocaleString()}</div>\n        <div class="insight-desc">Average code changes per pull request (${totalLOC.toLocaleString()} total lines across period)</div>`
);

htmlContent = htmlContent.replace(
  /<div class="insight-title">Mean Code Smell Density<\/div>\s*<div class="insight-value">[^<]+<\/div>\s*<div class="insight-desc">Average code smells identified per pull request[^<]*<\/div>/,
  `<div class="insight-title">Mean Code Smell Density</div>\n        <div class="insight-value">${avgCodeSmells.toFixed(2)}</div>\n        <div class="insight-desc">Average code smells identified per pull request, indicating consistent quality</div>`
);

fs.writeFileSync(htmlFile, htmlContent);
console.log('✓ Updated performance highlights and period averages');
console.log();

console.log('='.repeat(80));
console.log('DONE!');
console.log('='.repeat(80));
