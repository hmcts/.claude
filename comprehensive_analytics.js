#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  REPO: 'hmcts/cath-service',
  JIRA_BASE_URL: 'https://tools.hmcts.net/jira',
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || '',
  JIRA_EMAIL: process.env.JIRA_EMAIL || '',
  ANALYTICS_DIR: '/Users/alexjonesysol/Documents/claude epipe fix/.claude/.claude/analytics',
  OUTPUT_FILE: '/Users/alexjonesysol/Documents/claude epipe fix/.claude/comprehensive_analytics_report.json',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse CSV file into array of objects
 */
function parseCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Extract JIRA ticket ID from PR title
 */
function extractJiraTicket(title) {
  if (!title) return null;
  const match = title.match(/^([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Find PR associated with a commit SHA
 */
function findPRForCommit(commitSha, repo) {
  try {
    const result = execSync(
      `gh api "repos/${repo}/commits/${commitSha}/pulls" --jq '.[0] | {number, title, merged_at, created_at, html_url, state}'`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    if (!result.trim()) return null;

    const pr = JSON.parse(result);
    return pr.number ? pr : null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch JIRA ticket details
 */
function fetchJiraTicket(ticketId) {
  if (!CONFIG.JIRA_API_TOKEN || !CONFIG.JIRA_EMAIL) {
    return null;
  }

  try {
    const auth = Buffer.from(`${CONFIG.JIRA_EMAIL}:${CONFIG.JIRA_API_TOKEN}`).toString('base64');

    const fields = [
      'summary',
      'status',
      'created',
      'resolutiondate',
      'customfield_10016',  // Story points
      'customfield_10020',  // Sprint
      'timetracking',
      'priority',
      'assignee',
    ].join(',');

    const url = `${CONFIG.JIRA_BASE_URL}/rest/api/2/issue/${ticketId}?fields=${fields}`;

    const result = execSync(
      `curl -s -H "Authorization: Basic ${auth}" -H "Content-Type: application/json" "${url}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const issue = JSON.parse(result);

    if (issue.errorMessages) {
      return null;
    }

    // Extract sprint info
    let sprintInfo = null;
    const sprintField = issue.fields?.customfield_10020;
    if (sprintField && Array.isArray(sprintField) && sprintField.length > 0) {
      const sprint = sprintField[0];
      const sprintMatch = sprint.match(/name=([^,\]]+)/);
      sprintInfo = sprintMatch ? sprintMatch[1] : sprint;
    }

    return {
      ticketId: ticketId,
      summary: issue.fields?.summary || '',
      status: issue.fields?.status?.name || '',
      storyPoints: issue.fields?.customfield_10016 || null,
      sprint: sprintInfo,
      created: issue.fields?.created || null,
      resolved: issue.fields?.resolutiondate || null,
      timeTracking: {
        originalEstimate: issue.fields?.timetracking?.originalEstimate || null,
        timeSpent: issue.fields?.timetracking?.timeSpent || null,
        originalEstimateSeconds: issue.fields?.timetracking?.originalEstimateSeconds || 0,
        timeSpentSeconds: issue.fields?.timetracking?.timeSpentSeconds || 0,
      },
      priority: issue.fields?.priority?.name || null,
      assignee: issue.fields?.assignee?.displayName || null,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get analytics for a session
 */
function getSessionAnalytics(sessionId, sessions, costs, turns, tools, compactions) {
  const sessionInfo = sessions.find(s => s.session_id === sessionId);
  const sessionCosts = costs.filter(c => c.session_id === sessionId);
  const sessionTurns = turns.filter(t => t.session_id === sessionId);
  const sessionTools = tools.filter(t => t.session_id === sessionId);
  const sessionCompactions = compactions.filter(c => c.session_id === sessionId);

  const totalInputTokens = sessionCosts.reduce((sum, c) => sum + parseInt(c.input_tokens || 0), 0);
  const totalOutputTokens = sessionCosts.reduce((sum, c) => sum + parseInt(c.output_tokens || 0), 0);
  const totalTokens = sessionCosts.reduce((sum, c) => sum + parseInt(c.total_tokens || 0), 0);
  const totalCost = sessionCosts.reduce((sum, c) => sum + parseFloat(c.total_cost_usd || 0), 0);

  // Calculate session duration
  let durationMs = 0;
  if (sessionInfo && sessionInfo.started_at && sessionInfo.ended_at) {
    durationMs = parseInt(sessionInfo.ended_at) - parseInt(sessionInfo.started_at);
  }

  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    totalTokens: totalTokens,
    totalCost: totalCost,
    durationMs: durationMs,
    durationMinutes: durationMs / 1000 / 60,
    turnCount: sessionTurns.length,
    toolCount: sessionTools.length,
    compactionCount: sessionCompactions.length,
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

console.log('='.repeat(80));
console.log('Comprehensive Analytics Report');
console.log(`Repository: ${CONFIG.REPO}`);
console.log('='.repeat(80));
console.log();

// Check JIRA credentials
const hasJiraCredentials = CONFIG.JIRA_API_TOKEN && CONFIG.JIRA_EMAIL;
if (!hasJiraCredentials) {
  console.log('⚠ JIRA credentials not configured (Story point metrics will be unavailable)');
  console.log('  Set JIRA_API_TOKEN and JIRA_EMAIL environment variables');
  console.log();
}

// Load analytics data
console.log('Loading analytics data...');
const commits = parseCSV(path.join(CONFIG.ANALYTICS_DIR, 'commits.csv'));
const costs = parseCSV(path.join(CONFIG.ANALYTICS_DIR, 'costs.csv'));
const sessions = parseCSV(path.join(CONFIG.ANALYTICS_DIR, 'sessions.csv'));
const turns = parseCSV(path.join(CONFIG.ANALYTICS_DIR, 'turns.csv'));
const tools = parseCSV(path.join(CONFIG.ANALYTICS_DIR, 'tools.csv'));
const compactions = parseCSV(path.join(CONFIG.ANALYTICS_DIR, 'compactions.csv'));

console.log(`  Commits: ${commits.length}`);
console.log(`  Sessions: ${sessions.length}`);
console.log(`  Cost records: ${costs.length}`);
console.log();

if (commits.length === 0) {
  console.log('No commit data found.');
  console.log('Analytics will be collected once you work on this repository with Claude Code.');
  process.exit(0);
}

// Build session → commits mapping
const sessionToCommits = {};
commits.forEach(commit => {
  if (!sessionToCommits[commit.session_id]) {
    sessionToCommits[commit.session_id] = [];
  }
  sessionToCommits[commit.session_id].push(commit);
});

console.log(`Sessions with commits: ${Object.keys(sessionToCommits).length}`);
console.log();

// Analyze each session
const linkedData = [];
const ticketCache = {};
const prCache = {};

console.log('Linking sessions → commits → PRs → JIRA tickets...');
console.log();

Object.keys(sessionToCommits).forEach((sessionId, index) => {
  const sessionCommits = sessionToCommits[sessionId];
  const sessionInfo = sessions.find(s => s.session_id === sessionId);
  const repoName = sessionCommits[0].repo_name;

  console.log(`[${index + 1}/${Object.keys(sessionToCommits).length}] Session: ${sessionId.substring(0, 12)}...`);

  // Get most recent commit
  const latestCommit = sessionCommits.sort((a, b) =>
    parseInt(b.committed_at || 0) - parseInt(a.committed_at || 0)
  )[0];

  console.log(`  Repo: ${repoName}`);
  console.log(`  Commit: ${latestCommit.commit_sha.substring(0, 7)}`);
  console.log(`  LOC Changed: ${latestCommit.total_loc_changed}`);

  // Find PR (use cache)
  const cacheKey = `${repoName}:${latestCommit.commit_sha}`;
  let pr = prCache[cacheKey];
  if (!pr && !prCache.hasOwnProperty(cacheKey)) {
    pr = findPRForCommit(latestCommit.commit_sha, repoName);
    prCache[cacheKey] = pr;
  }

  if (!pr) {
    console.log(`  ⚠ No PR found`);
    console.log();
    return;
  }

  console.log(`  PR #${pr.number}: ${pr.title}`);
  console.log(`  PR State: ${pr.state} ${pr.merged_at ? '(merged)' : ''}`);

  // Skip if PR not merged
  if (!pr.merged_at) {
    console.log(`  ⚠ PR not merged yet - skipping`);
    console.log();
    return;
  }

  // Calculate time to merge PR
  const prCreatedTime = new Date(pr.created_at).getTime();
  const prMergedTime = new Date(pr.merged_at).getTime();
  const timeToMergeMs = prMergedTime - prCreatedTime;

  console.log(`  Time to merge: ${formatDuration(timeToMergeMs)}`);

  // Extract JIRA ticket
  const jiraTicket = extractJiraTicket(pr.title);
  let jiraData = null;

  if (jiraTicket) {
    console.log(`  JIRA: ${jiraTicket}`);

    // Fetch JIRA data (use cache)
    jiraData = ticketCache[jiraTicket];
    if (!jiraData && !ticketCache.hasOwnProperty(jiraTicket)) {
      jiraData = fetchJiraTicket(jiraTicket);
      ticketCache[jiraTicket] = jiraData;

      if (jiraData) {
        console.log(`    Story Points: ${jiraData.storyPoints || 'N/A'}`);
        console.log(`    Sprint: ${jiraData.sprint || 'N/A'}`);
        console.log(`    Status: ${jiraData.status}`);
      }
    }
  }

  // Get analytics for this session
  const analytics = getSessionAnalytics(sessionId, sessions, costs, turns, tools, compactions);

  // Calculate tokens per LOC
  const tokensPerLOC = analytics.totalTokens / parseInt(latestCommit.total_loc_changed || 1);

  console.log(`  Tokens: ${analytics.totalTokens.toLocaleString()}`);
  console.log(`  Tokens/LOC: ${tokensPerLOC.toFixed(2)}`);
  console.log(`  Cost: $${analytics.totalCost.toFixed(2)}`);
  console.log(`  Session Duration: ${formatDuration(analytics.durationMs)}`);
  console.log();

  // Calculate per-story-point metrics
  let tokensPerStoryPoint = null;
  let costPerStoryPoint = null;
  if (jiraData && jiraData.storyPoints) {
    tokensPerStoryPoint = analytics.totalTokens / jiraData.storyPoints;
    costPerStoryPoint = analytics.totalCost / jiraData.storyPoints;
  }

  // Add to linked data
  linkedData.push({
    sessionId: sessionId,
    repoName: repoName,
    commitSha: latestCommit.commit_sha,
    commitMessage: latestCommit.commit_message,
    filesChanged: parseInt(latestCommit.files_changed || 0),
    insertions: parseInt(latestCommit.insertions || 0),
    deletions: parseInt(latestCommit.deletions || 0),
    totalLOC: parseInt(latestCommit.total_loc_changed || 0),
    prNumber: pr.number,
    prTitle: pr.title,
    prUrl: pr.html_url,
    prCreatedAt: pr.created_at,
    prMergedAt: pr.merged_at,
    timeToMergeMs: timeToMergeMs,
    jiraTicket: jiraTicket,
    jiraData: jiraData,
    analytics: analytics,
    metrics: {
      tokensPerLOC: tokensPerLOC,
      costPerLOC: analytics.totalCost / parseInt(latestCommit.total_loc_changed || 1),
      tokensPerStoryPoint: tokensPerStoryPoint,
      costPerStoryPoint: costPerStoryPoint,
    },
  });
});

if (linkedData.length === 0) {
  console.log('No merged PRs found in analytics data.');
  console.log('Work on the repository and merge PRs to generate metrics.');
  process.exit(0);
}

// ============================================================================
// AGGREGATE BY JIRA TICKET
// ============================================================================

console.log('='.repeat(80));
console.log('Aggregating by JIRA Ticket');
console.log('='.repeat(80));
console.log();

const ticketAggregates = {};

linkedData.forEach(record => {
  if (!record.jiraTicket) return;

  const ticket = record.jiraTicket;

  if (!ticketAggregates[ticket]) {
    ticketAggregates[ticket] = {
      jiraTicket: ticket,
      jiraData: record.jiraData,
      sessions: [],
      totalTokens: 0,
      totalCost: 0,
      totalLOC: 0,
      totalDurationMs: 0,
      commits: [],
      prs: [],
    };
  }

  const agg = ticketAggregates[ticket];

  agg.sessions.push(record.sessionId);
  agg.totalTokens += record.analytics.totalTokens;
  agg.totalCost += record.analytics.totalCost;
  agg.totalLOC += record.totalLOC;
  agg.totalDurationMs += record.analytics.durationMs;

  if (!agg.commits.includes(record.commitSha)) {
    agg.commits.push(record.commitSha);
  }

  if (!agg.prs.find(p => p.number === record.prNumber)) {
    agg.prs.push({
      number: record.prNumber,
      title: record.prTitle,
      mergedAt: record.prMergedAt,
    });
  }
});

// Calculate aggregate metrics
Object.values(ticketAggregates).forEach(agg => {
  agg.tokensPerLOC = agg.totalLOC > 0 ? agg.totalTokens / agg.totalLOC : 0;
  agg.costPerLOC = agg.totalLOC > 0 ? agg.totalCost / agg.totalLOC : 0;

  if (agg.jiraData && agg.jiraData.storyPoints && agg.jiraData.storyPoints > 0) {
    agg.tokensPerStoryPoint = agg.totalTokens / agg.jiraData.storyPoints;
    agg.costPerStoryPoint = agg.totalCost / agg.jiraData.storyPoints;
    agg.durationPerStoryPoint = agg.totalDurationMs / agg.jiraData.storyPoints;
  }
});

// ============================================================================
// SAVE OUTPUT
// ============================================================================

const output = {
  generatedAt: new Date().toISOString(),
  repository: CONFIG.REPO,
  summary: {
    totalSessions: linkedData.length,
    uniqueTickets: Object.keys(ticketAggregates).length,
    totalTokens: linkedData.reduce((sum, r) => sum + r.analytics.totalTokens, 0),
    totalCost: linkedData.reduce((sum, r) => sum + r.analytics.totalCost, 0),
    totalLOC: linkedData.reduce((sum, r) => sum + r.totalLOC, 0),
  },
  sessionLevel: linkedData,
  ticketLevel: Object.values(ticketAggregates),
};

fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`✓ Report saved to: ${CONFIG.OUTPUT_FILE}`);
console.log();

// ============================================================================
// SUMMARY REPORT
// ============================================================================

console.log('='.repeat(80));
console.log('COMPREHENSIVE METRICS SUMMARY');
console.log('='.repeat(80));
console.log();

console.log('OVERALL:');
console.log(`  Merged PRs analyzed: ${linkedData.length}`);
console.log(`  Total tokens: ${output.summary.totalTokens.toLocaleString()}`);
console.log(`  Total cost: $${output.summary.totalCost.toFixed(2)}`);
console.log(`  Total LOC changed: ${output.summary.totalLOC.toLocaleString()}`);
console.log();

const avgTokensPerLOC = output.summary.totalTokens / output.summary.totalLOC;
const avgCostPerLOC = output.summary.totalCost / output.summary.totalLOC;

console.log('TOKENS PER LINE OF CODE (Merged PRs Only):');
console.log(`  Average: ${avgTokensPerLOC.toFixed(2)} tokens/LOC`);
console.log(`  Average cost: $${avgCostPerLOC.toFixed(4)} per LOC`);
console.log();

// Sort by tokens/LOC
linkedData.sort((a, b) => b.metrics.tokensPerLOC - a.metrics.tokensPerLOC);

console.log('Most Token-Intensive PRs (per LOC):');
linkedData.slice(0, 3).forEach((r, i) => {
  console.log(`  ${i + 1}. PR #${r.prNumber} - ${r.metrics.tokensPerLOC.toFixed(2)} tokens/LOC`);
  console.log(`     ${r.prTitle}`);
  console.log(`     ${r.totalLOC} LOC changed, ${r.analytics.totalTokens.toLocaleString()} tokens`);
});
console.log();

console.log('Most Efficient PRs (per LOC):');
linkedData.slice(-3).reverse().forEach((r, i) => {
  console.log(`  ${i + 1}. PR #${r.prNumber} - ${r.metrics.tokensPerLOC.toFixed(2)} tokens/LOC`);
  console.log(`     ${r.prTitle}`);
  console.log(`     ${r.totalLOC} LOC changed, ${r.analytics.totalTokens.toLocaleString()} tokens`);
});
console.log();

// Story point metrics
const ticketsWithSP = Object.values(ticketAggregates).filter(
  t => t.jiraData && t.jiraData.storyPoints
);

if (ticketsWithSP.length > 0) {
  const avgTokensPerSP = ticketsWithSP.reduce((sum, t) => sum + t.tokensPerStoryPoint, 0) / ticketsWithSP.length;
  const avgCostPerSP = ticketsWithSP.reduce((sum, t) => sum + t.costPerStoryPoint, 0) / ticketsWithSP.length;
  const avgDurationPerSP = ticketsWithSP.reduce((sum, t) => sum + t.durationPerStoryPoint, 0) / ticketsWithSP.length;

  console.log('TOKENS PER STORY POINT (JIRA):');
  console.log(`  Tickets with story points: ${ticketsWithSP.length}`);
  console.log(`  Average tokens/SP: ${avgTokensPerSP.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
  console.log(`  Average cost/SP: $${avgCostPerSP.toFixed(2)}`);
  console.log(`  Average duration/SP: ${formatDuration(avgDurationPerSP)}`);
  console.log();

  ticketsWithSP.sort((a, b) => b.tokensPerStoryPoint - a.tokensPerStoryPoint);

  console.log('Most Token-Intensive Tickets:');
  ticketsWithSP.slice(0, 3).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.jiraTicket} (${t.jiraData.storyPoints} SP)`);
    console.log(`     ${t.tokensPerStoryPoint.toLocaleString(undefined, {maximumFractionDigits: 0})} tokens/SP, $${t.costPerStoryPoint.toFixed(2)}/SP`);
    console.log(`     ${t.sessions.length} session(s), ${t.totalLOC} LOC`);
  });
  console.log();
}

// Time to merge metrics
const avgTimeToMerge = linkedData.reduce((sum, r) => sum + r.timeToMergeMs, 0) / linkedData.length;

console.log('TIME TO PASS PR:');
console.log(`  Average time to merge: ${formatDuration(avgTimeToMerge)}`);
console.log();

linkedData.sort((a, b) => a.timeToMergeMs - b.timeToMergeMs);

console.log('Fastest PRs to merge:');
linkedData.slice(0, 3).forEach((r, i) => {
  console.log(`  ${i + 1}. PR #${r.prNumber} - ${formatDuration(r.timeToMergeMs)}`);
  console.log(`     ${r.prTitle}`);
});
console.log();

console.log('='.repeat(80));
