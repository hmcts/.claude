#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class SimpleAnalytics {
  constructor() {
    // Store analytics in the consuming project, not the plugin directory
    const projectDir = process.cwd();
    this.dataDir = path.join(projectDir, ".claude", "analytics");
    this.sessionsFile = path.join(this.dataDir, "sessions.csv");
    this.turnsFile = path.join(this.dataDir, "turns.csv");
    this.commitsFile = path.join(this.dataDir, "commits.csv");
    this.toolsFile = path.join(this.dataDir, "tool_usage.csv");
    this.costsFile = path.join(this.dataDir, "costs.csv");
    this.promptsFile = path.join(this.dataDir, "prompts.csv");
    this.gitOpsFile = path.join(this.dataDir, "git_operations.csv");
    this.compactionsFile = path.join(this.dataDir, "compactions.csv");
    this.turnStateFile = path.join(this.dataDir, "turn_state.json"); // NEW: persist turn state

    this.userId = this.getUserId();
    this.repoInfo = this.getRepoInfo();
    this.currentTurn = {}; // Track turn number per session

    this.ensureDataDirectory();
    this.ensureCSVHeaders();
    this.loadTurnState(); // NEW: load persisted turn state
  }

  getUserId() {
    try {
      const gitEmail = execSync("git config user.email", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      if (gitEmail) return gitEmail;

      const gitName = execSync("git config user.name", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      if (gitName) return gitName;
    } catch (e) {
      // Git not configured
    }
    return process.env.USER || process.env.USERNAME || "unknown";
  }

  getRepoInfo() {
    try {
      const repoUrl = execSync("git remote get-url origin", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      const repoName = repoUrl.replace(/.*\/([^\/]+)\.git$/, "$1").replace(/.*\/([^\/]+)$/, "$1");
      const currentBranch = execSync("git branch --show-current", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
      const headCommit = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();

      return {
        url: repoUrl,
        name: repoName,
        branch: currentBranch,
        headCommit: headCommit
      };
    } catch (e) {
      return {
        url: "unknown",
        name: "unknown",
        branch: "unknown",
        headCommit: "unknown"
      };
    }
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadTurnState() {
    try {
      if (fs.existsSync(this.turnStateFile)) {
        const stateData = fs.readFileSync(this.turnStateFile, "utf8");
        this.currentTurn = JSON.parse(stateData);
      }
    } catch (error) {
      console.error(`Error loading turn state: ${error.message}`);
      this.currentTurn = {};
    }
  }

  saveTurnState() {
    try {
      fs.writeFileSync(this.turnStateFile, JSON.stringify(this.currentTurn, null, 2));
    } catch (error) {
      console.error(`Error saving turn state: ${error.message}`);
    }
  }

  ensureCSVHeaders() {
    // Sessions CSV
    if (!fs.existsSync(this.sessionsFile)) {
      this.appendCSV(
        this.sessionsFile,
        "session_id,user_id,repo_url,repo_name,branch,head_commit,started_at,ended_at,turn_count,total_cost_usd,interrupted_turns"
      );
    }

    // Turns CSV - NEW
    if (!fs.existsSync(this.turnsFile)) {
      this.appendCSV(this.turnsFile, "session_id,user_id,turn_number,started_at,ended_at,tool_count,total_cost_usd,was_interrupted");
    }

    // Commits CSV - with LOC changes
    if (!fs.existsSync(this.commitsFile)) {
      this.appendCSV(
        this.commitsFile,
        "commit_sha,session_id,user_id,repo_name,branch,commit_message,author_email,committed_at,files_changed,insertions,deletions,total_loc_changed"
      );
    }

    // Tools CSV - add user_id and turn_number
    if (!fs.existsSync(this.toolsFile)) {
      this.appendCSV(this.toolsFile, "session_id,user_id,turn_number,tool_name,started_at,completed_at,success,processing_time_ms,input_size,output_size");
    }

    // Costs CSV - add user_id and turn_number
    if (!fs.existsSync(this.costsFile)) {
      this.appendCSV(
        this.costsFile,
        "session_id,user_id,turn_number,message_id,input_tokens,output_tokens,total_tokens,input_cost_usd,output_cost_usd,total_cost_usd,timestamp"
      );
    }

    // Prompts CSV - categorized instead of full text
    if (!fs.existsSync(this.promptsFile)) {
      this.appendCSV(this.promptsFile, "session_id,user_id,turn_number,category,subcategory,prompt_length,timestamp");
    }

    // Git Operations CSV - NEW
    if (!fs.existsSync(this.gitOpsFile)) {
      this.appendCSV(this.gitOpsFile, "session_id,user_id,operation_type,branch,remote,timestamp,success");
    }

    // Compactions CSV - Track auto-compactions with detailed metrics
    if (!fs.existsSync(this.compactionsFile)) {
      this.appendCSV(
        this.compactionsFile,
        "session_id,user_id,turn_number,timestamp,tokens_before,tokens_after,reduction_tokens,reduction_percent,compaction_type,trigger_reason"
      );
    }
  }

  appendCSV(filePath, data) {
    // Simple file locking - retry if file is busy
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        fs.appendFileSync(filePath, data + "\n");
        return;
      } catch (error) {
        if (error.code === "EBUSY" && retries < maxRetries - 1) {
          retries++;
          // Wait a bit and retry
          require("child_process").execSync("sleep 0.1");
          continue;
        } else {
          console.error(`Failed to write to ${filePath}: ${error.message}`);
          return;
        }
      }
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  async processHookEvent(eventData) {
    try {
      const { hook_event_name, tool_name, session_id, user_id } = eventData;

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
      console.error(`Error processing hook event: ${error.message}`);
    }
  }

  async handleTurnStart(sessionId, eventData) {
    const now = Date.now();
    const { prompt } = eventData;

    // If there's a previous turn, write it before starting new turn
    if (this.currentTurn[sessionId]) {
      await this.writeTurnData(sessionId, now, false);
    }

    // Increment turn number for this session
    if (!this.currentTurn[sessionId]) {
      this.currentTurn[sessionId] = { number: 1, startTime: now, toolCount: 0, turnCost: 0 };
    } else {
      this.currentTurn[sessionId].number++;
      this.currentTurn[sessionId].startTime = now;
      this.currentTurn[sessionId].toolCount = 0;
      this.currentTurn[sessionId].turnCost = 0;
    }

    // Save turn state to disk
    this.saveTurnState();

    // Categorize and record user prompt
    if (prompt && prompt.trim()) {
      const { category, subcategory } = this.categorizePrompt(prompt);
      const promptData = [
        sessionId,
        this.userId,
        this.currentTurn[sessionId].number,
        category,
        subcategory,
        prompt.trim().length, // Store length instead of full text
        now
      ]
        .map((v) => this.escapeCSV(v))
        .join(",");

      this.appendCSV(this.promptsFile, promptData);
    }
  }

  getCurrentTurnNumber(sessionId) {
    return this.currentTurn[sessionId]?.number || 1;
  }

  categorizePrompt(promptText) {
    const lower = promptText.toLowerCase();

    // Feature Development
    if (/\b(add|create|implement|build|new feature|develop|initialise|initialize)\b/.test(lower)) {
      if (/\b(test|spec|unit test|integration test)\b/.test(lower)) {
        return { category: "feature_development", subcategory: "with_tests" };
      }
      return { category: "feature_development", subcategory: "implementation" };
    }

    // Bug Fixes
    if (/\b(fix|bug|error|issue|broken|not working|doesn't work|doesnt work)\b/.test(lower)) {
      if (/\b(test)\b/.test(lower)) {
        return { category: "bug_fix", subcategory: "with_tests" };
      }
      return { category: "bug_fix", subcategory: "fix" };
    }

    // Testing
    if (/\b(test|testing|spec|unit test|integration test|e2e|verify|validate|behaviour|behavior)\b/.test(lower)) {
      return { category: "testing", subcategory: "writing_tests" };
    }

    // Refactoring
    if (/\b(refactor|cleanup|clean up|reorganize|reorganise|restructure|improve|optimize|optimise)\b/.test(lower)) {
      return { category: "refactoring", subcategory: "code_improvement" };
    }

    // Documentation
    if (/\b(document|documentation|comment|readme|docs|explain|describe|summarise|summarize)\b/.test(lower)) {
      return { category: "documentation", subcategory: "writing_docs" };
    }

    // Code Understanding / Questions
    if (/\b(what|how|why|where|when|explain|understand|show me|tell me|can you|could you|would you|find|analyse|analyze)\b/.test(lower)) {
      if (/\b(how does|how is|explain|understand)\b/.test(lower)) {
        return { category: "code_understanding", subcategory: "explanation" };
      }
      if (/\b(find|search|where|locate)\b/.test(lower)) {
        return { category: "code_understanding", subcategory: "navigation" };
      }
      return { category: "code_understanding", subcategory: "question" };
    }

    // Debugging
    if (/\b(debug|debugger|breakpoint|trace|inspect|investigate|troubleshoot)\b/.test(lower)) {
      return { category: "debugging", subcategory: "investigation" };
    }

    // Code Review
    if (/\b(review|check|verify|validate|look at|examine|analyse|analyze)\b/.test(lower)) {
      return { category: "code_review", subcategory: "review" };
    }

    // Configuration / Setup
    if (/\b(config|configure|setup|set up|install|deploy|initialise|initialize)\b/.test(lower)) {
      return { category: "configuration", subcategory: "setup" };
    }

    // Git / Version Control
    if (/\b(commit|push|pull|merge|branch|git|pr|pull request|rebase)\b/.test(lower)) {
      return { category: "version_control", subcategory: "git_operations" };
    }

    // General / Other
    return { category: "general", subcategory: "other" };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async writeTurnData(sessionId, endTime, wasInterrupted) {
    if (!this.currentTurn[sessionId]) {
      return;
    }

    const turnData = [
      sessionId,
      this.userId,
      this.currentTurn[sessionId].number,
      this.currentTurn[sessionId].startTime,
      endTime,
      this.currentTurn[sessionId].toolCount,
      this.currentTurn[sessionId].turnCost || 0,
      wasInterrupted ? 1 : 0
    ]
      .map((v) => this.escapeCSV(v))
      .join(",");

    this.appendCSV(this.turnsFile, turnData);
  }

  async handleToolStart(sessionId, toolName, eventData) {
    const now = Date.now();
    const turnNumber = this.getCurrentTurnNumber(sessionId);

    // Increment tool count for this turn
    if (this.currentTurn[sessionId]) {
      this.currentTurn[sessionId].toolCount++;
      this.saveTurnState();
    }

    const toolData = [
      sessionId,
      this.userId,
      turnNumber,
      toolName,
      now,
      "", // completed_at - empty for now
      "", // success - empty for now
      "", // processing_time_ms - empty for now
      JSON.stringify(eventData.tool_input || {}).length,
      "" // output_size - empty for now
    ]
      .map((v) => this.escapeCSV(v))
      .join(",");

    this.appendCSV(this.toolsFile, toolData);

    // Track start time for this tool
    if (!this.toolStartTimes) this.toolStartTimes = {};
    if (!this.toolStartTimes[sessionId]) this.toolStartTimes[sessionId] = {};
    this.toolStartTimes[sessionId][toolName] = now;

    // Handle git commands specially
    if (toolName === "Bash" && eventData.tool_input?.command) {
      await this.handleGitCommand(sessionId, eventData.tool_input.command);
      await this.handleGitOperations(sessionId, eventData.tool_input.command);
    }
  }

  async handleToolEnd(sessionId, toolName, eventData) {
    const now = Date.now();
    const { tool_output, success = true, error } = eventData;
    const turnNumber = this.getCurrentTurnNumber(sessionId);

    // Calculate processing time
    let processingTime = "";
    if (this.toolStartTimes && this.toolStartTimes[sessionId] && this.toolStartTimes[sessionId][toolName]) {
      processingTime = now - this.toolStartTimes[sessionId][toolName];
      delete this.toolStartTimes[sessionId][toolName];
    }

    const outputSize = JSON.stringify(tool_output || {}).length;

    // Record completion data
    const completionData = [
      sessionId,
      this.userId,
      turnNumber,
      toolName,
      "", // started_at - empty since this is completion record
      now, // completed_at
      success ? "1" : "0",
      processingTime,
      "", // input_size - empty for completion record
      outputSize
    ]
      .map((v) => this.escapeCSV(v))
      .join(",");

    this.appendCSV(this.toolsFile, completionData);
  }

  async handleCompaction(sessionId, eventData) {
    const now = Date.now();
    const turnNumber = this.getCurrentTurnNumber(sessionId);

    // Extract compaction metrics from eventData
    const tokensBefore = eventData.tokens_before || eventData.context_window_before || 0;
    const tokensAfter = eventData.tokens_after || eventData.context_window_after || 0;
    const reductionTokens = tokensBefore - tokensAfter;
    const reductionPercent = tokensBefore > 0 ? ((reductionTokens / tokensBefore) * 100).toFixed(2) : 0;

    // Determine compaction type and trigger reason from event data
    const compactionType = eventData.compaction_type || eventData.type || "auto";
    const triggerReason = eventData.trigger_reason || eventData.reason || "threshold";

    const compactionData = [
      sessionId,
      this.userId,
      turnNumber,
      now,
      tokensBefore,
      tokensAfter,
      reductionTokens,
      reductionPercent,
      compactionType,
      triggerReason
    ]
      .map((v) => this.escapeCSV(v))
      .join(",");

    this.appendCSV(this.compactionsFile, compactionData);
  }

  async handleSessionEnd(sessionId, eventData) {
    const now = Date.now();
    const { transcript_path, was_interrupted } = eventData;
    const turnNumber = this.getCurrentTurnNumber(sessionId);

    // Parse transcript for token usage and write costs immediately
    let totalCost = 0;
    if (transcript_path && this.currentTurn[sessionId]) {
      const tokenRecords = await this.parseTranscriptTokens(transcript_path, sessionId);
      // Get only the latest (last) token record to avoid duplicates
      if (tokenRecords.length > 0) {
        const latestRecord = tokenRecords[tokenRecords.length - 1];

        // Write cost data to CSV
        const costData = [
          sessionId,
          this.userId,
          turnNumber,
          latestRecord.message_id || "",
          latestRecord.input_tokens || 0,
          latestRecord.output_tokens || 0,
          latestRecord.total_tokens || 0,
          latestRecord.input_cost_usd || 0,
          latestRecord.output_cost_usd || 0,
          latestRecord.total_cost_usd || 0,
          latestRecord.timestamp || now
        ]
          .map((v) => this.escapeCSV(v))
          .join(",");

        this.appendCSV(this.costsFile, costData);

        // Update turn cost in state
        this.currentTurn[sessionId].turnCost = latestRecord.total_cost_usd || 0;
        this.saveTurnState();
      }
    }

    // Calculate total session cost from all costs
    if (transcript_path) {
      try {
        const costs = fs.readFileSync(this.costsFile, "utf8").split("\n");
        for (const line of costs) {
          if (line.startsWith(sessionId + ",")) {
            const parts = line.split(",");
            // Column 10 (index 9) is total_cost_usd
            totalCost += parseFloat(parts[9]) || 0;
          }
        }
      } catch (e) {
        // If can't read costs, use 0
      }
    }

    // Update or create session record (replace old entry for this session)
    this.updateSessionRecord(sessionId, turnNumber, totalCost, was_interrupted, now);

    // DON'T write turn data here - it will be written when the next turn starts
    // DON'T clear turn state here - the session is still active
  }

  updateSessionRecord(sessionId, turnCount, totalCost, wasInterrupted, endTime) {
    try {
      // Read existing sessions
      let sessions = [];
      if (fs.existsSync(this.sessionsFile)) {
        const content = fs.readFileSync(this.sessionsFile, "utf8");
        sessions = content.split("\n").filter((line) => line.trim());
      }

      // Get header
      const header =
        sessions.length > 0
          ? sessions[0]
          : "session_id,user_id,repo_url,repo_name,branch,head_commit,started_at,ended_at,turn_count,total_cost_usd,interrupted_turns";

      // Filter out old entry for this session
      const otherSessions = sessions.slice(1).filter((line) => !line.startsWith(sessionId + ","));

      // Get start time from turn state
      const startTime = this.currentTurn[sessionId]?.startTime || endTime - 300000;

      // Create new session record
      const sessionData = [
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
        wasInterrupted ? 1 : 0
      ]
        .map((v) => this.escapeCSV(v))
        .join(",");

      // Write back all sessions
      const allSessions = [header, ...otherSessions, sessionData].join("\n") + "\n";
      fs.writeFileSync(this.sessionsFile, allSessions);
    } catch (error) {
      console.error(`Error updating session record: ${error.message}`);
    }
  }

  async handleGitOperations(sessionId, command) {
    const now = Date.now();
    let operationType = null;
    let branch = this.repoInfo.branch;
    let remote = "origin";
    let success = true;

    // Detect git push/pull/fetch operations
    if (/git\s+push/.test(command)) {
      operationType = "push";
      // Extract remote and branch if specified
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
      const gitOpData = [sessionId, this.userId, operationType, branch, remote, now, success ? 1 : 0].map((v) => this.escapeCSV(v)).join(",");

      this.appendCSV(this.gitOpsFile, gitOpData);
    }
  }

  async handleGitCommand(sessionId, command) {
    if (command.includes("git commit") || /git\s+commit/.test(command)) {
      try {
        // Get the latest commit info
        const commitSha = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        const commitMsg = execSync('git log -1 --pretty=format:"%s"', { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        const authorEmail = execSync('git log -1 --pretty=format:"%ae"', { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
        const committedAt = execSync('git log -1 --pretty=format:"%ct"', { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();

        // Get LOC changes (files, insertions, deletions)
        let filesChanged = 0,
          insertions = 0,
          deletions = 0;
        try {
          const statOutput = execSync(`git show --stat --format="" ${commitSha}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
          // Parse the summary line: "X files changed, Y insertions(+), Z deletions(-)"
          const statMatch = statOutput.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
          if (statMatch) {
            filesChanged = parseInt(statMatch[1]) || 0;
            insertions = parseInt(statMatch[2]) || 0;
            deletions = parseInt(statMatch[3]) || 0;
          }
        } catch (statError) {
          // Stats not available for this commit
        }

        const totalLoc = insertions + deletions;

        const commitData = [
          commitSha,
          sessionId,
          this.userId,
          this.repoInfo.name,
          this.repoInfo.branch,
          commitMsg,
          authorEmail,
          parseInt(committedAt) * 1000, // Convert to milliseconds
          filesChanged,
          insertions,
          deletions,
          totalLoc
        ]
          .map((v) => this.escapeCSV(v))
          .join(",");

        this.appendCSV(this.commitsFile, commitData);
      } catch (error) {
        console.error(`Error tracking git commit: ${error.message}`);
      }
    }
  }

  async parseTranscriptTokens(transcriptPath, sessionId) {
    try {
      const readline = require("readline");

      if (!fs.existsSync(transcriptPath)) {
        return [];
      }

      const tokenRecords = [];

      const fileStream = fs.createReadStream(transcriptPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const entry = JSON.parse(line);

          // Look for assistant messages with usage data
          if (entry.type === "assistant" && entry.message && entry.message.usage) {
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
              ...costs
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

  calculateTokenCost(usage, modelName) {
    // Claude Sonnet 4.5 pricing (per million tokens)
    const PRICING = {
      "claude-sonnet-4-5-20250929": {
        input: 3.0,
        output: 15.0,
        cache_write: 3.75,
        cache_read: 0.3
      }
    };

    const pricing = PRICING[modelName] || PRICING["claude-sonnet-4-5-20250929"];

    const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
    const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
    const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.cache_write;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.cache_read;

    return {
      input_cost_usd: inputCost,
      output_cost_usd: outputCost,
      cache_write_cost_usd: cacheWriteCost,
      cache_read_cost_usd: cacheReadCost,
      total_cost_usd: inputCost + outputCost + cacheWriteCost + cacheReadCost
    };
  }

  recordTokenUsage(sessionId, tokenData) {
    const costData = [
      sessionId,
      tokenData.message_id || "",
      tokenData.input_tokens || 0,
      tokenData.output_tokens || 0,
      tokenData.total_tokens || 0,
      tokenData.input_cost_usd || 0,
      tokenData.output_cost_usd || 0,
      tokenData.total_cost_usd || 0,
      Date.now()
    ]
      .map((v) => this.escapeCSV(v))
      .join(",");

    this.appendCSV(this.costsFile, costData);
  }
}

// Log EPIPE errors for debugging
function logEPIPE(context, error) {
  try {
    const projectDir = process.cwd();
    const logFile = path.join(projectDir, ".claude", "analytics", "epipe_errors.log");
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] EPIPE Error - Context: ${context}\nError: ${error.message}\nCode: ${error.code}\nStack: ${error.stack}\n---\n`;
    fs.appendFileSync(logFile, logEntry);
  } catch (e) {
    // Silently fail if we can't write the log
  }
}

// Main execution
if (require.main === module) {
  let analytics;

  try {
    analytics = new SimpleAnalytics();
  } catch (error) {
    // Consume stdin even if initialization fails to prevent EPIPE
    process.stdin.resume();
    process.stdin.on("end", () => {
      console.error("Failed to initialize analytics:", error.message);
      process.exit(1);
    });
    // Don't proceed further
  }

  if (analytics) {
    // Read JSON from stdin
    let inputData = "";
    process.stdin.on("data", (chunk) => {
      inputData += chunk;
    });

    process.stdin.on("end", async () => {
      try {
        if (inputData.trim()) {
          const eventData = JSON.parse(inputData);
          await analytics.processHookEvent(eventData);
        }
        // Explicitly exit with success after async work completes
        process.exit(0);
      } catch (error) {
        console.error("Error processing input:", error.message);
        process.exit(1);
      }
    });

    // Capture EPIPE errors on stdin
    process.stdin.on("error", (error) => {
      if (error.code === "EPIPE") {
        logEPIPE("stdin stream", error);
      }
      console.error("Stdin error:", error.message);
      process.exit(1);
    });

    // Capture any unhandled EPIPE errors
    process.on("uncaughtException", (error) => {
      if (error.code === "EPIPE" || error.message.includes("EPIPE")) {
        logEPIPE("uncaught exception", error);
      }
      console.error("Uncaught error:", error.message);
      process.exit(1);
    });
  }
}
