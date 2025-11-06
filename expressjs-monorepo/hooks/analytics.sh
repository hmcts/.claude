#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Pricing per million tokens
  // Extended context pricing applies when total input tokens > 200K
  PRICING: {
    // AWS Bedrock EU - Claude Sonnet 4.5 (includes 10% regional premium)
    "eu.anthropic.claude-sonnet-4-5-20250929-v1:0": {
      standard: {
        input: 3.30,
        output: 16.50,
        cacheWrite: 4.125,
        cacheRead: 0.33,
      },
      extended: {  // >200K input tokens: 2x input, 1.5x output
        input: 6.60,
        output: 24.75,
        cacheWrite: 8.25,
        cacheRead: 0.66,
      },
    },
    // AWS Bedrock EU - Claude 3 Haiku (no regional premium for 3.x)
    "eu.anthropic.claude-3-haiku-20240307-v1:0": {
      standard: {
        input: 0.25,
        output: 1.25,
        cacheWrite: 0.3125,
        cacheRead: 0.025,
      },
      extended: {  // >200K input tokens: 2x input, 1.5x output
        input: 0.50,
        output: 1.875,
        cacheWrite: 0.625,
        cacheRead: 0.05,
      },
    },
  },
  DEFAULT_MODEL: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
  EXTENDED_CONTEXT_THRESHOLD: 200_000,  // Threshold for extended context pricing

  // File operation settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 100,

  // Git cache settings
  GIT_CACHE_FILE: ".git-cache.json",

  // CSV Headers
  CSV_HEADERS: {
    sessions: "session_id,user_id,repo_url,repo_name,branch,head_commit,started_at,ended_at,turn_count,total_cost_usd,interrupted_turns",
    turns: "session_id,user_id,turn_number,started_at,ended_at,tool_count,total_cost_usd,was_interrupted",
    commits: "commit_sha,session_id,user_id,repo_name,branch,commit_message,author_email,committed_at,files_changed,insertions,deletions,total_loc_changed",
    tools: "session_id,user_id,turn_number,tool_name,started_at,completed_at,success,processing_time_ms,input_size,output_size",
    costs: "session_id,user_id,turn_number,message_id,model,input_tokens,output_tokens,total_tokens,input_cost_usd,output_cost_usd,total_cost_usd,timestamp",
    prompts: "session_id,user_id,turn_number,category,subcategory,prompt_length,timestamp",
    gitOps: "session_id,user_id,operation_type,branch,remote,timestamp,success",
    compactions: "session_id,user_id,turn_number,timestamp,tokens_before,tokens_after,reduction_tokens,reduction_percent,compaction_type,trigger_reason",
  },
};

// Pre-compiled regex patterns for prompt categorization
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape CSV value and prevent CSV injection
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Prevent CSV injection by neutralizing formula characters
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Build CSV row from array of values
 */
