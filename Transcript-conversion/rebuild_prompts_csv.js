#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const transcriptDir = path.join(__dirname, '-workspaces-cath-service');
const oldPromptsCsvPath = '/Users/alexjonesysol/Documents/claude epipe fix/.claude/analytics 4/prompts.csv';
const newPromptsCsvPath = '/Users/alexjonesysol/Documents/claude epipe fix/.claude/analytics 4/prompts_corrected.csv';

const nov10 = new Date('2025-11-10T00:00:00Z').getTime();
const nov15 = new Date('2025-11-15T00:00:00Z').getTime();

// Same patterns from analytics.sh
const PROMPT_PATTERNS = {
  featureDev: /\b(add|create|implement|build|new feature|develop|initialise|initialize)\b/i,
  bugFix: /\b(fix|bug|error|issue|broken|not working|doesn't work|doesnt work)\b/i,
  testing: /\b(test|testing|spec|unit test|integration test|e2e|verify|validate|behaviour|behavior)\b/i,
  refactoring: /\b(refactor|cleanup|clean up|reorganize|reorganise|restructure|improve|optimize|optimise)\b/i,
  documentation: /\b(document|documentation|comment|readme|docs|explain|describe|summarise|summarize)\b/i,
  codeUnderstanding: /\b(what|how|why|where|when|explain|understand|show me|tell me|can you|could you|would you|find|analyse|analyze)\b/i,
  explanation: /\b(how does|how is|explain|understand)\b/i,
  navigation: /\b(find|search|where|locate)\b/i,
  debugging: /\b(debug|debugger|breakpoint|trace|inspect|investigate|troubleshoot)\b/i,
  codeReview: /\b(review|check|verify|validate|look at|examine|analyse|analyze)\b/i,
  configuration: /\b(config|configure|setup|set up|install|deploy|initialise|initialize)\b/i,
  versionControl: /\b(commit|push|pull|merge|branch|git|pr|pull request|rebase)\b/i,
};

function categorizePrompt(promptText) {
  // Feature Development
  if (PROMPT_PATTERNS.featureDev.test(promptText)) {
    if (PROMPT_PATTERNS.testing.test(promptText)) {
      return { category: "feature_development", subcategory: "with_tests" };
    }
    return { category: "feature_development", subcategory: "implementation" };
  }

  // Bug Fixes
  if (PROMPT_PATTERNS.bugFix.test(promptText)) {
    if (PROMPT_PATTERNS.testing.test(promptText)) {
      return { category: "bug_fix", subcategory: "with_tests" };
    }
    return { category: "bug_fix", subcategory: "fix" };
  }

  // Testing
  if (PROMPT_PATTERNS.testing.test(promptText)) {
    return { category: "testing", subcategory: "writing_tests" };
  }

  // Refactoring
  if (PROMPT_PATTERNS.refactoring.test(promptText)) {
    return { category: "refactoring", subcategory: "code_improvement" };
  }

  // Documentation
  if (PROMPT_PATTERNS.documentation.test(promptText)) {
    return { category: "documentation", subcategory: "writing_docs" };
  }

  // Code Understanding / Questions
  if (PROMPT_PATTERNS.codeUnderstanding.test(promptText)) {
    if (PROMPT_PATTERNS.explanation.test(promptText)) {
      return { category: "code_understanding", subcategory: "explanation" };
    }
    if (PROMPT_PATTERNS.navigation.test(promptText)) {
      return { category: "code_understanding", subcategory: "navigation" };
    }
    return { category: "code_understanding", subcategory: "question" };
  }

  // Debugging
  if (PROMPT_PATTERNS.debugging.test(promptText)) {
    return { category: "debugging", subcategory: "investigation" };
  }

  // Code Review
  if (PROMPT_PATTERNS.codeReview.test(promptText)) {
    return { category: "code_review", subcategory: "review" };
  }

  // Configuration / Setup
  if (PROMPT_PATTERNS.configuration.test(promptText)) {
    return { category: "configuration", subcategory: "setup" };
  }

  // Git / Version Control
  if (PROMPT_PATTERNS.versionControl.test(promptText)) {
    return { category: "version_control", subcategory: "git_operations" };
  }

  // General / Other
  return { category: "general", subcategory: "other" };
}

function isActualUserInput(data) {
  if (data.type !== 'user' || !data.message) return false;
  if (data.isMeta) return false;

  let content = data.message.content;
  let contentStr = '';

  if (Array.isArray(content)) {
    if (content.some(item => item.type === 'tool_result' || item.tool_use_id !== undefined)) {
      return false;
    }
    contentStr = JSON.stringify(content);
  } else if (typeof content === 'string') {
    contentStr = content;
  } else {
    return false;
  }

  // Filter system-generated
  if (contentStr.includes('tool_use_id') || contentStr.includes('tool_result')) return false;
  if (contentStr.includes('<command-message>')) return false;
  if (contentStr.includes('[Request interrupted by user]')) return false;
  if (contentStr.trim().length === 0) return false;
  if (contentStr.includes('This session is being continued from a previous conversation')) return false;
  if (contentStr.match(/^Unknown slash command:/)) return false;
  if (contentStr.includes('<local-command-stdout>')) return false;

  return true;
}

async function extractPromptsFromTranscript(sessionId) {
  const filePath = path.join(transcriptDir, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const prompts = [];
  let turnNumber = 0;

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);

      if (data.timestamp) {
        const ts = new Date(data.timestamp).getTime();

        if (ts >= nov10 && ts < nov15) {
          if (isActualUserInput(data)) {
            turnNumber++;
            let content = typeof data.message.content === 'string'
              ? data.message.content
              : JSON.stringify(data.message.content);

            const { category, subcategory } = categorizePrompt(content);

            prompts.push({
              session_id: sessionId,
              user_id: '84805836+junaidiqbalmoj@users.noreply.github.com',
              turn_number: turnNumber,
              category,
              subcategory,
              prompt_length: content.trim().length,
              timestamp: ts
            });
          }
        }
      }
    } catch (e) {}
  }

  return prompts;
}

