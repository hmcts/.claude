#!/usr/bin/env node

/**
 * Query JIRA for current sprint data (velocity, story points, progress)
 * Usage: node jira_story_points.js [sprint|date-range] [start-date] [end-date]
 * Example: node jira_story_points.js sprint
 * Example: node jira_story_points.js date-range 2025-10-22 2025-10-29
 *
 * Requires JIRA_PERSONAL_TOKEN environment variable
 */

const https = require('https');

const CONFIG = {
  JIRA_HOST: 'tools.hmcts.net',
  JIRA_BASE_PATH: '/jira',
  PROJECT_KEY: 'VIBE',
  BOARD_ID: '3078', // From the URL rapidView=3078
};

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'sprint';

if (mode === 'sprint') {
  console.log(`Fetching current sprint data for VIBE project...`);
} else {
  const startDate = args[1] || '2025-10-22';
  const endDate = args[2] || '2025-10-29';
  console.log(`Fetching VIBE story points completed between ${startDate} and ${endDate}...`);
}
console.log();

// Check for JIRA token
const token = process.env.JIRA_PERSONAL_TOKEN;
if (!token) {
  console.error('Error: JIRA_PERSONAL_TOKEN environment variable not set');
  console.error('Please set it with: export JIRA_PERSONAL_TOKEN="your_token_here"');
  process.exit(1);
}

// Make JIRA API request
function makeJiraRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.JIRA_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
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

// Get active sprints for the board
async function getActiveSprints() {
  const path = `${CONFIG.JIRA_BASE_PATH}/rest/agile/1.0/board/${CONFIG.BOARD_ID}/sprint?state=active`;
  return await makeJiraRequest(path);
}

// Get sprint issues with story points
async function getSprintIssues(sprintId) {
  const jql = encodeURIComponent(`sprint = ${sprintId}`);
  // Request ALL fields with fields=*all to find the story points field
  const path = `${CONFIG.JIRA_BASE_PATH}/rest/api/2/search?jql=${jql}&fields=*all&maxResults=200`;
  return await makeJiraRequest(path);
}

// Get issues by JQL
async function getIssuesByJQL(jql) {
  const encodedJql = encodeURIComponent(jql);
  const path = `${CONFIG.JIRA_BASE_PATH}/rest/api/2/search?jql=${encodedJql}&fields=key,summary,status,customfield_10016,resolutiondate&maxResults=100`;
  return await makeJiraRequest(path);
}