function buildCSVRow(values) {
  return values.map((v) => escapeCSV(v)).join(",");
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log debug messages to file
 */
async function logDebug(dataDir, message) {
  try {
    const logFile = path.join(dataDir, "analytics_debug.log");
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    await fs.appendFile(logFile, logEntry);
  } catch (e) {
    // Silently fail
  }
}

/**
 * Log EPIPE errors for debugging
 */
async function logEPIPE(dataDir, context, error) {
  try {
    const logFile = path.join(dataDir, "epipe_errors.log");
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] EPIPE Error - Context: ${context}\nError: ${error.message}\nCode: ${error.code}\nStack: ${error.stack}\n---\n`;
    await fs.appendFile(logFile, logEntry);
  } catch (e) {
    // Silently fail if we can't write the log
  }
}

/**
 * Handle EPIPE error logging helper
 */
async function handleEPIPE(error, context) {
  if (error.code === "EPIPE" || error.message?.includes("EPIPE")) {
    try {
      const dataDir = path.join(process.cwd(), ".claude", "analytics");
      await logEPIPE(dataDir, context, error);
    } catch (e) {
      // Silently fail
    }
  }
}

/**
 * Read git info from cache file
 */
async function readGitCache(dataDir) {
  try {
    const cachePath = path.join(dataDir, CONFIG.GIT_CACHE_FILE);
    const content = await fs.readFile(cachePath, "utf8");
    return JSON.parse(content);
  } catch (e) {
    return null; // Cache doesn't exist or invalid
  }
}

/**
 * Write git info to cache file
 */
async function writeGitCache(dataDir, data) {
  try {
    const cachePath = path.join(dataDir, CONFIG.GIT_CACHE_FILE);
    await fs.writeFile(cachePath, JSON.stringify(data), "utf8");
  } catch (e) {
    // Silently fail - cache is optional
  }
}

/**
 * Append to CSV file with retry logic
 */
async function appendCSV(filePath, data) {
  let retries = 0;

  while (retries < CONFIG.MAX_RETRIES) {
    try {
      await fs.appendFile(filePath, data + "\n");
      return;
    } catch (error) {
      if (error.code === "EBUSY" && retries < CONFIG.MAX_RETRIES - 1) {
        retries++;
        await sleep(CONFIG.RETRY_DELAY_MS);
        continue;
      } else {
        throw new Error(`Failed to write to ${filePath}: ${error.message}`);
      }
    }
  }
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate event data structure
 */
function validateEventData(eventData) {
  if (!eventData || typeof eventData !== "object") {
    return { valid: false, error: "Event data must be an object" };
  }

  const { hook_event_name } = eventData;
  if (!hook_event_name || typeof hook_event_name !== "string") {
    return { valid: false, error: "hook_event_name is required and must be a string" };
  }

  const validEvents = ["UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact", "Stop"];
  if (!validEvents.includes(hook_event_name)) {
    return { valid: false, error: `Unknown hook_event_name: ${hook_event_name}` };
  }

  // Validate tool events have tool_name
  if ((hook_event_name === "PreToolUse" || hook_event_name === "PostToolUse") && !eventData.tool_name) {
    return { valid: false, error: `${hook_event_name} requires tool_name` };
  }

  return { valid: true };
}

// ============================================================================
// ANALYTICS CLASS
// ============================================================================

class SimpleAnalytics {
  constructor() {
    const projectDir = process.cwd();
    this.dataDir = path.join(projectDir, ".claude", "analytics");
    this.stateDir = path.join(this.dataDir, "state");

    // File paths
    this.files = {
      sessions: path.join(this.dataDir, "sessions.csv"),
      turns: path.join(this.dataDir, "turns.csv"),
      commits: path.join(this.dataDir, "commits.csv"),
      tools: path.join(this.dataDir, "tool_usage.csv"),
      costs: path.join(this.dataDir, "costs.csv"),
      prompts: path.join(this.dataDir, "prompts.csv"),
      gitOps: path.join(this.dataDir, "git_operations.csv"),
      compactions: path.join(this.dataDir, "compactions.csv"),
    };

    this.currentTurn = {};
    this.toolStartData = {}; // Tracks tool execution data indexed by unique key
    this.toolCounter = {}; // Counter for generating unique tool keys per session
  }

  /**
   * Initialize analytics (async initialization)
   */
  async initialize() {
    await this.ensureDataDirectory(); // Need dataDir first for cache
    this.userId = await this.getUserId();
    this.repoInfo = await this.getRepoInfo();
    await this.ensureCSVHeaders();

    // Write cache for next time (fire-and-forget, don't await)
    writeGitCache(this.dataDir, {
      userId: this.userId,
      repoUrl: this.repoInfo.url,
      repoName: this.repoInfo.name,
      branch: this.repoInfo.branch,
      headCommit: this.repoInfo.headCommit,
      cachedAt: Date.now()
    }).catch(() => {}); // Ignore errors - cache is optional
  }

  /**
   * Get user ID from git config (with caching)
   */
  async getUserId() {
    // Try cache first
    const cache = await readGitCache(this.dataDir);
    if (cache && cache.userId) {
      return cache.userId;
    }

    // Cache miss - run git commands
    try {
      const { stdout: gitEmail } = await execAsync("git config user.email", { encoding: "utf8" });
      if (gitEmail.trim()) return gitEmail.trim();

      const { stdout: gitName } = await execAsync("git config user.name", { encoding: "utf8" });
      if (gitName.trim()) return gitName.trim();
    } catch (e) {
      // Git not configured
    }
    return process.env.USER || process.env.USERNAME || "unknown";
  }

  /**
   * Get repository information (with caching)
   */
  async getRepoInfo() {
    // Try cache first
    const cache = await readGitCache(this.dataDir);
    if (cache && cache.repoUrl && cache.repoName && cache.branch) {
      return {
        url: cache.repoUrl,
        name: cache.repoName,
        branch: cache.branch,
        headCommit: cache.headCommit || "unknown",
      };
    }

    // Cache miss - run git commands
    try {
      const { stdout: repoUrl } = await execAsync("git remote get-url origin", { encoding: "utf8" });
      const repoName = repoUrl.trim().replace(/.*\/([^\/]+)\.git$/, "$1").replace(/.*\/([^\/]+)$/, "$1");

      const { stdout: currentBranch } = await execAsync("git branch --show-current", { encoding: "utf8" });
      const { stdout: headCommit } = await execAsync("git rev-parse HEAD", { encoding: "utf8" });

      return {
        url: repoUrl.trim(),
        name: repoName,
        branch: currentBranch.trim(),
        headCommit: headCommit.trim(),
      };
    } catch (e) {
      return {
        url: "unknown",
        name: "unknown",
        branch: "unknown",
        headCommit: "unknown",
      };
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.stateDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create analytics directory: ${error.message}`);
    }
  }

  /**
   * Get state file path for a session
   */
  getSessionStateFile(sessionId) {
    return path.join(this.stateDir, `${sessionId}.json`);
  }

  /**
   * Load turn state from disk for a specific session
   */
  async loadTurnState(sessionId) {
    try {
      const stateFile = this.getSessionStateFile(sessionId);
      await logDebug(this.dataDir, `Loading state from: ${stateFile}`);
      if (await fileExists(stateFile)) {
        const stateData = await fs.readFile(stateFile, "utf8");
        const state = JSON.parse(stateData);
        this.currentTurn[sessionId] = state.currentTurn;
        this.toolStartData[sessionId] = state.toolStartData || {};
        this.toolCounter[sessionId] = state.toolCounter || 0;
        await logDebug(this.dataDir, `Loaded state, turn: ${this.currentTurn[sessionId].number}, toolCounter: ${this.toolCounter[sessionId]}`);
      } else {
        await logDebug(this.dataDir, `State file doesn't exist`);
      }
    } catch (error) {
      console.error(`Error loading turn state for ${sessionId}: ${error.message}`);
      await logDebug(this.dataDir, `Load error: ${error.message}`);
    }
  }

  /**
   * Save turn state to disk for a specific session
   */
  async saveTurnState(sessionId) {
    try {
      if (this.currentTurn[sessionId]) {
        const stateFile = this.getSessionStateFile(sessionId);
        const state = {
          currentTurn: this.currentTurn[sessionId],
          toolStartData: this.toolStartData[sessionId] || {},
          toolCounter: this.toolCounter[sessionId] || 0
        };
        const stateData = JSON.stringify(state, null, 2);
        await fs.writeFile(stateFile, stateData);
        await logDebug(this.dataDir, `Saved state: ${stateFile}, turn: ${this.currentTurn[sessionId].number}, toolCounter: ${this.toolCounter[sessionId]}`);
      } else {
        await logDebug(this.dataDir, `No state to save for session: ${sessionId}`);
      }
    } catch (error) {
      console.error(`Error saving turn state for ${sessionId}: ${error.message}`);
      await logDebug(this.dataDir, `Save error: ${error.message}`);
    }
  }

  /**
   * Ensure all CSV files have headers and migrate if schema changed
   */
  async ensureCSVHeaders() {
    const tasks = Object.entries(CONFIG.CSV_HEADERS).map(async ([key, header]) => {
      const filePath = this.files[key];
      if (!(await fileExists(filePath))) {
        await appendCSV(filePath, header);
      } else {
        // Check if existing header matches expected header
        await this.migrateCSVIfNeeded(filePath, header);
      }
    });

    await Promise.all(tasks);
  }

  /**
   * Migrate CSV file if header schema has changed
   */
  async migrateCSVIfNeeded(filePath, expectedHeader) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split("\n").filter(line => line.trim());

      if (lines.length === 0) {
        // Empty file, just write header
        await appendCSV(filePath, expectedHeader);
        return;
      }

      const existingHeader = lines[0];

      // If headers match, no migration needed
      if (existingHeader === expectedHeader) {
        return;
      }

      await logDebug(this.dataDir, `Migrating CSV: ${path.basename(filePath)} (header mismatch)`);

      // Parse old and new headers
      const oldColumns = this.parseCSVRow(existingHeader);
      const newColumns = this.parseCSVRow(expectedHeader);

      // Create column mapping: new column index -> old column index (or -1 if new column)
      const columnMapping = newColumns.map(newCol => oldColumns.indexOf(newCol));

      // Backup old file
      const backupPath = `${filePath}.bak-${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
      await logDebug(this.dataDir, `Backed up to: ${path.basename(backupPath)}`);

      // Write new file with updated schema
      const migratedLines = [expectedHeader];

      for (let i = 1; i < lines.length; i++) {
        const oldValues = this.parseCSVRow(lines[i]);
        const newValues = columnMapping.map(oldIndex =>
          oldIndex >= 0 ? oldValues[oldIndex] || "" : ""
        );
        migratedLines.push(buildCSVRow(newValues));
      }

      await fs.writeFile(filePath, migratedLines.join("\n") + "\n");
      await logDebug(this.dataDir, `Migration complete: ${lines.length - 1} rows migrated`);

    } catch (error) {
      console.error(`Error migrating CSV ${filePath}: ${error.message}`);
      await logDebug(this.dataDir, `Migration error: ${error.message}`);
    }
  }

  /**
   * Parse CSV row respecting quoted values
   */
  parseCSVRow(row) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      const nextChar = row[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    // Push last field
    result.push(current);
    return result;
  }

  /**
   * Process hook event
   */
  async processHookEvent(eventData) {
    // Validate input
    const validation = validateEventData(eventData);
    if (!validation.valid) {
      console.error(`[Analytics Error] Invalid event data: ${validation.error}`);
      await logDebug(this.dataDir, `Invalid event: ${validation.error}`);
      return;
    }

    try {
      const { hook_event_name, tool_name, session_id } = eventData;

      // Debug logging
      await logDebug(this.dataDir, `Event: ${hook_event_name}, SessionID: ${session_id}, Tool: ${tool_name || 'N/A'}`);

      if (hook_event_name === "UserPromptSubmit") {
        await this.handleTurnStart(session_id, eventData);
      } else if (hook_event_name === "PreToolUse" && tool_name) {
        await this.handleToolStart(session_id || this.generateSessionId(), tool_name, eventData);
      } else if (hook_event_name === "PostToolUse" && tool_name) {
        await this.handleToolEnd(session_id, tool_name, eventData);
      } else if (hook_event_name === "PreCompact") {
        await this.handleCompaction(session_id, eventData);
      } else if (hook_event_name === "Stop") {
        await this.handleSessionEnd(session_id, eventData);
      }
    } catch (error) {
      console.error(`[Analytics Error] Failed to process ${eventData.hook_event_name}: ${error.message}`);
      console.error(error.stack);
      await logDebug(this.dataDir, `ERROR: ${error.message}\n${error.stack}`);
    }
  }

  /**
   * Handle turn start
   */
  async handleTurnStart(sessionId, eventData) {
    const now = Date.now();
    const { prompt } = eventData;

    // Load state for this session if not already loaded
    if (!this.currentTurn[sessionId]) {
      await this.loadTurnState(sessionId);
    }

    // Write previous turn data if exists
    if (this.currentTurn[sessionId]) {
      await this.writeTurnData(sessionId, now, false);
    }

    // Initialize or increment turn
    if (!this.currentTurn[sessionId]) {
      this.currentTurn[sessionId] = { number: 1, startTime: now, toolCount: 0, turnCost: 0, totalSessionCost: 0 };
    } else {
      this.currentTurn[sessionId].number++;
      this.currentTurn[sessionId].startTime = now;
      this.currentTurn[sessionId].toolCount = 0;
      this.currentTurn[sessionId].turnCost = 0;
      // Keep totalSessionCost accumulating
    }

    await this.saveTurnState(sessionId);

    // Categorize and record prompt
    if (prompt && prompt.trim()) {
      const { category, subcategory } = this.categorizePrompt(prompt);
      const promptData = buildCSVRow([
        sessionId,
        this.userId,
        this.currentTurn[sessionId].number,
        category,
        subcategory,
        prompt.trim().length,
        now,
      ]);

      await appendCSV(this.files.prompts, promptData);
    }
  }

  /**
   * Get current turn number for session
   */
  getCurrentTurnNumber(sessionId) {
    return this.currentTurn[sessionId]?.number || 1;
  }

  /**
   * Categorize prompt using pre-compiled regex patterns
   */
  categorizePrompt(promptText) {
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

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Write turn data to CSV
   */
  async writeTurnData(sessionId, endTime, wasInterrupted) {
    if (!this.currentTurn[sessionId]) {
      return;
    }

    const turnData = buildCSVRow([
      sessionId,
      this.userId,
      this.currentTurn[sessionId].number,
      this.currentTurn[sessionId].startTime,
      endTime,
      this.currentTurn[sessionId].toolCount,
      this.currentTurn[sessionId].turnCost || 0,
      wasInterrupted ? 1 : 0,
    ]);

    await appendCSV(this.files.turns, turnData);
  }

  /**
   * Handle tool start
   */
  async handleToolStart(sessionId, toolName, eventData) {
    const now = Date.now();

    // Load state for this session if not already loaded
    if (!this.currentTurn[sessionId]) {
      await this.loadTurnState(sessionId);
    }

    const turnNumber = this.getCurrentTurnNumber(sessionId);

    await logDebug(this.dataDir, `ToolStart: ${toolName}, turn: ${turnNumber}`);

    // Increment tool count
    if (this.currentTurn[sessionId]) {
      this.currentTurn[sessionId].toolCount++;
    }

    // Generate unique key for this tool execution
    if (!this.toolCounter[sessionId]) this.toolCounter[sessionId] = 0;
    this.toolCounter[sessionId]++;
    const toolKey = `${sessionId}_${toolName}_${this.toolCounter[sessionId]}`;

    // Store start data for later completion
    if (!this.toolStartData[sessionId]) this.toolStartData[sessionId] = {};
    this.toolStartData[sessionId][toolKey] = {
      toolName,
      turnNumber,
      startTime: now,
      inputSize: JSON.stringify(eventData.tool_input || {}).length,
    };

    // Save state with tool tracking data
    await this.saveTurnState(sessionId);

    // Handle git operations (tracked in PreToolUse since we just need the command)
    if (toolName === "Bash" && eventData.tool_input?.command) {
      await this.handleGitOperations(sessionId, eventData.tool_input.command);
    }
  }

  /**
   * Handle tool end
   */
  async handleToolEnd(sessionId, toolName, eventData) {
    const now = Date.now();
    const { tool_output, success = true } = eventData;

    // Load state for this session if not already loaded
    if (!this.currentTurn[sessionId]) {
      await this.loadTurnState(sessionId);
    }

    await logDebug(this.dataDir, `ToolEnd: ${toolName}`);

    // Find the most recent matching tool start data
    const matchingKey = this.toolStartData[sessionId]
      ? Object.keys(this.toolStartData[sessionId])
          .reverse()
          .find(key => this.toolStartData[sessionId][key].toolName === toolName)
      : null;

    if (!matchingKey) {
      console.error(`[Analytics Warning] No matching tool start found for tool: ${toolName}, session: ${sessionId}. Tool completion data dropped.`);
      await logDebug(this.dataDir, `ToolEnd WARNING: No matching start for ${toolName}`);
      return;
    }

    const startData = this.toolStartData[sessionId][matchingKey];
    const processingTime = now - startData.startTime;
    const outputSize = JSON.stringify(tool_output || {}).length;

    // Write single complete row
    const toolData = buildCSVRow([
      sessionId,
      this.userId,
      startData.turnNumber,
      toolName,
      startData.startTime,
      now,
      success ? "1" : "0",
      processingTime,
      startData.inputSize,
      outputSize,
    ]);

    await appendCSV(this.files.tools, toolData);

    // Clean up the stored start data
    delete this.toolStartData[sessionId][matchingKey];

    // Handle git commits (tracked in PostToolUse so commit has completed)
    if (toolName === "Bash" && startData.inputSize) {
      // Get original command from tool input via eventData
      const command = eventData.tool_input?.command || "";
      if (command) {
        await this.handleGitCommand(sessionId, command);
      }
    }

    // Save state to persist the cleanup
    await this.saveTurnState(sessionId);
  }

  /**
   * Handle compaction event
   */
  async handleCompaction(sessionId, eventData) {
    const now = Date.now();
    const turnNumber = this.getCurrentTurnNumber(sessionId);

    const tokensBefore = eventData.tokens_before || eventData.context_window_before || 0;
    const tokensAfter = eventData.tokens_after || eventData.context_window_after || 0;
    const reductionTokens = tokensBefore - tokensAfter;
    const reductionPercent = tokensBefore > 0 ? ((reductionTokens / tokensBefore) * 100).toFixed(2) : 0;

    const compactionType = eventData.compaction_type || eventData.type || "auto";
    const triggerReason = eventData.trigger_reason || eventData.reason || "threshold";

    const compactionData = buildCSVRow([
      sessionId,
      this.userId,
      turnNumber,
      now,
      tokensBefore,
      tokensAfter,
      reductionTokens,
      reductionPercent,
      compactionType,
      triggerReason,
    ]);

    await appendCSV(this.files.compactions, compactionData);
  }

  /**
   * Handle session end
   */
  async handleSessionEnd(sessionId, eventData) {
    const now = Date.now();
    const { transcript_path, was_interrupted } = eventData;

    // Load state for this session if not already loaded
    if (!this.currentTurn[sessionId]) {
      await this.loadTurnState(sessionId);
    }

    const turnNumber = this.getCurrentTurnNumber(sessionId);

    await logDebug(this.dataDir, `SessionEnd: transcript_path=${transcript_path}, turnNumber=${turnNumber}`);
    await logDebug(this.dataDir, `SessionEnd: has transcript=${!!transcript_path}, has currentTurn=${!!this.currentTurn[sessionId]}`);

    let totalCost = 0;

    // Parse transcript for token usage
    if (transcript_path && this.currentTurn[sessionId]) {
      await logDebug(this.dataDir, `About to parse transcript...`);
      const tokenRecords = await this.parseTranscriptTokens(transcript_path);
      await logDebug(this.dataDir, `Parsed ${tokenRecords.length} token records from transcript`);

      if (tokenRecords.length > 0) {
        const latestRecord = tokenRecords[tokenRecords.length - 1];

        const costData = buildCSVRow([
          sessionId,
          this.userId,
          turnNumber,
          latestRecord.message_id || "",
          latestRecord.model_name || CONFIG.DEFAULT_MODEL,
          latestRecord.input_tokens || 0,
          latestRecord.output_tokens || 0,
          latestRecord.total_tokens || 0,
          latestRecord.input_cost_usd || 0,
          latestRecord.output_cost_usd || 0,
          latestRecord.total_cost_usd || 0,
          latestRecord.timestamp || now,
        ]);

        await appendCSV(this.files.costs, costData);

        this.currentTurn[sessionId].turnCost = latestRecord.total_cost_usd || 0;
        // Accumulate total session cost incrementally
        this.currentTurn[sessionId].totalSessionCost += latestRecord.total_cost_usd || 0;
        await this.saveTurnState(sessionId);
      }
    }

    // Use accumulated cost from state instead of reading entire file
    totalCost = this.currentTurn[sessionId]?.totalSessionCost || 0;

    await this.updateSessionRecord(sessionId, turnNumber, totalCost, was_interrupted, now);

    // Clean up session data to prevent memory leak
    await this.cleanupSession(sessionId);
  }

  /**
   * Clean up session data to prevent memory leaks
   */
  async cleanupSession(sessionId) {
    delete this.currentTurn[sessionId];
    delete this.toolStartData[sessionId];
    delete this.toolCounter[sessionId];

    // NOTE: We do NOT delete the state file here because Stop fires after each turn,
    // not just at the end of the session. State files persist across turns and will
    // be naturally cleaned up when sessions expire or manually by the user.
  }


  /**
   * Update session record (append-only to prevent file corruption)
   */
  async updateSessionRecord(sessionId, turnCount, totalCost, wasInterrupted, endTime) {
    try {
      const startTime = this.currentTurn[sessionId]?.startTime || "";

      const sessionData = buildCSVRow([
        sessionId,
        this.userId,
        this.repoInfo.url,
        this.repoInfo.name,
        this.repoInfo.branch,
        this.repoInfo.headCommit,
        startTime,
        endTime,
        turnCount,
        totalCost.toFixed(10),
        wasInterrupted ? 1 : 0,
      ]);

      // Append-only approach: prevents file corruption from concurrent access
      // Note: sessions.csv may contain multiple records per session_id
      // When reading, take the latest record for each session
      await appendCSV(this.files.sessions, sessionData);
    } catch (error) {
      console.error(`Error updating session record: ${error.message}`);
    }
  }

  /**
   * Handle git operations tracking
   */
  async handleGitOperations(sessionId, command) {
    const now = Date.now();
    let operationType = null;
    let branch = this.repoInfo.branch;
    let remote = "origin";

    if (/git\s+push/.test(command)) {
      operationType = "push";
      const pushMatch = command.match(/git\s+push\s+(\S+)(?:\s+(\S+))?/);
      if (pushMatch) {
        remote = pushMatch[1] || "origin";
        branch = pushMatch[2] || branch;
      }
    } else if (/git\s+pull/.test(command)) {
      operationType = "pull";
      const pullMatch = command.match(/git\s+pull\s+(\S+)(?:\s+(\S+))?/);
      if (pullMatch) {
        remote = pullMatch[1] || "origin";
        branch = pullMatch[2] || branch;
      }
    } else if (/git\s+fetch/.test(command)) {
      operationType = "fetch";
      const fetchMatch = command.match(/git\s+fetch\s+(\S+)?/);
      if (fetchMatch) {
        remote = fetchMatch[1] || "origin";
      }
    } else if (/git\s+clone/.test(command)) {
      operationType = "clone";
    } else if (/git\s+merge/.test(command)) {
      operationType = "merge";
      const mergeMatch = command.match(/git\s+merge\s+(\S+)/);
      if (mergeMatch) {
        branch = mergeMatch[1];
      }
    }

    if (operationType) {
      const gitOpData = buildCSVRow([sessionId, this.userId, operationType, branch, remote, now, 1]);
      await appendCSV(this.files.gitOps, gitOpData);
    }
  }

  /**
   * Handle git commit tracking
   */
  async handleGitCommand(sessionId, command) {
    if (!/git\s+commit/.test(command)) {
      return;
    }

    try {
      const { stdout: commitSha } = await execAsync("git rev-parse HEAD", { encoding: "utf8" });
      const { stdout: commitMsg } = await execAsync('git log -1 --pretty=format:"%s"', { encoding: "utf8" });
      const { stdout: authorEmail } = await execAsync('git log -1 --pretty=format:"%ae"', { encoding: "utf8" });
      const { stdout: committedAt } = await execAsync('git log -1 --pretty=format:"%ct"', { encoding: "utf8" });

      let filesChanged = 0,
        insertions = 0,
        deletions = 0;

      try {
        const { stdout: statOutput } = await execAsync(`git show --stat --format="" ${commitSha.trim()}`, {
          encoding: "utf8",
        });
        const statMatch = statOutput.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        if (statMatch) {
          filesChanged = parseInt(statMatch[1]) || 0;
          insertions = parseInt(statMatch[2]) || 0;
          deletions = parseInt(statMatch[3]) || 0;
        }
      } catch (statError) {
        // Stats not available
      }

      const totalLoc = insertions + deletions;

      const commitData = buildCSVRow([
        commitSha.trim(),
        sessionId,
        this.userId,
        this.repoInfo.name,
        this.repoInfo.branch,
        commitMsg.trim(),
        authorEmail.trim(),
        parseInt(committedAt.trim()) * 1000,
        filesChanged,
        insertions,
        deletions,
        totalLoc,
      ]);

      await appendCSV(this.files.commits, commitData);
    } catch (error) {
      console.error(`Error tracking git commit: ${error.message}`);
    }
  }

  /**
   * Parse transcript for token usage
   */
  async parseTranscriptTokens(transcriptPath) {
    try {
      if (!(await fileExists(transcriptPath))) {
        return [];
      }

      const content = await fs.readFile(transcriptPath, "utf8");
      const lines = content.split("\n");
      const tokenRecords = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line);

          if (entry.type === "assistant" && entry.message?.usage) {
            const usage = entry.message.usage;
            const modelName = entry.message.model;
            const costs = this.calculateTokenCost(usage, modelName);
            const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);

            tokenRecords.push({
              message_id: entry.message.id,
              input_tokens: usage.input_tokens || 0,
              output_tokens: usage.output_tokens || 0,
              total_tokens: totalTokens,
              model_name: modelName,
              timestamp: new Date(entry.timestamp).getTime(),
              ...costs,
            });
          }
        } catch (parseErr) {
          // Skip invalid JSON lines
        }
      }

      return tokenRecords;
    } catch (error) {
      return [];
    }
  }

  /**
   * Calculate token cost with extended context pricing support
   */
  calculateTokenCost(usage, modelName) {
    const modelPricing = CONFIG.PRICING[modelName] || CONFIG.PRICING[CONFIG.DEFAULT_MODEL];

    // Calculate total input tokens (including cache) to determine pricing tier
    const totalInputTokens = (usage.input_tokens || 0) +
                            (usage.cache_creation_input_tokens || 0) +
                            (usage.cache_read_input_tokens || 0);

    // Select pricing tier based on input token threshold
    // Extended pricing applies when total input > 200K tokens
    let pricing;
    if (modelPricing.standard && modelPricing.extended) {
      pricing = totalInputTokens > CONFIG.EXTENDED_CONTEXT_THRESHOLD
        ? modelPricing.extended
        : modelPricing.standard;
    } else {
      // Fallback for old pricing format (direct pricing object)
      pricing = modelPricing;
    }

    // Calculate costs using selected pricing tier
    const inputCost = ((usage.input_tokens || 0) / 1_000_000) * pricing.input;
    const outputCost = ((usage.output_tokens || 0) / 1_000_000) * pricing.output;
    const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.cacheWrite;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.cacheRead;

    return {
      input_cost_usd: inputCost,
      output_cost_usd: outputCost,
      cache_write_cost_usd: cacheWriteCost,
      cache_read_cost_usd: cacheReadCost,
      total_cost_usd: inputCost + outputCost + cacheWriteCost + cacheReadCost,
    };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

if (require.main === module) {
  let analytics;

  // Attach EPIPE error handlers FIRST, before any other code
  // This prevents unhandled EPIPE errors if Claude Code closes the pipe
  // Use synchronous handlers to exit immediately without waiting for async operations
  process.stdin.on("error", (error) => {
    if (error.code === "EPIPE") {
      // Silently exit on broken pipe - this is expected when Claude Code closes early
      process.exit(0);
    }
    process.exit(1);
  });

  process.stdout.on("error", (error) => {
    if (error.code === "EPIPE") {
      // Silently exit on broken pipe - this is expected when Claude Code closes early
      process.exit(0);
    }
    process.exit(1);
  });

  process.stderr.on("error", (error) => {
    if (error.code === "EPIPE") {
      // Silently exit on broken pipe - this is expected when Claude Code closes early
      process.exit(0);
    }
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    if (error.code === "EPIPE") {
      // Silently exit on broken pipe - this is expected when Claude Code closes early
      process.exit(0);
    }
    // Try to log non-EPIPE errors (but don't wait for it)
    handleEPIPE(error, "uncaught exception").catch(() => {});
    process.exit(1);
  });

  // Read JSON from stdin with size limit
  const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB limit
  let inputData = "";
  let inputSize = 0;

  process.stdin.on("data", (chunk) => {
    inputSize += chunk.length;
    if (inputSize > MAX_INPUT_SIZE) {
      console.error(`[Analytics Error] Input exceeds maximum size of ${MAX_INPUT_SIZE} bytes`);
      process.exit(1);
    }
    inputData += chunk;
  });

  process.stdin.on("end", async () => {
    try {
      // Initialize analytics
      analytics = new SimpleAnalytics();
      await analytics.initialize();

      // Process event data
      if (inputData.trim()) {
        const eventData = JSON.parse(inputData);
        await analytics.processHookEvent(eventData);
      }

      // Explicitly exit with success after async work completes
      process.exit(0);
    } catch (error) {
      console.error("Error processing input:", error.message);
      await handleEPIPE(error, "main execution");
      process.exit(1);
    }
  });
}