function getSessionsNotInTranscripts() {
  const fileContent = fs.readFileSync(oldPromptsCsvPath, 'utf8');
  const lines = fileContent.trim().split('\n');
  const dataLines = lines.slice(1);

  const transcriptFiles = fs.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))
    .map(f => f.replace('.jsonl', ''));

  const transcriptSessionsSet = new Set(transcriptFiles);
  const csvOnlySessions = new Set();
  const csvOnlyPrompts = [];

  for (const line of dataLines) {
    const parts = line.split(',');
    const sessionId = parts[0];
    const timestamp = parseInt(parts[6]);

    if (timestamp >= nov10 && timestamp < nov15) {
      if (!transcriptSessionsSet.has(sessionId)) {
        csvOnlySessions.add(sessionId);

        csvOnlyPrompts.push({
          session_id: sessionId,
          user_id: parts[1],
          turn_number: parseInt(parts[2]),
          category: parts[3],
          subcategory: parts[4],
          prompt_length: parseInt(parts[5]),
          timestamp: timestamp
        });
      }
    }
  }

  return csvOnlyPrompts;
}

async function main() {
  console.log('='.repeat(80));
  console.log('REBUILDING prompts.csv WITH CORRECT CATEGORIZATION');
  console.log('='.repeat(80));
  console.log();

  const files = fs.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

  const allPrompts = [];

  console.log('Extracting prompts from transcripts...');
  for (const file of files) {
    const sessionId = file.replace('.jsonl', '');
    const prompts = await extractPromptsFromTranscript(sessionId);
    allPrompts.push(...prompts);
    if (prompts.length > 0) {
      console.log(`  ${sessionId.substring(0, 8)}... : ${prompts.length} prompts`);
    }
  }

  console.log();
  console.log('Including prompts from CSV sessions not in transcripts...');
  const csvOnlyPrompts = getSessionsNotInTranscripts();

  // Deduplicate CSV-only prompts
  const csvOnlyUnique = new Map();
  csvOnlyPrompts.forEach(p => {
    const key = `${p.session_id}-${p.turn_number}`;
    if (!csvOnlyUnique.has(key)) {
      csvOnlyUnique.set(key, p);
    }
  });

  allPrompts.push(...csvOnlyUnique.values());
  console.log(`  ${csvOnlyUnique.size} prompts from sessions not in transcript folder`);
  console.log();

  // Sort by timestamp
  allPrompts.sort((a, b) => a.timestamp - b.timestamp);

  // Write new CSV
  const csvLines = ['session_id,user_id,turn_number,category,subcategory,prompt_length,timestamp'];

  for (const prompt of allPrompts) {
    csvLines.push(
      `${prompt.session_id},${prompt.user_id},${prompt.turn_number},${prompt.category},${prompt.subcategory},${prompt.prompt_length},${prompt.timestamp}`
    );
  }

  fs.writeFileSync(newPromptsCsvPath, csvLines.join('\n') + '\n');

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total prompts written: ${allPrompts.length}`);
  console.log(`  From transcripts: ${allPrompts.length - csvOnlyUnique.size}`);
  console.log(`  From CSV only: ${csvOnlyUnique.size}`);
  console.log();
  console.log(`New file created: ${newPromptsCsvPath}`);
  console.log();
  console.log('Categorization breakdown:');
  const categoryCounts = {};
  allPrompts.forEach(p => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const percentage = ((count / allPrompts.length) * 100).toFixed(1);
      console.log(`  ${category}: ${count} (${percentage}%)`);
    });

  console.log();
  console.log('Next steps:');
  console.log('  1. Review the new file: prompts_corrected.csv');
  console.log('  2. If it looks good, replace the old prompts.csv:');
  console.log('     mv prompts_corrected.csv prompts.csv');
  console.log('='.repeat(80));
}

main().catch(console.error);
