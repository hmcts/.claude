#!/usr/bin/env node

/**
 * N/K/T Metrics Calculator for AI-Assisted Development
 *
 * Calculates:
 * - N: Number of files/modules changed independently
 * - K: Number of concurrent developers (agents)
 * - T: End-to-end cycle time per experiment
 * - NK/T: Parallel throughput efficiency
 *
 * Usage:
 *   node nkt_metrics.js --ticket VIBE-123           # Single ticket analysis
 *   node nkt_metrics.js --sprint "Cath Sprint 3"    # Sprint analysis
 *   node nkt_metrics.js --days 30 --repo hmcts/cath-service  # Time range
 *
 * Requires:
 * - GITHUB_TOKEN environment variable
 * - JIRA_PERSONAL_TOKEN environment variable
 */

const https = require('https');
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

// Configuration
const CONFIG = {
  GITHUB_API_HOST: 'api.github.com',
  JIRA_HOST: 'tools.hmcts.net',
  JIRA_BASE_PATH: '/jira',
  DEFAULT_REPO: 'hmcts/cath-service',
  DEFAULT_BOARD_ID: '3078',
  DEFAULT_DAYS: 14,
  JIRA_TOKEN: process.env.JIRA_TOKEN,
};

// Parse command line arguments
const args = process.argv.slice(2);
let mode = 'days'; // 'ticket', 'sprint', or 'days'
let targetTicket = null;
let targetSprint = null;
let targetRepo = CONFIG.DEFAULT_REPO;
let daysBack = CONFIG.DEFAULT_DAYS;
let startDateStr = null;
let endDateStr = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ticket' && args[i + 1]) {
    mode = 'ticket';
    targetTicket = args[i + 1];
    i++;
  } else if (args[i] === '--sprint' && args[i + 1]) {
    mode = 'sprint';
    targetSprint = args[i + 1];
    i++;
  } else if (args[i] === '--repo' && args[i + 1]) {
    targetRepo = args[i + 1];
    i++;
  } else if (args[i] === '--days' && args[i + 1]) {
    daysBack = parseInt(args[i + 1]);
    i++;
  } else if ((args[i] === '--start' || args[i] === '-s') && args[i + 1]) {
    startDateStr = args[i + 1];
    mode = 'daterange';
    i++;
  } else if ((args[i] === '--end' || args[i] === '-e') && args[i + 1]) {
    endDateStr = args[i + 1];
    i++;
  }
}

// Use hardcoded token
const jiraToken = CONFIG.JIRA_TOKEN;

console.log('='.repeat(80));
console.log('N/K/T Metrics Calculator - AI-Assisted Development Analysis');
console.log('='.repeat(80));
console.log();

