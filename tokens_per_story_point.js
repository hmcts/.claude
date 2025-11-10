#!/usr/bin/env node

/**
 * Calculate tokens used per story point for JIRA tickets
 *
 * This script:
 * 1. Reads costs.csv and sessions.csv
 * 2. Links sessions → commits → PRs → JIRA tickets
 * 3. Fetches story points from JIRA
 * 4. Calculates tokens per story point
 *
 * Usage: node tokens_per_story_point.js [--repo owner/repo] [--days N]
 * Example: node tokens_per_story_point.js --repo hmcts/pip-frontend --days 30
 *
 * Requires:
 * - GITHUB_TOKEN environment variable
 * - JIRA_PERSONAL_TOKEN environment variable
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const CONFIG = {
  ANALYTICS_DIR: path.join(process.cwd(), '.claude/analytics'),
  GITHUB_API_HOST: 'api.github.com',
  JIRA_HOST: 'tools.hmcts.net',
  JIRA_BASE_PATH: '/jira',
  DEFAULT_REPO: 'hmcts/pip-frontend',
  DEFAULT_DAYS: 30,
};

// Parse command line arguments
const args = process.argv.slice(2);
let targetRepo = CONFIG.DEFAULT_REPO;
let daysBack = CONFIG.DEFAULT_DAYS;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repo' && args[i + 1]) {
    targetRepo = args[i + 1];
    i++;
  } else if (args[i] === '--days' && args[i + 1]) {
    daysBack = parseInt(args[i + 1]);
    i++;
  }
}

// Check for required tokens
const githubToken = process.env.GITHUB_TOKEN;
const jiraToken = process.env.JIRA_PERSONAL_TOKEN;

if (!githubToken) {
  console.error('Error: GITHUB_TOKEN environment variable not set');
  console.error('Get a token at: https://github.com/settings/tokens/new?scopes=repo');
  process.exit(1);
}

if (!jiraToken) {
  console.error('Error: JIRA_PERSONAL_TOKEN environment variable not set');
  console.error('Get a token at: https://tools.hmcts.net/jira/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('Tokens Per Story Point Calculator');
console.log('='.repeat(80));
console.log(`Repository: ${targetRepo}`);
console.log(`Time Range: Last ${daysBack} days`);
console.log();

// Read and parse CSV file
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip duplicate headers
    if (line === lines[0]) continue;

    // Skip duplicate rows
    if (seen.has(line)) continue;
    seen.add(line);

    const values = line.split(',');
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : '';
    });

    data.push(row);
  }

  return data;
}

// Make GitHub API request
function makeGitHubRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.GITHUB_API_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'Claude-Code-Analytics',
        'Accept': 'application/vnd.github.v3+json',
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
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
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

// Get PR for a commit
async function getPRForCommit(repo, commitSha) {
  try {
    const path = `/repos/${repo}/commits/${commitSha}/pulls`;
    const prs = await makeGitHubRequest(path);
    return prs && prs.length > 0 ? prs[0] : null;
  } catch (error) {
    console.error(`  Error getting PR for commit ${commitSha}: ${error.message}`);
    return null;
  }
}

// Get story points for JIRA ticket
async function getStoryPoints(ticketId) {
  try {
    const path = `${CONFIG.JIRA_BASE_PATH}/rest/api/2/issue/${ticketId}?fields=customfield_10004,summary`;
    const issue = await makeJiraRequest(path);

    return {
      storyPoints: issue.fields.customfield_10004 || 0,
      summary: issue.fields.summary || '',
    };
  } catch (error) {
    console.error(`  Error getting story points for ${ticketId}: ${error.message}`);
    return { storyPoints: 0, summary: '' };
  }
}

// Main processing
async function main() {
  console.log('Step 1: Reading CSV files...');

  const costsPath = path.join(CONFIG.ANALYTICS_DIR, 'costs.csv');
  const sessionsPath = path.join(CONFIG.ANALYTICS_DIR, 'sessions.csv');

  if (!fs.existsSync(costsPath)) {
    console.error(`Error: ${costsPath} not found`);
    process.exit(1);
  }

  if (!fs.existsSync(sessionsPath)) {
    console.error(`Error: ${sessionsPath} not found`);
    process.exit(1);
  }

  const costs = readCSV(costsPath);
  const sessions = readCSV(sessionsPath);

  console.log(`  Found ${costs.length} cost records`);
  console.log(`  Found ${sessions.length} session records`);
  console.log();

  // Step 2: Sum tokens per session
  console.log('Step 2: Calculating tokens per session...');
  const sessionTokens = {};

  costs.forEach(row => {
    const sessionId = row.session_id;
    const tokens = parseInt(row.total_tokens || 0);

    if (!sessionTokens[sessionId]) {
      sessionTokens[sessionId] = 0;
    }
    sessionTokens[sessionId] += tokens;
  });

  console.log(`  Calculated tokens for ${Object.keys(sessionTokens).length} sessions`);
  console.log();

  // Step 3: Filter sessions by repo and time range
  console.log('Step 3: Filtering sessions by repo and time range...');
  const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

  const filteredSessions = sessions.filter(session => {
    const repoUrl = session.repo_url || '';
    const repoName = session.repo_name || '';
    const timestamp = parseInt(session.started_at || 0);

    const matchesRepo = repoUrl.includes(targetRepo) || repoName === targetRepo.split('/')[1];
    const matchesTime = timestamp >= cutoffDate;

    return matchesRepo && matchesTime;
  });

  console.log(`  ${filteredSessions.length} sessions match criteria`);
  console.log();

  // Step 4: Group by commit and link to PRs
  console.log('Step 4: Linking commits to PRs and JIRA tickets...');
  const commitData = {};

  for (const session of filteredSessions) {
    const commitSha = session.head_commit;
    const sessionId = session.session_id;
    const tokens = sessionTokens[sessionId] || 0;

    if (!commitSha || commitSha === 'unknown') continue;

    if (!commitData[commitSha]) {
      commitData[commitSha] = {
        totalTokens: 0,
        sessions: [],
        pr: null,
        jiraTicket: null,
      };
    }

    commitData[commitSha].totalTokens += tokens;
    commitData[commitSha].sessions.push(sessionId);
  }

  console.log(`  Found ${Object.keys(commitData).length} unique commits`);
  console.log();

  // Step 5: Get PRs and JIRA tickets
  console.log('Step 5: Fetching PR and JIRA data...');
  const prData = {};
  let processedCommits = 0;

  for (const [commitSha, data] of Object.entries(commitData)) {
    processedCommits++;
    process.stdout.write(`\r  Progress: ${processedCommits}/${Object.keys(commitData).length} commits`);

    const pr = await getPRForCommit(targetRepo, commitSha);

    if (pr) {
      const jiraTicket = extractJiraTicket(pr.title) || extractJiraTicket(pr.body);

      if (jiraTicket) {
        if (!prData[pr.number]) {
          prData[pr.number] = {
            title: pr.title,
            jiraTicket: jiraTicket,
            totalTokens: 0,
            commits: [],
          };
        }

        prData[pr.number].totalTokens += data.totalTokens;
        prData[pr.number].commits.push(commitSha);
      }
    }

    // Rate limiting - be nice to GitHub API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(); // New line after progress
  console.log(`  Found ${Object.keys(prData).length} PRs with JIRA tickets`);
  console.log();

  // Step 6: Get story points from JIRA
  console.log('Step 6: Fetching story points from JIRA...');
  const ticketData = {};

  for (const [prNumber, data] of Object.entries(prData)) {
    const jiraTicket = data.jiraTicket;

    if (!ticketData[jiraTicket]) {
      const jiraData = await getStoryPoints(jiraTicket);

      ticketData[jiraTicket] = {
        storyPoints: jiraData.storyPoints,
        summary: jiraData.summary,
        totalTokens: 0,
        prs: [],
      };

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    ticketData[jiraTicket].totalTokens += data.totalTokens;
    ticketData[jiraTicket].prs.push({ number: prNumber, title: data.title });
  }

  console.log(`  Found ${Object.keys(ticketData).length} unique JIRA tickets`);
  console.log();

  // Step 7: Calculate and display results
  console.log('='.repeat(80));
  console.log('RESULTS: Tokens Per Story Point');
  console.log('='.repeat(80));
  console.log();

  const results = [];
  let totalTokens = 0;
  let totalStoryPoints = 0;

  for (const [ticketId, data] of Object.entries(ticketData)) {
    if (data.storyPoints > 0) {
      const tokensPerPoint = data.totalTokens / data.storyPoints;

      results.push({
        ticketId,
        summary: data.summary,
        storyPoints: data.storyPoints,
        totalTokens: data.totalTokens,
        tokensPerPoint,
        prs: data.prs,
      });

      totalTokens += data.totalTokens;
      totalStoryPoints += data.storyPoints;
    }
  }

  // Sort by tokens per point (descending)
  results.sort((a, b) => b.tokensPerPoint - a.tokensPerPoint);

  // Display individual tickets
  console.log('Individual Tickets:');
  console.log('-'.repeat(80));

  results.forEach(result => {
    console.log();
    console.log(`${result.ticketId}: ${result.summary}`);
    console.log(`  Story Points: ${result.storyPoints}`);
    console.log(`  Total Tokens: ${result.totalTokens.toLocaleString()}`);
    console.log(`  Tokens/Point: ${Math.round(result.tokensPerPoint).toLocaleString()}`);
    console.log(`  PRs: ${result.prs.map(pr => `#${pr.number}`).join(', ')}`);
  });

  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total Tickets Analyzed: ${results.length}`);
  console.log(`Total Story Points: ${totalStoryPoints}`);
  console.log(`Total Tokens Used: ${totalTokens.toLocaleString()}`);
  console.log();
  console.log(`Average Tokens Per Story Point: ${Math.round(totalTokens / totalStoryPoints).toLocaleString()}`);
  console.log();

  // Breakdown by story point size
  const bySize = {};
  results.forEach(r => {
    if (!bySize[r.storyPoints]) {
      bySize[r.storyPoints] = { count: 0, totalTokens: 0 };
    }
    bySize[r.storyPoints].count++;
    bySize[r.storyPoints].totalTokens += r.totalTokens;
  });

  console.log('Breakdown by Story Point Size:');
  console.log('-'.repeat(80));
  Object.keys(bySize).sort((a, b) => a - b).forEach(size => {
    const data = bySize[size];
    const avgTokens = Math.round(data.totalTokens / data.count);
    const avgPerPoint = Math.round(avgTokens / parseInt(size));
    console.log(`  ${size} points: ${data.count} tickets, avg ${avgTokens.toLocaleString()} tokens (${avgPerPoint.toLocaleString()} tokens/point)`);
  });

  console.log();
  console.log('='.repeat(80));
}

// Run the script
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
