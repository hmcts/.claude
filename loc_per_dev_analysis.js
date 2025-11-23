#!/usr/bin/env node

const { execSync } = require('child_process');

// Fetch PR data directly from GitHub using date-based search
// This ensures we get ALL PRs from the analysis period, not just the most recent 100
console.log('Fetching PRs from GitHub...');
const searchQuery = 'created:>=2025-10-07'; // Fetch all PRs created from the start of analysis period
const prListJson = execSync(`gh pr list --repo hmcts/cath-service --search "${searchQuery}" --limit 500 --json number,title,state,author,createdAt,mergedAt,additions,deletions --state all`, { encoding: 'utf8' });
const prData = JSON.parse(prListJson);
console.log(`✓ Fetched ${prData.length} PRs\n`);

// Exclude these developers
const EXCLUDED_DEVS = ['linusnorton', 'linus-norton', 'linosnort'];

// Parse weeks from command line arguments (passed as JSON)
let weeks = [];
if (process.argv[2]) {
  try {
    weeks = JSON.parse(process.argv[2]).map(w => ({
      ...w,
      start: new Date(w.start),
      end: new Date(w.end + 'T23:59:59Z')
    }));
  } catch (error) {
    console.error('Error parsing weeks:', error.message);
    console.error('Usage: node loc_per_dev_analysis.js \'[{"name":"Week 1","start":"2025-10-07","end":"2025-10-13","period":"Oct 7-13"}]\'');
    process.exit(1);
  }
}

if (weeks.length === 0) {
  console.error('Error: No weeks provided. This script must be called with weeks parameter.');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('LINES OF CODE PER DEVELOPER ANALYSIS');
console.log('='.repeat(80));
console.log();

// Analyze each week
weeks.forEach(week => {
  const weekPRs = prData.filter(pr => {
    if (!pr.createdAt) return false;
    if (pr.author.is_bot) return false;
    if (EXCLUDED_DEVS.includes(pr.author.login)) return false;

    const createdDate = new Date(pr.createdAt);
    const createdInRange = createdDate >= week.start && createdDate <= week.end;

    // Only include merged PRs (to measure delivered work)
    return createdInRange && pr.state === 'MERGED';
  });

  // Calculate LOC per developer
  const devLOC = {};
  weekPRs.forEach(pr => {
    const login = pr.author.login;
    const loc = (pr.additions || 0) + (pr.deletions || 0);

    if (!devLOC[login]) {
      devLOC[login] = { prs: 0, additions: 0, deletions: 0, totalLOC: 0 };
    }

    devLOC[login].prs++;
    devLOC[login].additions += pr.additions || 0;
    devLOC[login].deletions += pr.deletions || 0;
    devLOC[login].totalLOC += loc;
  });

  const devCount = Object.keys(devLOC).length;
  const totalLOC = Object.values(devLOC).reduce((sum, d) => sum + d.totalLOC, 0);
  const avgLOCPerDev = devCount > 0 ? totalLOC / devCount : 0;

  console.log(`${week.name} (${week.start.toISOString().split('T')[0]} to ${week.end.toISOString().split('T')[0]}):`);
  console.log(`  Developers (excl. ${EXCLUDED_DEVS.join(', ')}): ${devCount}`);
  console.log(`  Total LOC: ${totalLOC.toLocaleString()}`);
  console.log(`  Average LOC per Dev: ${avgLOCPerDev.toFixed(0)}`);
  console.log();

  if (devCount > 0) {
    console.log('  Developer breakdown:');
    Object.entries(devLOC)
      .sort((a, b) => b[1].totalLOC - a[1].totalLOC)
      .forEach(([login, stats]) => {
        console.log(`    ${login}: ${stats.totalLOC.toLocaleString()} LOC (${stats.prs} PRs, +${stats.additions}/-${stats.deletions})`);
      });
    console.log();
  }
});

// Generate summary for dashboard
console.log('='.repeat(80));
console.log('SUMMARY FOR DASHBOARD');
console.log('='.repeat(80));
console.log();

const weeklyAvgLOC = weeks.map(week => {
  const weekPRs = prData.filter(pr => {
    if (!pr.createdAt) return false;
    if (pr.author.is_bot) return false;
    if (EXCLUDED_DEVS.includes(pr.author.login)) return false;

    const createdDate = new Date(pr.createdAt);
    const createdInRange = createdDate >= week.start && createdDate <= week.end;

    // Only include merged PRs (to measure delivered work)
    return createdInRange && pr.state === 'MERGED';
  });

  const devLOC = {};
  weekPRs.forEach(pr => {
    const login = pr.author.login;
    const loc = (pr.additions || 0) + (pr.deletions || 0);

    if (!devLOC[login]) {
      devLOC[login] = 0;
    }
    devLOC[login] += loc;
  });

  const devCount = Object.keys(devLOC).length;
  const totalLOC = Object.values(devLOC).reduce((sum, loc) => sum + loc, 0);
  const avgLOC = devCount > 0 ? totalLOC / devCount : 0;

  return {
    week: week.name,
    devCount,
    totalLOC,
    avgLOC
  };
});

console.log('Weekly LOC per Developer (Average):');
weeklyAvgLOC.forEach(w => {
  console.log(`  ${w.week}: ${w.avgLOC.toFixed(0)} LOC/dev (${w.devCount} devs, ${w.totalLOC.toLocaleString()} total)`);
});
console.log();

// Output for dashboard update
console.log('='.repeat(80));
console.log('DASHBOARD DATA (Copy to weekly_metrics_plot.js)');
console.log('='.repeat(80));
console.log();
console.log('Add to weeklyData array:');
console.log('locPerDev: [');
weeklyAvgLOC.forEach(w => {
  console.log(`  ${w.avgLOC.toFixed(0)}, // ${w.week}`);
});
console.log(']');
