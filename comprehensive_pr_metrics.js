#!/usr/bin/env node

const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  REPO: 'hmcts/cath-service',
  PROJECT_KEY: 'hmcts.cath',
  SONAR_TOKEN: process.env.SONARQUBE_TOKEN || '',
  METRICS: 'coverage,vulnerabilities,duplicated_lines_density,sqale_rating,reliability_rating,security_rating,bugs,code_smells',
  MAX_PRS: 100,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Fetch SonarCloud metrics for a PR
 */
function fetchSonarMetrics(prNumber) {
  try {
    const url = `https://sonarcloud.io/api/measures/component?component=${CONFIG.PROJECT_KEY}&pullRequest=${prNumber}&metricKeys=${CONFIG.METRICS}`;
    const response = execSync(`curl -s -u "${CONFIG.SONAR_TOKEN}:" "${url}"`, { encoding: 'utf8' });
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
    console.error(`Error fetching Sonar metrics for PR #${prNumber}:`, error.message);
    return null;
  }
}

/**
 * Fetch PR details including comments
 */
function fetchPRDetails(prNumber) {
  try {
    const prJson = execSync(`gh pr view ${prNumber} --repo ${CONFIG.REPO} --json number,title,author,comments,reviews,state`, { encoding: 'utf8' });
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

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

console.log('='.repeat(80));
console.log('Comprehensive PR Metrics Analysis');
console.log(`Repository: ${CONFIG.REPO}`);
console.log('='.repeat(80));
console.log();

console.log('Fetching PRs from GitHub...');
const prListJson = execSync(`gh pr list --repo ${CONFIG.REPO} --limit ${CONFIG.MAX_PRS} --json number,title,state,author --state all`, { encoding: 'utf8' });
const allPRs = JSON.parse(prListJson);

console.log(`Total PRs found: ${allPRs.length}`);
console.log();

// Filter out bot PRs and dependency updates
const featurePRs = allPRs.filter(pr => {
  // Skip bot PRs
  if (pr.author && pr.author.is_bot) {
    return false;
  }

  // Skip dependency updates
  if (isDependencyUpdate(pr.title)) {
    return false;
  }

  // Only include merged or open PRs
  return pr.state === 'MERGED' || pr.state === 'OPEN';
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

  // Fetch PR details for comments
  const prDetail = fetchPRDetails(pr.number);
  if (prDetail) {
    const comments = countDeveloperComments(prDetail);
    commentCounts.push({
      number: pr.number,
      title: pr.title,
      ...comments
    });

    prDetails.push({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      comments: comments.total,
      hasCoverage: sonarMetrics && sonarMetrics.coverage !== undefined,
      coverage: sonarMetrics ? sonarMetrics.coverage : null
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

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total PRs in repository: ${allPRs.length}`);
console.log(`Bot PRs excluded: ${allPRs.filter(pr => pr.author && pr.author.is_bot).length}`);
console.log(`Dependency update PRs excluded: ${allPRs.filter(pr => !pr.author?.is_bot && isDependencyUpdate(pr.title)).length}`);
console.log(`Feature PRs analyzed: ${featurePRs.length}`);
console.log('='.repeat(80));
