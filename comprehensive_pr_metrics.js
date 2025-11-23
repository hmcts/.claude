#!/usr/bin/env node

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
  PROJECT_KEY: 'hmcts.cath',
  SONAR_TOKEN: process.env.SONAR_TOKEN,
  JIRA_TOKEN: process.env.JIRA_TOKEN,
  JIRA_BOARD_ID: '3111',
  BEDROCK_COSTS_FILE: __dirname + '/bedrock-costs.csv',
  METRICS: 'coverage,vulnerabilities,duplicated_lines_density,sqale_rating,reliability_rating,security_rating,bugs,code_smells',
  MAX_PRS: 100,
  // Exclude closed tickets without story points (admin/setup tasks)
  EXCLUDED_TICKETS: [
    'VIBE-207',  // Create Court in CaTH
    'VIBE-163',  // Preparation for Sprint 2- Cadence
    'VIBE-164',  // Create Backlog Items for cath rewrite commencement
    'VIBE-165',  // Prepare licences for Cath rewrite
    'VIBE-170',  // Find content to remove
    'VIBE-171',  // Select content to remove
    'VIBE-172',  // Are you sure you want to remove this content?
    'VIBE-173',  // File Removal Successful
    'VIBE-176',  // Verified user- Account creation Confirmation
    'VIBE-182',  // API connection in CaTH
    'VIBE-193',  // Verified User – How do you want to add an email subscription
    'VIBE-194',  // Verified User – How do you want to add an email subscription
    'VIBE-197',  // Verified User – Select list type
    'VIBE-198',  // Verified User – What version of the list do you want to receive?
    'VIBE-211',  // Display of Pubs - What do you want to do?
    'VIBE-212',  // Display of Pubs -  What court or tribunal are you interested in?
    'VIBE-213',  // Display of Pubs - Find a court or tribunal
    'VIBE-217',  // Error handling for Json-HTML Conversion (Suggested by AI)
    'VIBE-218',  // JSON Validation Schema and Style Guide Integration Specification (Suggested by AI)
  ],
};

// Exclude specific developers (infrastructure/setup work)
const EXCLUDED_DEVELOPERS = [
  'linosnort',
  'linus-norton',
  'linusnorton'
];

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
 * Check if PR is a dependency update
 */
function isDependencyUpdate(title) {
  if (!title) return false;
  const lowerTitle = title.toLowerCase();
  return lowerTitle.includes('update dependency') ||
         lowerTitle.includes('update prisma') ||
         lowerTitle.includes('update vitest') ||
         lowerTitle.includes('update node.js') ||
         lowerTitle.includes('update github') ||
         lowerTitle.includes('update actions/');
}

/**
 * Check if PR is for an excluded ticket
 */
function isExcludedTicket(title) {
  if (!title) return false;
  return CONFIG.EXCLUDED_TICKETS.some(ticket => title.includes(ticket));
}

/**
 * Extract ticket ID from PR title (e.g., "VIBE-123 Add feature" -> "VIBE-123")
 */