// Main execution
(async () => {
  try {
    if (mode === 'sprint') {
      // Get active sprint data
      const sprintsResult = await getActiveSprints();

      if (!sprintsResult.values || sprintsResult.values.length === 0) {
        console.log('No active sprints found');
        process.exit(0);
      }

      const currentSprint = sprintsResult.values[0];
      console.log(`Sprint: ${currentSprint.name}`);
      console.log(`State: ${currentSprint.state}`);
      console.log(`Start: ${currentSprint.startDate ? new Date(currentSprint.startDate).toLocaleDateString() : 'Not set'}`);
      console.log(`End: ${currentSprint.endDate ? new Date(currentSprint.endDate).toLocaleDateString() : 'Not set'}`);
      console.log();

      // Get all issues in the sprint
      const issuesResult = await getSprintIssues(currentSprint.id);

      console.log(`Total Issues in Sprint: ${issuesResult.total}`);
      console.log('=' .repeat(80));
      console.log();

      let totalCommitted = 0;
      let totalCompleted = 0;
      let totalInProgress = 0;
      let totalToDo = 0;

      const completedIssues = [];
      const inProgressIssues = [];
      const todoIssues = [];

      issuesResult.issues.forEach((issue) => {
        const key = issue.key;
        const summary = issue.fields.summary;
        const status = issue.fields.status?.name || 'Unknown';
        const statusCategory = issue.fields.status?.statusCategory?.name || 'Unknown';
        const resolved = issue.fields.resolutiondate;
        const storyPoints = issue.fields.customfield_10004;  // Updated based on API response

        const issueData = { key, summary, status, storyPoints, resolved };

        if (storyPoints && typeof storyPoints === 'number') {
          totalCommitted += storyPoints;

          if (statusCategory === 'Done') {
            totalCompleted += storyPoints;
            completedIssues.push(issueData);
          } else if (statusCategory === 'In Progress') {
            totalInProgress += storyPoints;
            inProgressIssues.push(issueData);
          } else {
            totalToDo += storyPoints;
            todoIssues.push(issueData);
          }
        }
      });

      // Display completed issues
      console.log('COMPLETED ISSUES:');
      console.log('=' .repeat(80));
      if (completedIssues.length === 0) {
        console.log('None');
      } else {
        completedIssues.forEach(issue => {
          console.log(`${issue.key}: ${issue.summary}`);
          console.log(`  Story Points: ${issue.storyPoints}`);
          console.log(`  Resolved: ${issue.resolved ? new Date(issue.resolved).toLocaleDateString() : 'N/A'}`);
          console.log();
        });
      }
      console.log();

      // Display in-progress issues
      console.log('IN PROGRESS ISSUES:');
      console.log('=' .repeat(80));
      if (inProgressIssues.length === 0) {
        console.log('None');
      } else {
        inProgressIssues.forEach(issue => {
          console.log(`${issue.key}: ${issue.summary}`);
          console.log(`  Story Points: ${issue.storyPoints}`);
          console.log();
        });
      }
      console.log();

      // Display todo issues
      console.log('TO DO ISSUES:');
      console.log('=' .repeat(80));
      if (todoIssues.length === 0) {
        console.log('None');
      } else {
        todoIssues.forEach(issue => {
          console.log(`${issue.key}: ${issue.summary}`);
          console.log(`  Story Points: ${issue.storyPoints}`);
          console.log();
        });
      }
      console.log();

      // Summary
      console.log('=' .repeat(80));
      console.log('SPRINT SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Sprint: ${currentSprint.name}`);
      console.log(`Total Issues: ${issuesResult.total}`);
      console.log();
      console.log(`Total Committed Points: ${totalCommitted}`);
      console.log(`Completed Points: ${totalCompleted}`);
      console.log(`In Progress Points: ${totalInProgress}`);
      console.log(`To Do Points: ${totalToDo}`);
      console.log();
      console.log(`Completion Rate: ${totalCommitted > 0 ? ((totalCompleted / totalCommitted) * 100).toFixed(1) : 0}%`);
      console.log(`Velocity (Completed): ${totalCompleted} points`);

      // Calculate days into sprint
      if (currentSprint.startDate && currentSprint.endDate) {
        const start = new Date(currentSprint.startDate);
        const end = new Date(currentSprint.endDate);
        const now = new Date();
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

        console.log();
        console.log(`Sprint Duration: ${totalDays} days`);
        console.log(`Days Elapsed: ${daysElapsed} days`);
        console.log(`Days Remaining: ${daysRemaining} days`);

        const expectedProgress = (daysElapsed / totalDays) * 100;
        const actualProgress = totalCommitted > 0 ? (totalCompleted / totalCommitted) * 100 : 0;
        console.log();
        console.log(`Expected Progress: ${expectedProgress.toFixed(1)}%`);
        console.log(`Actual Progress: ${actualProgress.toFixed(1)}%`);
        console.log(`Status: ${actualProgress >= expectedProgress ? '✓ On Track' : '✗ Behind Schedule'}`);
      }

    } else {
      // Date range mode
      const startDate = args[1] || '2025-10-22';
      const endDate = args[2] || '2025-10-29';
      const jql = `project = VIBE AND resolved >= "${startDate}" AND resolved <= "${endDate} 23:59" ORDER BY resolved ASC`;

      const result = await getIssuesByJQL(jql);

      console.log(`Found ${result.total} issues\n`);
      console.log('=' .repeat(80));

      let totalStoryPoints = 0;
      let issuesWithPoints = 0;
      let issuesWithoutPoints = 0;

      result.issues.forEach((issue) => {
        const key = issue.key;
        const summary = issue.fields.summary;
        const status = issue.fields.status?.name || 'Unknown';
        const resolved = issue.fields.resolutiondate;
        const storyPoints = issue.fields.customfield_10004;  // Updated based on API response

        console.log(`${key}: ${summary}`);
        console.log(`  Status: ${status}`);
        console.log(`  Resolved: ${resolved}`);
        console.log(`  Story Points: ${storyPoints || 'Not set'}`);
        console.log();

        if (storyPoints && typeof storyPoints === 'number') {
          totalStoryPoints += storyPoints;
          issuesWithPoints++;
        } else {
          issuesWithoutPoints++;
        }
      });

      console.log('=' .repeat(80));
      console.log('SUMMARY');
      console.log('=' .repeat(80));
      console.log(`Total Issues: ${result.total}`);
      console.log(`Issues with Story Points: ${issuesWithPoints}`);
      console.log(`Issues without Story Points: ${issuesWithoutPoints}`);
      console.log(`Total Story Points: ${totalStoryPoints}`);
    }

  } catch (error) {
    console.error('Error querying JIRA:', error.message);
    process.exit(1);
  }
})();
