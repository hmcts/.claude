#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// This script calculates "time to hit context window" from analytics data
// It requires both sessions.csv and compactions.csv to have data

const ANALYTICS_DIR = path.join(process.env.HOME, '.claude/plugins/marketplaces/hmcts/expressjs-monorepo/analytics');

const sessionsFile = path.join(ANALYTICS_DIR, 'sessions.csv');
const compactionsFile = path.join(ANALYTICS_DIR, 'compactions.csv');

/**
 * Parse CSV file into array of objects
 */
function parseCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    if (lines.length <= 1) {
      console.log(`File is empty or only has headers: ${filePath}`);
      return [];
    }

    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }

    return data;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Format milliseconds to human-readable time
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

console.log('='.repeat(80));
console.log('Time to Hit Context Window Analysis');
console.log('='.repeat(80));
console.log();

// Parse the data
const sessions = parseCSV(sessionsFile);
const compactions = parseCSV(compactionsFile);

if (sessions === null || compactions === null) {
  console.log('ERROR: Could not read required files');
  process.exit(1);
}

if (sessions.length === 0) {
  console.log('No session data found in sessions.csv');
  process.exit(0);
}

if (compactions.length === 0) {
  console.log('No compaction data found in compactions.csv');
  console.log('This means no sessions have hit the context window yet.');
  console.log();
  console.log(`Sessions tracked: ${sessions.length}`);
  process.exit(0);
}

console.log(`Sessions found: ${sessions.length}`);
console.log(`Compactions found: ${compactions.length}`);
console.log();

// Group compactions by session
const compactionsBySession = {};
compactions.forEach(compaction => {
  const sessionId = compaction.session_id;
  if (!compactionsBySession[sessionId]) {
    compactionsBySession[sessionId] = [];
  }
  compactionsBySession[sessionId].push(compaction);
});

// Create a map of sessions
const sessionMap = {};
sessions.forEach(session => {
  sessionMap[session.session_id] = session;
});

// Calculate time to context window for each session
const timeToContextWindow = [];

Object.keys(compactionsBySession).forEach(sessionId => {
  const session = sessionMap[sessionId];
  if (!session) {
    console.log(`Warning: No session found for compaction session_id ${sessionId}`);
    return;
  }

  const sessionStartTime = parseInt(session.started_at);
  const compactionList = compactionsBySession[sessionId];

  // Sort compactions by timestamp to find the first one
  compactionList.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

  const firstCompaction = compactionList[0];
  const firstCompactionTime = parseInt(firstCompaction.timestamp);

  const timeToWindow = firstCompactionTime - sessionStartTime;

  timeToContextWindow.push({
    sessionId: sessionId,
    timeToWindow: timeToWindow,
    turnNumber: firstCompaction.turn_number,
    tokensBefore: firstCompaction.tokens_before,
    tokensAfter: firstCompaction.tokens_after,
    compactionCount: compactionList.length
  });
});

if (timeToContextWindow.length === 0) {
  console.log('No matching session/compaction pairs found.');
  process.exit(0);
}

// Calculate statistics
timeToContextWindow.sort((a, b) => a.timeToWindow - b.timeToWindow);

const avgTime = timeToContextWindow.reduce((sum, item) => sum + item.timeToWindow, 0) / timeToContextWindow.length;
const medianTime = timeToContextWindow[Math.floor(timeToContextWindow.length / 2)].timeToWindow;
const minTime = timeToContextWindow[0].timeToWindow;
const maxTime = timeToContextWindow[timeToContextWindow.length - 1].timeToWindow;

console.log('='.repeat(80));
console.log('TIME TO HIT CONTEXT WINDOW STATISTICS:');
console.log('='.repeat(80));
console.log();
console.log(`Sessions that hit context window: ${timeToContextWindow.length}`);
console.log(`Average time to context window: ${formatDuration(avgTime)} (${(avgTime / 1000 / 60).toFixed(2)} minutes)`);
console.log(`Median time to context window: ${formatDuration(medianTime)} (${(medianTime / 1000 / 60).toFixed(2)} minutes)`);
console.log(`Fastest time to context window: ${formatDuration(minTime)} (${(minTime / 1000 / 60).toFixed(2)} minutes)`);
console.log(`Slowest time to context window: ${formatDuration(maxTime)} (${(maxTime / 1000 / 60).toFixed(2)} minutes)`);
console.log();

console.log('='.repeat(80));
console.log('SESSIONS WITH FASTEST CONTEXT WINDOW HITS:');
console.log('='.repeat(80));
timeToContextWindow.slice(0, 5).forEach((item, index) => {
  console.log(`${index + 1}. Session ${item.sessionId}`);
  console.log(`   Time to context window: ${formatDuration(item.timeToWindow)}`);
  console.log(`   Turn number: ${item.turnNumber}`);
  console.log(`   Tokens before: ${item.tokensBefore}`);
  console.log(`   Total compactions: ${item.compactionCount}`);
  console.log();
});

console.log('='.repeat(80));
console.log('SESSIONS WITH SLOWEST CONTEXT WINDOW HITS:');
console.log('='.repeat(80));
timeToContextWindow.slice(-5).reverse().forEach((item, index) => {
  console.log(`${index + 1}. Session ${item.sessionId}`);
  console.log(`   Time to context window: ${formatDuration(item.timeToWindow)}`);
  console.log(`   Turn number: ${item.turnNumber}`);
  console.log(`   Tokens before: ${item.tokensBefore}`);
  console.log(`   Total compactions: ${item.compactionCount}`);
  console.log();
});
