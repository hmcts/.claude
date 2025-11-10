#!/usr/bin/env node

const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  REPOS: [
    'hmcts/pip-frontend',
    'hmcts/pip-data-management',
    'hmcts/pip-account-management',
    'hmcts/pip-publication-services',
  ],
  PROJECT_KEYS: {
    'hmcts/pip-frontend': 'Publishing-information-project-PI',
    'hmcts/pip-data-management': 'pip-data-management',
    'hmcts/pip-account-management': 'pip-account-management',
    'hmcts/pip-publication-services': 'pip-publication-services',
  },
  SONAR_TOKEN: process.env.SONARQUBE_TOKEN || '',
  METRICS: 'coverage,vulnerabilities,duplicated_lines_density,sqale_rating,reliability_rating,security_rating,bugs,code_smells',
  MAX_PRS: 100,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isDependencyUpdate(title) {
  if (!title) return false;
  const lowerTitle = title.toLowerCase();
  return lowerTitle.includes('update dependency') ||
         lowerTitle.includes('update prisma') ||
         lowerTitle.includes('update vitest') ||
         lowerTitle.includes('update node.js') ||
         lowerTitle.includes('update github') ||
         lowerTitle.includes('update actions/') ||
         lowerTitle.includes('renovate') ||
         lowerTitle.includes('bump ');
}

function fetchSonarMetrics(prNumber, projectKey) {
  try {
    const url = `https://sonarcloud.io/api/measures/component?component=${projectKey}&pullRequest=${prNumber}&metricKeys=${CONFIG.METRICS}`;
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
    return null;
  }
}

function fetchPRDetails(prNumber, repo) {
  try {
    const prJson = execSync(`gh pr view ${prNumber} --repo ${repo} --json number,title,author,comments,reviews,state`, { encoding: 'utf8' });
    return JSON.parse(prJson);
  } catch (error) {
    return null;
  }
}

