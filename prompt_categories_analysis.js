#!/usr/bin/env node

/**
 * Analyze prompt categories from prompts.csv
 * Shows what developers are asking Claude Code to do
 */

const fs = require('fs');
const path = require('path');

const ANALYTICS_DIR = path.join(__dirname, 'analytics 4');

/**
 * Load and parse prompts.csv
 */
function loadPrompts() {
  try {
    const promptsCsv = fs.readFileSync(path.join(ANALYTICS_DIR, 'prompts.csv'), 'utf8');
    const lines = promptsCsv.trim().split('\n');
    const prompts = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip duplicate header rows (check for both old and new schema)
      if (!line || line.startsWith('session_id,agent_id,') || line.startsWith('session_id,user_id,')) continue;

      const cols = line.split(',');

      // NEW SCHEMA: session_id,agent_id,user_id,turn_number,category,subcategory,prompt_length,timestamp
      // Detect schema by checking if cols[1] looks like agent_id (starts with 'agent_')
      const hasAgentId = cols[1] && cols[1].startsWith('agent_');

      let sessionId, userId, turnNumber, category, subcategory, promptLength, timestamp;

      if (hasAgentId) {
        // NEW SCHEMA with agent_id
        sessionId = cols[0];
        userId = cols[2];
        turnNumber = parseInt(cols[3]);
        category = cols[4];
        subcategory = cols[5];
        promptLength = parseInt(cols[6]);
        timestamp = parseInt(cols[7]);
      } else {
        // OLD SCHEMA without agent_id (for backwards compatibility)
        sessionId = cols[0];
        userId = cols[1];
        turnNumber = parseInt(cols[2]);
        category = cols[3];
        subcategory = cols[4];
        promptLength = parseInt(cols[5]);
        timestamp = parseInt(cols[6]);
      }

      prompts.push({
        sessionId,
        userId,
        turnNumber,
        category,
        subcategory,
        promptLength,
        timestamp
      });
    }

    return prompts;
  } catch (error) {
    console.error('Error loading prompts.csv:', error.message);
    return [];
  }
}

/**
 * Analyze prompts by week
 * @param {Array} weeks - Array of week definitions with start, end, name, and period
 */
function analyzePromptCategories(weeks) {
  console.log('='.repeat(80));
  console.log('PROMPT CATEGORIES ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  const prompts = loadPrompts();
  if (prompts.length === 0) {
    console.log('No prompt data available');
    return [];
  }

  console.log(`✓ Loaded ${prompts.length} prompt entries\n`);

  const weeklyData = [];

  weeks.forEach(week => {
    const weekStart = new Date(week.start).getTime();
    const weekEnd = new Date(week.end).getTime() + (24 * 60 * 60 * 1000) - 1;

    const weekPrompts = prompts.filter(p => p.timestamp >= weekStart && p.timestamp <= weekEnd);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`${week.name} (${week.period})`);
    console.log('='.repeat(80));
    console.log(`Total prompts: ${weekPrompts.length}`);

    if (weekPrompts.length === 0) {
      weeklyData.push({
        week: week.name,
        period: week.period,
        totalPrompts: 0,
        avgPromptLength: 0,
        categories: {},
        topCategory: null,
        topSubcategory: null,
        topCategoryCount: 0,
        topSubcategoryCount: 0
      });
      return; // Skip to next week
    }

    // Count by category
    const categoryCount = {};
    const subcategoryCount = {};
    let totalLength = 0;

    weekPrompts.forEach(p => {
      const cat = p.category || 'unknown';
      const subcat = p.subcategory || 'unknown';

      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      subcategoryCount[`${cat}:${subcat}`] = (subcategoryCount[`${cat}:${subcat}`] || 0) + 1;
      totalLength += p.promptLength;
    });

    const avgPromptLength = totalLength / weekPrompts.length;

    // Sort categories by count
    const sortedCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1]);

    const sortedSubcategories = Object.entries(subcategoryCount)
      .sort((a, b) => b[1] - a[1]);

    console.log(`\nAverage prompt length: ${avgPromptLength.toFixed(1)} characters`);
    console.log(`\nTop Categories:`);
    sortedCategories.slice(0, 5).forEach(([cat, count]) => {
      const percentage = (count / weekPrompts.length * 100).toFixed(1);
      console.log(`  ${cat}: ${count} (${percentage}%)`);
    });

    console.log(`\nTop Subcategories:`);
    sortedSubcategories.slice(0, 5).forEach(([subcat, count]) => {
      const percentage = (count / weekPrompts.length * 100).toFixed(1);
      const [cat, sub] = subcat.split(':');
      console.log(`  ${cat} → ${sub}: ${count} (${percentage}%)`);
    });

    // Build category breakdown object
    const categories = {};
    sortedCategories.forEach(([cat, count]) => {
      categories[cat] = {
        count,
        percentage: (count / weekPrompts.length * 100).toFixed(1)
      };
    });

    weeklyData.push({
      week: week.name,
      period: week.period,
      totalPrompts: weekPrompts.length,
      avgPromptLength: parseFloat(avgPromptLength.toFixed(1)),
      categories,
      topCategory: sortedCategories[0] ? sortedCategories[0][0] : null,
      topCategoryCount: sortedCategories[0] ? sortedCategories[0][1] : 0,
      topSubcategory: sortedSubcategories[0] ? sortedSubcategories[0][0].split(':')[1] : null,
      topSubcategoryCount: sortedSubcategories[0] ? sortedSubcategories[0][1] : 0
    });
  });

  // Overall summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(80));

  const allPrompts = prompts.filter(p => {
    const weekStart = new Date(weeks[0].start).getTime();
    const weekEnd = new Date(weeks[weeks.length - 1].end).getTime() + (24 * 60 * 60 * 1000) - 1;
    return p.timestamp >= weekStart && p.timestamp <= weekEnd;
  });

  const overallCategories = {};
  allPrompts.forEach(p => {
    const cat = p.category || 'unknown';
    overallCategories[cat] = (overallCategories[cat] || 0) + 1;
  });

  const sortedOverall = Object.entries(overallCategories)
    .sort((a, b) => b[1] - a[1]);

  console.log(`\nTotal prompts across all weeks: ${allPrompts.length}`);
  console.log(`\nOverall Top Categories:`);
  sortedOverall.forEach(([cat, count]) => {
    const percentage = (count / allPrompts.length * 100).toFixed(1);
    console.log(`  ${cat}: ${count} (${percentage}%)`);
  });

  return weeklyData;
}

// If run directly (not imported)
if (require.main === module) {
  console.error('Error: This script must be called with weeks parameter from generate_dashboard_data.js');
  process.exit(1);
}

// Export for use in other scripts
module.exports = { analyzePromptCategories };