function extractTicketId(title) {
  if (!title) return null;
  const match = title.match(/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch SonarCloud metrics for a PR
 */
function fetchSonarMetrics(prNumber) {
  if (!CONFIG.SONAR_TOKEN) {
    return null;
  }

  try {
    const url = `https://sonarcloud.io/api/measures/component?component=${CONFIG.PROJECT_KEY}&pullRequest=${prNumber}&metricKeys=${CONFIG.METRICS}`;
    const response = execSync(`curl -s -u "${CONFIG.SONAR_TOKEN}:" "${url}"`, { encoding: 'utf8' });

    if (!response || !response.trim()) {
      return null;
    }

    const data = JSON.parse(response);

    if (data.component && data.component.measures) {
      const metrics = {};
      data.component.measures.forEach(measure => {
        metrics[measure.metric] = parseFloat(measure.value);
      });
      return metrics;
    }
    return null;
  } catch (error) {
    // Silently fail for missing SonarCloud data
    return null;
  }
}

/**
 * Fetch PR details including comments and LOC changes
 */
function fetchPRDetails(prNumber) {
  try {
    const prJson = execSync(`gh pr view ${prNumber} --repo ${CONFIG.REPO} --json number,title,author,comments,reviews,state,additions,deletions`, { encoding: 'utf8' });
    return JSON.parse(prJson);
  } catch (error) {
    console.error(`Error fetching PR details for #${prNumber}:`, error.message);
    return null;
  }
}

/**
 * Count developer comments (excluding bots)
 */
function countDeveloperComments(pr) {
  // Filter out bot comments
  const developerComments = pr.comments.filter(comment => !comment.author.is_bot);

  // Filter out bot reviews and count review comments
  const developerReviews = pr.reviews ? pr.reviews.filter(review => !review.author.is_bot) : [];
  let reviewCommentCount = 0;
  developerReviews.forEach(review => {
    if (review.body && review.body.trim()) {
      reviewCommentCount++;
    }
  });

  return {
    issueComments: developerComments.length,
    reviewComments: reviewCommentCount,
    total: developerComments.length + reviewCommentCount
  };
}

/**
 * Fetch story points for PRs by extracting ticket IDs and querying JIRA
 * This aligns story points with the same PRs used for all other metrics
 */
function fetchStoryPointsForPRs(prs) {
  try {
    const ticketsWithSP = [];
    let totalSP = 0;

    for (const pr of prs) {
      // Extract ticket ID from PR title or body
      const ticketId = extractJiraTicket(pr.title) || extractJiraTicket(pr.body);

      if (!ticketId) {
        continue; // No ticket, skip (tech debt, non-story-pointed work)
      }

      try {
        // Fetch ticket details from JIRA (just story points field)
        const url = `https://tools.hmcts.net/jira/rest/api/2/issue/${ticketId}?fields=customfield_10004,summary,status`;
        const response = execSync(`curl -s -H "Authorization: Bearer ${CONFIG.JIRA_TOKEN}" "${url}"`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        const data = JSON.parse(response);

        const storyPoints = data.fields?.customfield_10004;

        if (storyPoints) {
          ticketsWithSP.push({
            key: ticketId,
            storyPoints: storyPoints,
            prNumber: pr.number,
            status: data.fields?.status?.name,
            summary: data.fields?.summary
          });
          totalSP += storyPoints;
        }

        // Rate limiting: small delay between API calls
        execSync('sleep 0.1');
      } catch (ticketError) {
        console.error(`  Warning: Could not fetch ticket ${ticketId}`);
      }
    }

    return { tickets: ticketsWithSP, totalSP };
  } catch (error) {
    console.error('Error fetching story points for PRs:', error.message);
    return { tickets: [], totalSP: 0 };
  }
}

/**
 * Parse Bedrock costs CSV and get total for date range
 */
function getBedrockCosts(startDate, endDate) {
  try {
    const fs = require('fs');
    if (!fs.existsSync(CONFIG.BEDROCK_COSTS_FILE)) {
      return null;
    }

    const csvContent = fs.readFileSync(CONFIG.BEDROCK_COSTS_FILE, 'utf8');
    const lines = csvContent.trim().split('\n');

    let totalCost = 0;
    let daysFound = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split('\t');
      const dateStr = columns[0];
      const costStr = columns[columns.length - 1];

      if (!dateStr || dateStr.length < 10) continue;

      const rowDate = new Date(dateStr);

      if (rowDate >= startDate && rowDate <= endDate) {
        const cost = parseFloat(costStr) || 0;
        totalCost += cost;
        daysFound++;
      }
    }

    return { totalCost, daysFound };
  } catch (error) {
    console.error('Error reading Bedrock costs:', error.message);
    return null;
  }
}

/**
 * Parse Bedrock costs CSV and get detailed breakdown for date range
 */
function getBedrockCostsDetailed(startDate, endDate) {
  try {
    const fs = require('fs');
    if (!fs.existsSync(CONFIG.BEDROCK_COSTS_FILE)) {
      return null;
    }

    const csvContent = fs.readFileSync(CONFIG.BEDROCK_COSTS_FILE, 'utf8');
    const lines = csvContent.trim().split('\n');

    // Parse header to get column names
    const header = lines[0].split('\t');

    const breakdown = {
      sonnet45: 0,
      haiku: 0,
      infrastructure: 0,
      totalCost: 0,
      daysFound: 0,
      details: {}
    };

    // Initialize all columns
    header.forEach(col => {
      breakdown.details[col] = 0;
    });

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split('\t');
      const dateStr = columns[0];

      if (!dateStr || dateStr.length < 10) continue;

      const rowDate = new Date(dateStr);

      if (rowDate >= startDate && rowDate <= endDate) {
        // Column 1: Sonnet 4.5
        const sonnetCost = parseFloat(columns[1]) || 0;
        breakdown.sonnet45 += sonnetCost;

        // Column 2: Haiku
        const haikuCost = parseFloat(columns[2]) || 0;
        breakdown.haiku += haikuCost;

        // Remaining columns: Infrastructure
        let infraCost = 0;
        for (let j = 3; j < columns.length - 1; j++) {
          const cost = parseFloat(columns[j]) || 0;
          infraCost += cost;
          breakdown.details[header[j]] = (breakdown.details[header[j]] || 0) + cost;
        }
        breakdown.infrastructure += infraCost;

        // Total
        const totalCost = parseFloat(columns[columns.length - 1]) || 0;
        breakdown.totalCost += totalCost;
        breakdown.daysFound++;
      }
    }

    return breakdown;
  } catch (error) {
    console.error('Error reading detailed Bedrock costs:', error.message);
    return null;
  }
}

/**
 * Fetch story points for specific ticket IDs
 */
function fetchStoryPointsForTickets(ticketIds) {
  if (!ticketIds || ticketIds.length === 0) {
    return {};
  }

  const ticketMap = {};

  ticketIds.forEach(ticketId => {
    try {
      const url = `https://tools.hmcts.net/jira/rest/api/2/issue/${ticketId}?fields=customfield_10004,summary,status`;
      const response = execSync(`curl -s -H "Authorization: Bearer ${CONFIG.JIRA_TOKEN}" "${url}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      const data = JSON.parse(response);

      if (data && data.fields && data.fields.customfield_10004) {
        ticketMap[ticketId] = {
          storyPoints: data.fields.customfield_10004,
          summary: data.fields.summary,
          status: data.fields.status.name
        };
      }
    } catch (error) {
      // Ticket not found or error, skip
    }
  });

  return ticketMap;
}

/**
 * Get ticket status at a specific date by looking at changelog
 */
function getTicketStatusAtDate(ticketId, targetDate) {
  try {
    const url = `https://tools.hmcts.net/jira/rest/api/2/issue/${ticketId}?expand=changelog&fields=customfield_10004,summary,status`;
    const response = execSync(`curl -s -H "Authorization: Bearer ${CONFIG.JIRA_TOKEN}" "${url}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    const data = JSON.parse(response);

    if (!data || !data.fields || !data.fields.customfield_10004) {
      return null;
    }

    let statusAtDate = null;

    // Work backwards through changelog to find status at target date
    if (data.changelog && data.changelog.histories) {
      // Sort histories by date (oldest first)
      const sortedHistories = data.changelog.histories.sort((a, b) =>
        new Date(a.created) - new Date(b.created)
      );

      // Find all status changes up to target date
      for (const history of sortedHistories) {
        const historyDate = new Date(history.created);

        // Only look at changes that happened before or on target date
        if (historyDate <= targetDate) {
          const statusChange = history.items.find(item => item.field === 'status');
          if (statusChange) {
            statusAtDate = statusChange.toString;
          }
        }
      }
    }

    // If no status changes found before target date, ticket might not have existed or was in initial status
    if (!statusAtDate && data.fields.created) {
      const createdDate = new Date(data.fields.created);
      if (createdDate <= targetDate) {
        // Ticket existed but no status changes yet - use current status as approximation
        // or assume it was in initial state
        statusAtDate = 'To Do'; // Default initial status
      }
    }

    // If still no status and ticket exists, use current status
    if (!statusAtDate && data.fields.status) {
      statusAtDate = data.fields.status.name;
    }

    return {
      ticketId: ticketId,
      storyPoints: data.fields.customfield_10004,
      summary: data.fields.summary,
      statusAtDate: statusAtDate,
      currentStatus: data.fields.status.name
    };
  } catch (error) {
    return null;
  }
}

// ============================================================================
// PARSE COMMAND LINE ARGUMENTS
// ============================================================================

const args = process.argv.slice(2);
let startDateStr = '2025-10-07';
let endDateStr = '2025-11-11';

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--start' || args[i] === '-s') && args[i + 1]) {
    startDateStr = args[i + 1];
    i++;
  } else if ((args[i] === '--end' || args[i] === '-e') && args[i + 1]) {
    endDateStr = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: node comprehensive_pr_metrics.js [options]');
    console.log();
    console.log('Options:');
    console.log('  --start, -s <date>   Start date (YYYY-MM-DD) [default: 2025-10-07]');
    console.log('  --end, -e <date>     End date (YYYY-MM-DD) [default: 2025-11-11]');
    console.log('  --help, -h           Show this help message');
    console.log();
    console.log('Example:');
    console.log('  node comprehensive_pr_metrics.js --start 2025-10-01 --end 2025-10-31');
    process.exit(0);
  }
}

// Validate and parse dates
const ANALYSIS_START = new Date(startDateStr + 'T00:00:00Z');
const ANALYSIS_END = new Date(endDateStr + 'T23:59:59Z');

if (isNaN(ANALYSIS_START.getTime()) || isNaN(ANALYSIS_END.getTime())) {
  console.error('Error: Invalid date format. Please use YYYY-MM-DD');
  console.error('Example: node comprehensive_pr_metrics.js --start 2025-10-01 --end 2025-10-31');
  process.exit(1);
}

if (ANALYSIS_START > ANALYSIS_END) {
  console.error('Error: Start date must be before end date');
  process.exit(1);
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

console.log('='.repeat(80));
console.log('Comprehensive PR Metrics Analysis');
console.log(`Repository: ${CONFIG.REPO}`);
console.log(`Period: ${ANALYSIS_START.toISOString().split('T')[0]} to ${ANALYSIS_END.toISOString().split('T')[0]}`);
console.log('='.repeat(80));
console.log();

console.log('Fetching PRs from GitHub...');
// Use date-based search to get ALL PRs in the analysis period (not just last 100)
const searchQuery = `created:>=${ANALYSIS_START.toISOString().split('T')[0]}`;
const prListJson = execSync(`gh pr list --repo ${CONFIG.REPO} --search "${searchQuery}" --limit 500 --json number,title,state,author,createdAt,mergedAt --state all`, { encoding: 'utf8' });
const allPRs = JSON.parse(prListJson);

console.log(`Total PRs found: ${allPRs.length}`);
console.log();

// Filter by date range - use created date only to measure development productivity
const dateFilteredPRs = allPRs.filter(pr => {
  const createdAt = pr.createdAt ? new Date(pr.createdAt) : null;
  const createdInRange = createdAt && createdAt >= ANALYSIS_START && createdAt <= ANALYSIS_END;

  return createdInRange;
});

console.log(`PRs in analysis period: ${dateFilteredPRs.length}`);
console.log();

// Filter out bot PRs, dependency updates, excluded tickets, and excluded developers
const featurePRs = dateFilteredPRs.filter(pr => {
  // Skip bot PRs
  if (pr.author && pr.author.is_bot) {
    return false;
  }

  // Skip dependency updates
  if (isDependencyUpdate(pr.title)) {
    return false;
  }

  // Skip excluded tickets (closed without story points)
  if (isExcludedTicket(pr.title)) {
    return false;
  }

  // Skip excluded developers (infrastructure/setup work)
  if (pr.author && EXCLUDED_DEVELOPERS.some(
    excluded => pr.author.login.toLowerCase().includes(excluded)
  )) {
    return false;
  }

  // Only include merged PRs (to measure delivered work)
  return pr.state === 'MERGED';
});

console.log(`Feature PRs (excluding bots and dependencies): ${featurePRs.length}`);
console.log();

// Initialize metric accumulators
const metrics = {
  coverage: [],
  vulnerabilities: [],
  duplicated_lines_density: [],
  sqale_rating: [],
  reliability_rating: [],
  security_rating: [],
  bugs: [],
  code_smells: []
};

const commentCounts = [];
const prDetails = [];

// Fetch metrics for each feature PR
console.log('Fetching SonarCloud metrics and PR details...');
let progressCount = 0;

featurePRs.forEach(pr => {
  progressCount++;
  process.stdout.write(`\rProcessing PR ${progressCount}/${featurePRs.length}...`);

  // Fetch Sonar metrics
  const sonarMetrics = fetchSonarMetrics(pr.number);
  if (sonarMetrics) {
    Object.keys(metrics).forEach(metricKey => {
      if (sonarMetrics[metricKey] !== undefined) {
        metrics[metricKey].push(sonarMetrics[metricKey]);
      }
    });
  }

  // Fetch PR details for comments and LOC
  const prDetail = fetchPRDetails(pr.number);
  if (prDetail) {
    const comments = countDeveloperComments(prDetail);
    commentCounts.push({
      number: pr.number,
      title: pr.title,
      ...comments
    });

    const additions = prDetail.additions || 0;
    const deletions = prDetail.deletions || 0;
    const totalLOC = additions + deletions;

    prDetails.push({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      comments: comments.total,
      hasCoverage: sonarMetrics && sonarMetrics.coverage !== undefined,
      coverage: sonarMetrics ? sonarMetrics.coverage : null,
      additions: additions,
      deletions: deletions,
      totalLOC: totalLOC,
      ticketId: extractTicketId(pr.title),
      createdAt: pr.createdAt
    });
  }

  // Small delay to avoid rate limiting
  execSync('sleep 0.3');
});

console.log('\n');

// Calculate averages
const averages = {};
for (const [key, values] of Object.entries(metrics)) {
  if (values.length > 0) {
    const sum = values.reduce((a, b) => a + b, 0);
    averages[key] = {
      average: sum / values.length,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  } else {
    averages[key] = {
      average: null,
      count: 0,
      min: null,
      max: null
    };
  }
}

// Calculate comment averages
const avgComments = commentCounts.length > 0
  ? commentCounts.reduce((sum, pr) => sum + pr.total, 0) / commentCounts.length
  : 0;

// ============================================================================
// REPORT
// ============================================================================

console.log('='.repeat(80));
console.log('ANALYSIS SUMMARY');
console.log('='.repeat(80));
console.log();
console.log(`Total PRs in repository: ${allPRs.length}`);
console.log(`PRs in analysis period: ${dateFilteredPRs.length}`);
const botPRs = dateFilteredPRs.filter(pr => pr.author && pr.author.is_bot).length;
const dependencyPRs = dateFilteredPRs.filter(pr => !pr.author?.is_bot && isDependencyUpdate(pr.title)).length;
console.log(`Bot PRs excluded: ${botPRs}`);
console.log(`Dependency update PRs excluded: ${dependencyPRs}`);
console.log(`Feature PRs analyzed: ${featurePRs.length}`);
console.log();

console.log('='.repeat(80));
console.log('SONARQUBE QUALITY METRICS');
console.log('='.repeat(80));
console.log();

console.log('Test Coverage:');
console.log(`  Average: ${averages.coverage.average?.toFixed(2)}%`);
console.log(`  Range: ${averages.coverage.min}% - ${averages.coverage.max}%`);
console.log(`  PRs with coverage data: ${averages.coverage.count}`);
console.log();

console.log('CVEs (Vulnerabilities):');
console.log(`  Average: ${averages.vulnerabilities.average?.toFixed(2)}`);
console.log(`  Range: ${averages.vulnerabilities.min} - ${averages.vulnerabilities.max}`);
console.log(`  PRs analyzed: ${averages.vulnerabilities.count}`);
console.log();

console.log('Duplicated Lines:');
console.log(`  Average: ${averages.duplicated_lines_density.average?.toFixed(2)}%`);
console.log(`  Range: ${averages.duplicated_lines_density.min}% - ${averages.duplicated_lines_density.max}%`);
console.log(`  PRs analyzed: ${averages.duplicated_lines_density.count}`);
console.log();

console.log('Maintainability Rating:');
console.log(`  Average: ${averages.sqale_rating.average?.toFixed(2)} (1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E)`);
console.log(`  Range: ${averages.sqale_rating.min} - ${averages.sqale_rating.max}`);
console.log(`  PRs analyzed: ${averages.sqale_rating.count}`);
console.log();

console.log('Reliability Rating:');
console.log(`  Average: ${averages.reliability_rating.average?.toFixed(2)} (1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E)`);
console.log(`  Range: ${averages.reliability_rating.min} - ${averages.reliability_rating.max}`);
console.log(`  PRs analyzed: ${averages.reliability_rating.count}`);
console.log();

console.log('Security Rating:');
console.log(`  Average: ${averages.security_rating.average?.toFixed(2)} (1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E)`);
console.log(`  Range: ${averages.security_rating.min} - ${averages.security_rating.max}`);
console.log(`  PRs analyzed: ${averages.security_rating.count}`);
console.log();

console.log('Additional Metrics:');
console.log(`  Bugs: ${averages.bugs.average?.toFixed(2)} average`);
console.log(`  Code Smells: ${averages.code_smells.average?.toFixed(2)} average`);
console.log();

console.log('='.repeat(80));
console.log('DEVELOPER ENGAGEMENT METRICS');
console.log('='.repeat(80));
console.log();

console.log(`Average Developer Comments per PR: ${avgComments.toFixed(2)}`);
console.log(`  Total PRs analyzed: ${commentCounts.length}`);
console.log(`  Total developer comments: ${commentCounts.reduce((sum, pr) => sum + pr.total, 0)}`);
console.log();

// Show PRs with most/least comments
commentCounts.sort((a, b) => b.total - a.total);

console.log('PRs with MOST developer comments:');
commentCounts.slice(0, 3).forEach((pr, index) => {
  console.log(`  ${index + 1}. PR #${pr.number} (${pr.total} comments): ${pr.title}`);
});
console.log();

console.log('PRs with LEAST developer comments:');
commentCounts.slice(-3).reverse().forEach((pr, index) => {
  console.log(`  ${index + 1}. PR #${pr.number} (${pr.total} comments): ${pr.title}`);
});
console.log();

// ============================================================================
// LINES OF CODE (LOC) METRICS
// ============================================================================

console.log('='.repeat(80));
console.log('LINES OF CODE METRICS');
console.log('='.repeat(80));
console.log();

const totalAdditions = prDetails.reduce((sum, pr) => sum + (pr.additions || 0), 0);
const totalDeletions = prDetails.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
const totalLOC = prDetails.reduce((sum, pr) => sum + (pr.totalLOC || 0), 0);
const avgLOCPerPR = totalLOC / prDetails.length;

console.log(`Total Lines Added: ${totalAdditions.toLocaleString()}`);
console.log(`Total Lines Deleted: ${totalDeletions.toLocaleString()}`);
console.log(`Total Lines Changed: ${totalLOC.toLocaleString()}`);
console.log(`Average LOC per PR: ${avgLOCPerPR.toFixed(0)}`);
console.log(`PRs analyzed: ${prDetails.length}`);
console.log();

// ============================================================================
// COST PER STORY POINT ANALYSIS
// ============================================================================

console.log('='.repeat(80));
console.log('COST PER STORY POINT ANALYSIS');
console.log('='.repeat(80));
console.log();

// Fetch story points from the PRs we already filtered (aligns with other metrics)
console.log('Fetching story points for PRs...');
const storyPointData = fetchStoryPointsForPRs(featurePRs);

// Always get Bedrock costs for the date range
console.log('Fetching AWS Bedrock costs...');
const costData = getBedrockCosts(ANALYSIS_START, ANALYSIS_END);

if (costData) {
  console.log(`AWS Bedrock total cost: $${costData.totalCost.toFixed(2)}`);
  console.log(`Days with cost data: ${costData.daysFound}`);
  console.log();
}

// Calculate story points IN PROGRESS at END of this period
// Check status at the end of the analysis period, not current status
console.log(`Checking ticket status at end of period (${ANALYSIS_END.toISOString().split('T')[0]})...`);

const uniqueTicketIds = [...new Set(prDetails.map(pr => pr.ticketId).filter(id => id !== null))];
const wipTickets = [];

uniqueTicketIds.forEach(ticketId => {
  // Check if this ticket was already counted in completed this week
  const alreadyCounted = storyPointData.tickets.find(t => t.key === ticketId);

  if (!alreadyCounted) {
    // Get status at end of analysis period
    const ticketInfo = getTicketStatusAtDate(ticketId, ANALYSIS_END);

    if (ticketInfo && ticketInfo.statusAtDate) {
      // Development is complete when ticket reaches "Ready for Test"
      const isCompleted = ticketInfo.statusAtDate === 'Ready for Test' ||
                          ticketInfo.statusAtDate === 'In Test' ||
                          ticketInfo.statusAtDate === 'Ready for Sign Off' ||
                          ticketInfo.statusAtDate === 'Closed';

      if (!isCompleted) {
        wipTickets.push({
          key: ticketInfo.ticketId,
          storyPoints: ticketInfo.storyPoints,
          summary: ticketInfo.summary,
          status: ticketInfo.statusAtDate,
          currentStatus: ticketInfo.currentStatus
        });
      }
    }
  }

  // Small delay to avoid rate limiting
  execSync('sleep 0.2');
});

if (storyPointData.totalSP > 0) {
  console.log(`Completed tickets with story points: ${storyPointData.tickets.length}`);
  console.log(`Total story points completed: ${storyPointData.totalSP}`);
  console.log();

  // Show completed tickets
  console.log('Completed tickets:');
  storyPointData.tickets.forEach(ticket => {
    console.log(`  ${ticket.key} [${ticket.status}]: ${ticket.storyPoints} SP - ${ticket.summary}`);
  });
  console.log();

  if (costData) {
    const costPerSP = costData.totalCost / storyPointData.totalSP;
    console.log('='.repeat(80));
    console.log(`COST PER STORY POINT: $${costPerSP.toFixed(2)}`);
    console.log('='.repeat(80));
    console.log();

    console.log('Cost Breakdown:');
    console.log(`  Total AWS Cost: $${costData.totalCost.toFixed(2)}`);
    console.log(`  Total Story Points: ${storyPointData.totalSP}`);
    console.log(`  Cost per Story Point: $${costPerSP.toFixed(2)}`);
    console.log();
  }
} else {
  console.log('⚠️  No completed tickets with story points found');
  console.log();
}

// Show work in progress
if (wipTickets.length > 0) {
  const wipSP = wipTickets.reduce((sum, t) => sum + t.storyPoints, 0);
  console.log('='.repeat(80));
  console.log('WORK IN PROGRESS');
  console.log('='.repeat(80));
  console.log();
  console.log(`Tickets with PRs created but not yet completed: ${wipTickets.length}`);
  console.log(`Story points in progress: ${wipSP} SP`);
  console.log();

  console.log('WIP tickets:');
  wipTickets.forEach(ticket => {
    console.log(`  ${ticket.key} [${ticket.status}]: ${ticket.storyPoints} SP - ${ticket.summary}`);
  });
  console.log();
}

// Calculate cost per PR and cost per LOC if we have cost data
if (costData && featurePRs.length > 0) {
  // Calculate cost per PR
  const costPerPR = costData.totalCost / featurePRs.length;
  console.log(`  Total Feature PRs: ${featurePRs.length}`);
  console.log(`  Cost per PR: $${costPerPR.toFixed(2)}`);
  console.log();

  // Calculate cost per LOC
  if (totalLOC > 0) {
    const costPerLOC = costData.totalCost / totalLOC;
    console.log(`  Total Lines Changed: ${totalLOC.toLocaleString()}`);
    console.log(`  Cost per LOC: $${costPerLOC.toFixed(4)}`);
    console.log();
  }

  const totalDaysInRange = Math.ceil((ANALYSIS_END - ANALYSIS_START) / (24 * 60 * 60 * 1000));
  if (costData.daysFound < totalDaysInRange) {
    console.log(`⚠️  Warning: Cost data only covers ${costData.daysFound}/${totalDaysInRange} days`);
    console.log(`   Costs may be underreported`);
    console.log();
  }
} else if (featurePRs.length > 0) {
  console.log('⚠️  AWS Bedrock costs file not found');
  console.log('   Cannot calculate cost metrics');
  console.log();
}

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total PRs in repository: ${allPRs.length}`);
console.log(`Bot PRs excluded: ${dateFilteredPRs.filter(pr => pr.author && pr.author.is_bot).length}`);
console.log(`Dependency update PRs excluded: ${dateFilteredPRs.filter(pr => !pr.author?.is_bot && isDependencyUpdate(pr.title)).length}`);
console.log(`Excluded ticket PRs (no story points): ${dateFilteredPRs.filter(pr => isExcludedTicket(pr.title)).length}`);
console.log(`Feature PRs analyzed: ${featurePRs.length}`);
console.log('='.repeat(80));