function countDeveloperComments(pr) {
  const developerComments = pr.comments.filter(comment => !comment.author.is_bot);
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
// ANALYZE SINGLE REPO
// ============================================================================

function analyzeRepo(repo) {
  console.log('='.repeat(80));
  console.log(`Analyzing Repository: ${repo}`);
  console.log('='.repeat(80));
  console.log();

  const projectKey = CONFIG.PROJECT_KEYS[repo];
  if (!projectKey) {
    console.log(`⚠ No SonarCloud project key configured for ${repo}`);
    console.log();
    return null;
  }

  console.log('Fetching PRs from GitHub...');
  const prListJson = execSync(`gh pr list --repo ${repo} --limit ${CONFIG.MAX_PRS} --json number,title,state,author --state all`, { encoding: 'utf8' });
  const allPRs = JSON.parse(prListJson);

  console.log(`Total PRs found: ${allPRs.length}`);

  // Filter out bot PRs and dependency updates
  const featurePRs = allPRs.filter(pr => {
    if (pr.author && pr.author.is_bot) return false;
    if (isDependencyUpdate(pr.title)) return false;
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

  // Fetch metrics for each feature PR
  console.log('Fetching SonarCloud metrics and PR details...');
  let progressCount = 0;

  featurePRs.forEach(pr => {
    progressCount++;
    process.stdout.write(`\rProcessing PR ${progressCount}/${featurePRs.length}...`);

    // Fetch Sonar metrics
    const sonarMetrics = fetchSonarMetrics(pr.number, projectKey);
    if (sonarMetrics) {
      Object.keys(metrics).forEach(metricKey => {
        if (sonarMetrics[metricKey] !== undefined) {
          metrics[metricKey].push(sonarMetrics[metricKey]);
        }
      });
    }

    // Fetch PR details for comments
    const prDetail = fetchPRDetails(pr.number, repo);
    if (prDetail) {
      const comments = countDeveloperComments(prDetail);
      commentCounts.push(comments.total);
    }

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
      };
    } else {
      averages[key] = { average: null, count: 0 };
    }
  }

  const avgComments = commentCounts.length > 0
    ? commentCounts.reduce((sum, c) => sum + c, 0) / commentCounts.length
    : 0;

  return {
    repo,
    totalPRs: allPRs.length,
    featurePRs: featurePRs.length,
    botPRs: allPRs.filter(pr => pr.author && pr.author.is_bot).length,
    dependencyPRs: allPRs.filter(pr => !pr.author?.is_bot && isDependencyUpdate(pr.title)).length,
    averages,
    avgComments,
  };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('='.repeat(80));
console.log('Multi-Repository PR Metrics Analysis');
console.log('='.repeat(80));
console.log();

const repoResults = [];

CONFIG.REPOS.forEach(repo => {
  const result = analyzeRepo(repo);
  if (result) {
    repoResults.push(result);
  }
});

// ============================================================================
// AGGREGATE ACROSS ALL REPOS
// ============================================================================

console.log('='.repeat(80));
console.log('AGGREGATE METRICS ACROSS ALL REPOSITORIES');
console.log('='.repeat(80));
console.log();

// Calculate overall averages
const aggregateMetrics = {
  coverage: [],
  vulnerabilities: [],
  duplicated_lines_density: [],
  sqale_rating: [],
  reliability_rating: [],
  security_rating: [],
  bugs: [],
  code_smells: [],
};

repoResults.forEach(result => {
  Object.keys(aggregateMetrics).forEach(metric => {
    if (result.averages[metric].average !== null) {
      aggregateMetrics[metric].push(result.averages[metric].average);
    }
  });
});

const overallAverages = {};
for (const [key, values] of Object.entries(aggregateMetrics)) {
  if (values.length > 0) {
    const sum = values.reduce((a, b) => a + b, 0);
    overallAverages[key] = sum / values.length;
  } else {
    overallAverages[key] = null;
  }
}

const overallAvgComments = repoResults.reduce((sum, r) => sum + r.avgComments, 0) / repoResults.length;

// ============================================================================
// REPORT
// ============================================================================

console.log('SONARQUBE QUALITY METRICS (Average Across All Repos):');
console.log();

console.log('Test Coverage:');
console.log(`  Average: ${overallAverages.coverage?.toFixed(2)}%`);
console.log();

console.log('CVEs (Vulnerabilities):');
console.log(`  Average: ${overallAverages.vulnerabilities?.toFixed(2)}`);
console.log();

console.log('Duplicated Lines:');
console.log(`  Average: ${overallAverages.duplicated_lines_density?.toFixed(2)}%`);
console.log();

console.log('Maintainability Rating:');
console.log(`  Average: ${overallAverages.sqale_rating?.toFixed(2)} (1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E)`);
console.log();

console.log('Reliability Rating:');
console.log(`  Average: ${overallAverages.reliability_rating?.toFixed(2)} (1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E)`);
console.log();

console.log('Security Rating:');
console.log(`  Average: ${overallAverages.security_rating?.toFixed(2)} (1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E)`);
console.log();

console.log('Additional Metrics:');
console.log(`  Bugs: ${overallAverages.bugs?.toFixed(2)} average`);
console.log(`  Code Smells: ${overallAverages.code_smells?.toFixed(2)} average`);
console.log();

console.log('DEVELOPER ENGAGEMENT METRICS:');
console.log(`  Average Developer Comments per PR: ${overallAvgComments.toFixed(2)}`);
console.log();

console.log('='.repeat(80));
console.log('PER-REPOSITORY BREAKDOWN');
console.log('='.repeat(80));
console.log();

repoResults.forEach(result => {
  console.log(`${result.repo}:`);
  console.log(`  Total PRs: ${result.totalPRs}`);
  console.log(`  Feature PRs: ${result.featurePRs}`);
  console.log(`  Bot PRs excluded: ${result.botPRs}`);
  console.log(`  Dependency PRs excluded: ${result.dependencyPRs}`);
  console.log(`  Coverage: ${result.averages.coverage.average?.toFixed(2)}%`);
  console.log(`  Vulnerabilities: ${result.averages.vulnerabilities.average?.toFixed(2)}`);
  console.log(`  Maintainability: ${result.averages.sqale_rating.average?.toFixed(2)}`);
  console.log(`  Avg Comments/PR: ${result.avgComments.toFixed(2)}`);
  console.log();
});

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total Repositories: ${repoResults.length}`);
console.log(`Total Feature PRs analyzed: ${repoResults.reduce((sum, r) => sum + r.featurePRs, 0)}`);
console.log('='.repeat(80));
