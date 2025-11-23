#!/usr/bin/env node

/**
 * Merge Analytics CSVs from Multiple Developers
 *
 * This script combines analytics data from multiple developers into a single
 * set of CSV files for team-wide analysis.
 *
 * Usage:
 *   # Explicitly specify input folders
 *   node merge_analytics.js \
 *     --input .claude/analytics-dev1/ \
 *     --input .claude/analytics-dev2/ \
 *     --output .claude/analytics-merged/
 *
 *   # Auto-detect all analytics-* folders in current directory
 *   node merge_analytics.js --auto-detect --output .claude/analytics-merged/
 *
 * Features:
 * - Removes duplicate header rows
 * - Deduplicates data rows (by unique key)
 * - Preserves all developer data
 * - Validates CSV structure
 * - Creates backup of existing merged data
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  CSV_FILES: ['costs.csv', 'sessions.csv', 'turns.csv', 'compactions.csv', 'prompts.csv', 'tool_usage.csv'],
  BACKUP_SUFFIX: '.backup',
};

// Parse command line arguments
const args = process.argv.slice(2);
let inputFolders = [];
let outputFolder = null;
let autoDetect = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) {
    inputFolders.push(args[i + 1]);
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputFolder = args[i + 1];
    i++;
  } else if (args[i] === '--auto-detect') {
    autoDetect = true;
  }
}

// Auto-detect analytics-* folders if requested
if (autoDetect) {
  const currentDir = process.cwd();
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  const analyticsPattern = /^\.?claude\/analytics-/;
  const detectedFolders = entries
    .filter(entry => entry.isDirectory() && analyticsPattern.test(entry.name))
    .map(entry => path.join(currentDir, entry.name));

  // Also check in .claude subdirectory
  const claudeDir = path.join(currentDir, '.claude');
  if (fs.existsSync(claudeDir)) {
    const claudeEntries = fs.readdirSync(claudeDir, { withFileTypes: true });
    claudeEntries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('analytics-'))
      .forEach(entry => {
        detectedFolders.push(path.join(claudeDir, entry.name));
      });
  }

  inputFolders = inputFolders.concat(detectedFolders);
}

// Validate arguments
if (inputFolders.length === 0) {
  console.error('Error: No input folders specified');
  console.error('');
  console.error('Usage:');
  console.error('  node merge_analytics.js --input folder1 --input folder2 --output merged/');
  console.error('  node merge_analytics.js --auto-detect --output merged/');
  console.error('');
  console.error('Examples:');
  console.error('  node merge_analytics.js \\');
  console.error('    --input .claude/analytics-dev1/ \\');
  console.error('    --input .claude/analytics-dev2/ \\');
  console.error('    --output .claude/analytics-merged/');
  console.error('');
  console.error('  node merge_analytics.js --auto-detect --output .claude/analytics-merged/');
  process.exit(1);
}

if (!outputFolder) {
  console.error('Error: No output folder specified (use --output)');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('Analytics CSV Merge Tool');
console.log('='.repeat(80));
console.log();

// Validate input folders exist
console.log('Step 1: Validating input folders...');
const validInputFolders = [];

for (const folder of inputFolders) {
  if (!fs.existsSync(folder)) {
    console.error(`  ⚠️  Warning: ${folder} does not exist, skipping`);
    continue;
  }

  if (!fs.statSync(folder).isDirectory()) {
    console.error(`  ⚠️  Warning: ${folder} is not a directory, skipping`);
    continue;
  }

  validInputFolders.push(folder);
  console.log(`  ✅ ${folder}`);
}

if (validInputFolders.length === 0) {
  console.error('Error: No valid input folders found');
  process.exit(1);
}

console.log();
console.log(`Found ${validInputFolders.length} valid input folder(s)`);
console.log();

// Create output directory
console.log('Step 2: Preparing output directory...');
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
  console.log(`  Created: ${outputFolder}`);
} else {
  console.log(`  Using existing: ${outputFolder}`);

  // Backup existing files
  for (const csvFile of CONFIG.CSV_FILES) {
    const outputPath = path.join(outputFolder, csvFile);
    if (fs.existsSync(outputPath)) {
      const backupPath = outputPath + CONFIG.BACKUP_SUFFIX;
      fs.copyFileSync(outputPath, backupPath);
      console.log(`  Backed up: ${csvFile} → ${csvFile}${CONFIG.BACKUP_SUFFIX}`);
    }
  }
}
console.log();

// Read and parse CSV file
function readCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    return { headers: null, rows: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    return { headers: null, rows: [] };
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  const seenHeaders = new Set([lines[0]]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip duplicate header rows
    if (seenHeaders.has(line)) continue;

    rows.push(line);
  }

  return { headers, rows };
}

// Get unique key for a row based on CSV type
function getRowKey(csvFileName, rowData, headers) {
  const values = rowData.split(',').map(v => v.trim());
  const row = {};

  headers.forEach((header, index) => {
    row[header] = values[index] || '';
  });

  // Define unique keys for each CSV type
  if (csvFileName === 'costs.csv') {
    // Unique by session_id + turn_number + message_id
    return `${row.session_id}|${row.turn_number}|${row.message_id}`;
  } else if (csvFileName === 'sessions.csv') {
    // Unique by session_id + branch + started_at + ended_at
    // Multiple sessions can have same ID, so we need branch + timestamps
    return `${row.session_id}|${row.branch}|${row.started_at}|${row.ended_at}`;
  } else if (csvFileName === 'turns.csv') {
    // Unique by session_id + turn_number
    return `${row.session_id}|${row.turn_number}`;
  } else if (csvFileName === 'compactions.csv') {
    // Unique by session_id + turn_number + timestamp
    return `${row.session_id}|${row.turn_number}|${row.timestamp}`;
  } else if (csvFileName === 'prompts.csv') {
    // Unique by session_id + turn_number + timestamp
    return `${row.session_id}|${row.turn_number}|${row.timestamp}`;
  } else if (csvFileName === 'tool_usage.csv') {
    // Unique by session_id + turn_number + tool_name + started_at
    return `${row.session_id}|${row.turn_number}|${row.tool_name}|${row.started_at}`;
  } else if (csvFileName === 'commits.csv') {
    // Unique by commit_sha + session_id
    return `${row.commit_sha}|${row.session_id}`;
  } else if (csvFileName === 'git_operations.csv') {
    // Unique by session_id + operation_type + timestamp
    return `${row.session_id}|${row.operation_type}|${row.timestamp}`;
  }

  // Fallback: use entire row as key
  return rowData;
}

// Merge CSVs
console.log('Step 3: Merging CSV files...');
console.log();

const stats = {
  totalFiles: 0,
  totalRowsInput: 0,
  totalRowsOutput: 0,
  duplicatesRemoved: 0,
};

for (const csvFile of CONFIG.CSV_FILES) {
  console.log(`Processing: ${csvFile}`);

  let masterHeaders = null;
  const allRows = [];
  const seenKeys = new Set();
  let filesFound = 0;
  let inputRows = 0;
  let duplicates = 0;

  // Read from each input folder
  for (const inputFolder of validInputFolders) {
    const csvPath = path.join(inputFolder, csvFile);

    if (!fs.existsSync(csvPath)) {
      console.log(`  ⚠️  Not found in: ${path.basename(inputFolder)}`);
      continue;
    }

    const { headers, rows } = readCSV(csvPath);

    if (!headers) {
      console.log(`  ⚠️  Empty file in: ${path.basename(inputFolder)}`);
      continue;
    }

    filesFound++;
    inputRows += rows.length;

    // Validate headers match (or set master headers)
    if (!masterHeaders) {
      masterHeaders = headers;
    } else {
      const headersMatch = headers.length === masterHeaders.length &&
        headers.every((h, i) => h === masterHeaders[i]);

      if (!headersMatch) {
        console.error(`  ❌ Error: Headers don't match in ${path.basename(inputFolder)}`);
        console.error(`     Expected: ${masterHeaders.join(',')}`);
        console.error(`     Got:      ${headers.join(',')}`);
        continue;
      }
    }

    // Add unique rows
    for (const row of rows) {
      const key = getRowKey(csvFile, row, masterHeaders);

      if (seenKeys.has(key)) {
        duplicates++;
        continue;
      }

      seenKeys.add(key);
      allRows.push(row);
    }

    console.log(`  ✅ ${path.basename(inputFolder)}: ${rows.length} rows`);
  }

  if (filesFound === 0) {
    console.log(`  ⚠️  ${csvFile} not found in any input folder, skipping`);
    console.log();
    continue;
  }

  // Write merged CSV
  const outputPath = path.join(outputFolder, csvFile);
  const outputContent = [
    masterHeaders.join(','),
    ...allRows
  ].join('\n') + '\n';

  fs.writeFileSync(outputPath, outputContent, 'utf8');

  console.log(`  📊 Merged: ${allRows.length} unique rows (removed ${duplicates} duplicates)`);
  console.log(`  💾 Written to: ${outputPath}`);
  console.log();

  stats.totalFiles++;
  stats.totalRowsInput += inputRows;
  stats.totalRowsOutput += allRows.length;
  stats.duplicatesRemoved += duplicates;
}

// Summary
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
console.log(`Input Folders: ${validInputFolders.length}`);
validInputFolders.forEach(folder => {
  console.log(`  - ${folder}`);
});
console.log();
console.log(`Output Folder: ${outputFolder}`);
console.log();
console.log(`Files Merged: ${stats.totalFiles}`);
console.log(`Total Input Rows: ${stats.totalRowsInput.toLocaleString()}`);
console.log(`Total Output Rows: ${stats.totalRowsOutput.toLocaleString()}`);
console.log(`Duplicates Removed: ${stats.duplicatesRemoved.toLocaleString()}`);
console.log();
console.log('✅ Merge complete!');
console.log();
console.log('Next Steps:');
console.log(`  1. Review merged data in: ${outputFolder}`);
console.log(`  2. Run analysis scripts with: --input ${outputFolder}`);
console.log(`  3. Example: node tokens_per_story_point.js`);
console.log();
console.log('='.repeat(80));