// Make GitHub API request using gh CLI
function makeGitHubRequest(path) {
  try {
    const result = execSync(`gh api "${path}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });
    return Promise.resolve(JSON.parse(result));
  } catch (error) {
    if (error.stderr && error.stderr.includes('404')) {
      return Promise.resolve(null);
    }
    return Promise.reject(error);
  }
}

// Make JIRA API request
function makeJiraRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.JIRA_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`JIRA API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Extract JIRA ticket ID from text
function extractJiraTicket(text) {
  if (!text) return null;
  const match = text.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

// Bot detection patterns
const BOT_PATTERNS = [
  'dependabot',
  'renovate',
  'github-actions',
  'greenkeeper',
  'snyk-bot',
  '[bot]'
];

// Check if PR is from a bot or excluded developer
function isBot(pr) {
  // Check user type
  if (pr.user && pr.user.type === 'Bot') {
    return true;
  }

  // Check username for bot patterns
  if (pr.user && pr.user.login) {
    const username = pr.user.login.toLowerCase();
    if (BOT_PATTERNS.some(bot => username.includes(bot))) {
      return true;
    }

    // Check for excluded developers (infrastructure/setup work)
    if (EXCLUDED_DEVELOPERS.some(excluded => username.includes(excluded))) {
      return true;
    }
  }

  // Check PR title for dependency updates
  if (pr.title) {
    const title = pr.title.toLowerCase();
    if (title.includes('update dependency') ||
        title.includes('bump ') ||
        title.includes('renovate') ||
        title.includes('[security]') ||
        title.includes('update github')) {
      return true;
    }
  }

  return false;
}

// Get JIRA ticket changelog
async function getJiraTicketTimeline(ticketId) {
  try {
    const path = `${CONFIG.JIRA_BASE_PATH}/rest/api/2/issue/${ticketId}?expand=changelog&fields=summary,status,created`;
    const issue = await makeJiraRequest(path);

    const timeline = {
      created: new Date(issue.fields.created).getTime(),
      statusTransitions: [],
      totalDevTimeMs: 0,
    };

    // Parse ALL status changes in chronological order
    if (issue.changelog && issue.changelog.histories) {
      const transitions = [];

      for (const history of issue.changelog.histories) {
        for (const item of history.items) {
          if (item.field === 'status') {
            transitions.push({
              timestamp: new Date(history.created).getTime(),
              from: item.fromString,
              to: item.toString
            });
          }
        }
      }

      // Sort by timestamp
      transitions.sort((a, b) => a.timestamp - b.timestamp);
      timeline.statusTransitions = transitions;

      // Calculate total time in "In Progress" (sum all dev periods)
      let inProgressStart = null;

      for (const transition of transitions) {
        if (transition.to === 'In Progress' && !inProgressStart) {
          // Entering development
          inProgressStart = transition.timestamp;
        } else if (inProgressStart && transition.from === 'In Progress') {
          // Leaving development (to Code Review, Ready for Test, etc.)
          const devPeriod = transition.timestamp - inProgressStart;
          timeline.totalDevTimeMs += devPeriod;
          inProgressStart = null; // Reset for next dev cycle
        }
      }

      // If still in progress at end, use current time
      if (inProgressStart) {
        const devPeriod = Date.now() - inProgressStart;
        timeline.totalDevTimeMs += devPeriod;
      }
    }

    return timeline;
  } catch (error) {
    console.error(`  Error getting timeline for ${ticketId}: ${error.message}`);
    return null;
  }
}

// Get PRs for time range
async function getPRsInTimeRange(repo, since, until) {
  const prs = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const path = `/repos/${repo}/pulls?state=all&per_page=${perPage}&page=${page}&sort=created&direction=desc`;
    const pagePRs = await makeGitHubRequest(path);

    if (!pagePRs || pagePRs.length === 0) break;

    for (const pr of pagePRs) {
      const createdAt = new Date(pr.created_at).getTime();

      if (createdAt < since) {
        return prs; // Stop, we've gone too far back
      }

      if (createdAt >= since && createdAt <= until) {
        prs.push(pr);
      }
    }

    if (pagePRs.length < perPage) break;
    page++;
  }

  return prs;
}

// Get PR files
async function getPRFiles(repo, prNumber) {
  const path = `/repos/${repo}/pulls/${prNumber}/files`;
  return await makeGitHubRequest(path);
}

// Calculate N - Independent file changes
async function calculateN(prs, repo) {
  console.log('Calculating N (Independent File Changes)...');

  const allFiles = new Set();
  const fileChangeCounts = {};
  const prFileMap = {};

  for (const pr of prs) {
    const files = await getPRFiles(repo, pr.number);
    prFileMap[pr.number] = files || [];

    if (files) {
      files.forEach(file => {
        allFiles.add(file.filename);
        fileChangeCounts[file.filename] = (fileChangeCounts[file.filename] || 0) + 1;
      });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const overlappingFiles = Object.keys(fileChangeCounts).filter(f => fileChangeCounts[f] > 1);
  const independentFiles = allFiles.size - overlappingFiles.length;

  return {
    totalFiles: allFiles.size,
    overlappingFiles: overlappingFiles.length,
    independentFiles: independentFiles,
    parallelizationPotential: allFiles.size > 0 ? (independentFiles / allFiles.size) : 0,
    fileChangeCounts,
    prFileMap,
  };
}

// Developers to exclude from K metric
const EXCLUDED_DEVELOPERS = [
  'linosnort',
  'linus-norton',
  'linusnorton'
];

// Calculate K - Concurrent developers
function calculateK(prs, since, until) {
  console.log('Calculating K (Concurrent Developers)...');

  const allDevelopers = new Set();
  const dailyActive = {};
  const developerActivity = {};

  const days = Math.ceil((until - since) / (24 * 60 * 60 * 1000));

  // Initialize daily buckets
  for (let i = 0; i < days; i++) {
    const date = new Date(since + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dailyActive[date] = new Set();
  }

  // Track developer activity
  prs.forEach(pr => {
    const author = pr.user.login;

    // Skip excluded developers
    if (EXCLUDED_DEVELOPERS.some(excluded => author.toLowerCase().includes(excluded))) {
      return;
    }
    allDevelopers.add(author);

    if (!developerActivity[author]) {
      developerActivity[author] = {
        prCount: 0,
        activeDays: new Set(),
      };
    }

    developerActivity[author].prCount++;

    const createdDate = new Date(pr.created_at);
    const mergedDate = pr.merged_at ? new Date(pr.merged_at) : new Date();

    // Mark developer as active for each day the PR was open
    for (let d = createdDate; d <= mergedDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (dailyActive[dateStr]) {
        dailyActive[dateStr].add(author);
        developerActivity[author].activeDays.add(dateStr);
      }
    }
  });

  // Calculate average concurrent developers
  const dailyCounts = Object.values(dailyActive).map(s => s.size);
  const avgConcurrent = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;
  const peakConcurrent = Math.max(...dailyCounts);

  // Calculate utilization
  Object.keys(developerActivity).forEach(dev => {
    const activeDays = developerActivity[dev].activeDays.size;
    developerActivity[dev].utilization = activeDays / days;
  });

  return {
    totalDevelopers: allDevelopers.size,
    avgConcurrent,
    peakConcurrent,
    developerActivity,
    dailyActive,
  };
}

// Calculate T - Cycle time
async function calculateT(prs, repo) {
  console.log('Calculating T (Cycle Time)...');

  const cycleTimes = [];
  const detailedBreakdowns = [];

  for (const pr of prs) {
    if (!pr.merged_at) continue; // Only merged PRs

    const jiraTicket = extractJiraTicket(pr.title) || extractJiraTicket(pr.body);

    let timeline = null;
    if (jiraTicket) {
      timeline = await getJiraTicketTimeline(jiraTicket);
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
    }

    const created = new Date(pr.created_at).getTime();
    const merged = new Date(pr.merged_at).getTime();

    const cycleTime = {
      pr: pr.number,
      jiraTicket,
      totalMs: 0,
      totalDays: 0,
      breakdown: {},
    };

    if (timeline && timeline.totalDevTimeMs > 0) {
      // Sum of all "In Progress" periods (captures rework cycles)
      cycleTime.totalMs = timeline.totalDevTimeMs;
      cycleTime.totalDays = cycleTime.totalMs / (24 * 60 * 60 * 1000);
      cycleTime.breakdown.development = cycleTime.totalMs;
      cycleTime.type = 'dev-time-sum';
    } else {
      // PR only: Created → Merged (no JIRA data or no In Progress time)
      cycleTime.totalMs = merged - created;
      cycleTime.totalDays = cycleTime.totalMs / (24 * 60 * 60 * 1000);
      cycleTime.breakdown.review = cycleTime.totalMs;
      cycleTime.type = 'pr-only';
    }

    cycleTimes.push(cycleTime.totalDays);
    detailedBreakdowns.push(cycleTime);
  }

  const avgCycleTime = cycleTimes.length > 0
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : 0;

  return {
    avgCycleTime,
    minCycleTime: Math.min(...cycleTimes),
    maxCycleTime: Math.max(...cycleTimes),
    cycleTimes,
    detailedBreakdowns,
  };
}

// Main analysis function
async function analyzeNKT() {
  let since, until;

  if (mode === 'ticket') {
    console.log(`Mode: Single ticket analysis (${targetTicket})`);
    console.log();
    // TODO: Implement single ticket analysis
    console.error('Single ticket mode not yet implemented. Use --days for now.');
    process.exit(1);
  } else if (mode === 'sprint') {
    console.log(`Mode: Sprint analysis (${targetSprint})`);
    console.log();
    // TODO: Get sprint dates from JIRA
    console.error('Sprint mode not yet implemented. Use --days for now.');
    process.exit(1);
  } else if (mode === 'daterange') {
    // Date range mode
    if (!startDateStr || !endDateStr) {
      console.error('Error: Both --start and --end dates are required for date range mode');
      process.exit(1);
    }
    since = new Date(startDateStr).getTime();
    until = new Date(endDateStr).getTime();
    const days = Math.ceil((until - since) / (24 * 60 * 60 * 1000));
    console.log(`Mode: Date range analysis`);
    console.log(`Repository: ${targetRepo}`);
    console.log(`Date Range: ${startDateStr} to ${endDateStr} (${days} days)`);
    console.log();
  } else {
    // Days mode
    until = Date.now();
    since = until - (daysBack * 24 * 60 * 60 * 1000);
    console.log(`Mode: Time range analysis`);
    console.log(`Repository: ${targetRepo}`);
    console.log(`Date Range: ${new Date(since).toISOString().split('T')[0]} to ${new Date(until).toISOString().split('T')[0]} (${daysBack} days)`);
    console.log();
  }

  // Get PRs
  console.log('Step 1: Fetching PRs...');
  const allPRs = await getPRsInTimeRange(targetRepo, since, until);
  console.log(`  Found ${allPRs.length} PRs in time range`);

  // Filter out bot PRs
  const prs = allPRs.filter(pr => !isBot(pr));
  const botPRs = allPRs.length - prs.length;

  console.log(`  Filtered ${botPRs} bot PRs (dependabot, renovate, etc.)`);
  console.log(`  Analyzing ${prs.length} feature PRs from human developers`);
  console.log();

  if (prs.length === 0) {
    console.log('No feature PRs found in time range. Exiting.');
    process.exit(0);
  }

  // Calculate metrics
  const N = await calculateN(prs, targetRepo);
  console.log(`  N calculated: ${N.independentFiles} independent file changes`);
  console.log();

  const K = calculateK(prs, since, until);
  console.log(`  K calculated: ${K.avgConcurrent.toFixed(2)} average concurrent developers`);
  console.log();

  const T = await calculateT(prs, targetRepo);
  console.log(`  T calculated: ${T.avgCycleTime.toFixed(2)} days average cycle time`);
  console.log();

  // Calculate NK/T
  const NKT = (N.independentFiles * K.avgConcurrent) / (T.avgCycleTime || 1);

  // Display results
  displayResults(N, K, T, NKT, prs, allPRs.length, botPRs, since, until);
}

// Display results
function displayResults(N, K, T, NKT, prs, totalPRs, botPRCount, since, until) {
  console.log('='.repeat(80));
  console.log('N/K/T METRICS RESULTS');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total PRs in time range: ${totalPRs}`);
  console.log(`Bot PRs filtered: ${botPRCount} (${((botPRCount/totalPRs)*100).toFixed(1)}%)`);
  console.log(`Feature PRs analyzed: ${prs.length}`);
  console.log();

  // N Metrics
  console.log('📁 N - INDEPENDENT FILE CHANGES');
  console.log('-'.repeat(80));
  console.log(`Total files changed:           ${N.totalFiles}`);
  console.log(`Files changed in multiple PRs: ${N.overlappingFiles}`);
  console.log(`Independent file changes:      ${N.independentFiles}`);
  console.log(`Parallelization potential:     ${(N.parallelizationPotential * 100).toFixed(1)}%`);
  console.log();

  if (N.overlappingFiles > 0) {
    console.log('Files with conflicts/overlap:');
    const conflicts = Object.entries(N.fileChangeCounts)
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10);

    conflicts.forEach(([file, count]) => {
      console.log(`  - ${file} (${count} PRs)`);
    });
    console.log();
  }

  // K Metrics
  console.log('👥 K - CONCURRENT DEVELOPER CAPACITY');
  console.log('-'.repeat(80));
  console.log(`Total developers:              ${K.totalDevelopers}`);
  console.log(`Average concurrent developers: ${K.avgConcurrent.toFixed(2)}`);
  console.log(`Peak concurrent developers:    ${K.peakConcurrent}`);
  console.log();

  console.log('Developer Activity:');
  Object.entries(K.developerActivity)
    .sort(([_, a], [__, b]) => b.prCount - a.prCount)
    .forEach(([dev, stats]) => {
      console.log(`  ${dev}: ${stats.prCount} PRs, ${stats.activeDays.size} active days (${(stats.utilization * 100).toFixed(0)}% utilization)`);
    });
  console.log();

  // T Metrics
  console.log('⏱️  T - CYCLE TIME');
  console.log('-'.repeat(80));
  console.log(`Average cycle time:            ${T.avgCycleTime.toFixed(2)} days`);
  console.log(`Min cycle time:                ${T.minCycleTime.toFixed(2)} days`);
  console.log(`Max cycle time:                ${T.maxCycleTime.toFixed(2)} days`);
  console.log(`PRs analyzed:                  ${T.cycleTimes.length}`);
  console.log();

  // Show breakdown for slowest PRs
  const slowest = T.detailedBreakdowns
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5);

  if (slowest.length > 0) {
    console.log('Slowest PRs:');
    slowest.forEach(pr => {
      console.log(`  PR #${pr.pr}${pr.jiraTicket ? ` (${pr.jiraTicket})` : ''}: ${pr.totalDays.toFixed(2)} days`);
    });
    console.log();
  }

  // NK/T Combined Metric
  console.log('='.repeat(80));
  console.log('🎯 NK/T - PARALLEL THROUGHPUT EFFICIENCY');
  console.log('='.repeat(80));
  console.log();
  console.log(`NK/T = (N × K) / T`);
  console.log(`     = (${N.independentFiles} × ${K.avgConcurrent.toFixed(2)}) / ${T.avgCycleTime.toFixed(2)}`);
  console.log(`     = ${NKT.toFixed(2)} files per day`);
  console.log();
  console.log('Interpretation:');
  console.log(`  The team processes ~${Math.round(NKT)} independent file changes per day`);
  console.log(`  with ${K.avgConcurrent.toFixed(1)} developers working in parallel.`);
  console.log();

  // Additional metrics
  console.log('='.repeat(80));
  console.log('📊 ADDITIONAL PRODUCTIVITY METRICS');
  console.log('='.repeat(80));
  console.log();

  const throughput = prs.length / ((until - since) / (24 * 60 * 60 * 1000));
  console.log(`PR Throughput:                 ${throughput.toFixed(2)} PRs per day`);

  const efficiency = prs.length / (K.avgConcurrent * ((until - since) / (24 * 60 * 60 * 1000)));
  console.log(`Developer Efficiency:          ${efficiency.toFixed(2)} PRs per developer per day`);

  console.log();
  console.log('='.repeat(80));
}

// Run the analysis
analyzeNKT().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
