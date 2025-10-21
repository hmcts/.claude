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
    this.ticketsFile = path.join(this.dataDir, "jira_tickets.csv");
    this.ticketStateFile = path.join(this.dataDir, "ticket_state.json");

    this.userId = this.getUserId();
    this.repoInfo = this.getRepoInfo();
    this.currentTurn = {}; // Track turn number per session
    this.currentTicket = {}; // Track current ticket per session

    this.ensureDataDirectory();
    this.ensureCSVHeaders();
    this.loadTurnState(); // NEW: load persisted turn state
    this.loadTicketState(); // NEW: load persisted ticket state
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

  loadTicketState() {
    try {
      if (fs.existsSync(this.ticketStateFile)) {
        const stateData = fs.readFileSync(this.ticketStateFile, "utf8");
        this.currentTicket = JSON.parse(stateData);
      }
    } catch (error) {
      console.error(`Error loading ticket state: ${error.message}`);
      this.currentTicket = {};
    }
  }

  saveTicketState() {
    try {
      fs.writeFileSync(this.ticketStateFile, JSON.stringify(this.currentTicket, null, 2));
    } catch (error) {
      console.error(`Error saving ticket state: ${error.message}`);
    }
  }

  setCurrentTicket(sessionId, ticketData) {
    const existingTicket = this.currentTicket[sessionId];
    const newWorkflowCommand = ticketData.workflowCommand;

    // Check if this is a NEW workflow command (switching from plan -> implement, etc.)
    const isNewWorkflowPhase = existingTicket &&
                                existingTicket.workflowCommand &&
                                newWorkflowCommand &&
                                existingTicket.workflowCommand !== newWorkflowCommand;

    if (!existingTicket || isNewWorkflowPhase) {
      // Initialize new ticket tracking OR start new workflow phase
      if (isNewWorkflowPhase) {
        console.log(`[Analytics] Switching workflow: ${existingTicket.workflowCommand} -> ${newWorkflowCommand}`);
      }

      this.currentTicket[sessionId] = {
        ticketId: ticketData.ticketId,
        workflowCommand: newWorkflowCommand || null,
        storyPoints: ticketData.storyPoints || (existingTicket?.storyPoints) || null,
        ticketType: ticketData.ticketType || (existingTicket?.ticketType) || 'Unknown',
        priority: ticketData.priority || (existingTicket?.priority) || null,
        status: ticketData.status || (existingTicket?.status) || 'Unknown',
        projectKey: ticketData.projectKey || (existingTicket?.projectKey) || '',
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        totalTurns: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        commitsCount: 0
      };
    } else {
      // Update existing ticket with new data (e.g., story points from Jira)
      // Preserve workflowCommand if it's already set (don't overwrite with null)
      this.currentTicket[sessionId] = {
        ...this.currentTicket[sessionId],
        ticketId: ticketData.ticketId || this.currentTicket[sessionId].ticketId,
        workflowCommand: this.currentTicket[sessionId].workflowCommand || ticketData.workflowCommand,
        storyPoints: ticketData.storyPoints || this.currentTicket[sessionId].storyPoints,
        ticketType: ticketData.ticketType || this.currentTicket[sessionId].ticketType,
        priority: ticketData.priority || this.currentTicket[sessionId].priority,
        status: ticketData.status || this.currentTicket[sessionId].status,
        projectKey: ticketData.projectKey || this.currentTicket[sessionId].projectKey,
        lastActivityAt: Date.now()
      };
    }

    this.saveTicketState();
  }

  getCurrentTicket(sessionId) {
    return this.currentTicket[sessionId] || null;
  }

  ensureCSVHeaders() {
    // Sessions CSV (no ticket_id - use jira_tickets.csv to link sessions to tickets)
    if (!fs.existsSync(this.sessionsFile)) {
      this.appendCSV(
        this.sessionsFile,
        "session_id,user_id,repo_url,repo_name,branch,head_commit,started_at,ended_at,turn_count,total_cost_usd,interrupted_turns"
      );
    }

    // Turns CSV - NEW
    if (!fs.existsSync(this.turnsFile)) {
      this.appendCSV(this.turnsFile, "session_id,user_id,ticket_id,turn_number,started_at,ended_at,tool_count,total_cost_usd,was_interrupted");
    }

    // Commits CSV - with LOC changes
    if (!fs.existsSync(this.commitsFile)) {
      this.appendCSV(
        this.commitsFile,
        "commit_sha,session_id,user_id,ticket_id,repo_name,branch,commit_message,author_email,committed_at,files_changed,insertions,deletions,total_loc_changed"
      );
    }

    // Tools CSV - add user_id and turn_number
    if (!fs.existsSync(this.toolsFile)) {
      this.appendCSV(this.toolsFile, "session_id,user_id,ticket_id,turn_number,tool_name,started_at,completed_at,success,processing_time_ms,input_size,output_size");
    }

    // Costs CSV - add user_id and turn_number
    if (!fs.existsSync(this.costsFile)) {
      this.appendCSV(
        this.costsFile,
        "session_id,user_id,ticket_id,turn_number,message_id,input_tokens,output_tokens,total_tokens,input_cost_usd,output_cost_usd,total_cost_usd,timestamp"
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

    // Jira Tickets CSV - Track ticket-level metrics
    if (!fs.existsSync(this.ticketsFile)) {
      this.appendCSV(
        this.ticketsFile,
        "ticket_id,session_id,user_id,workflow_command,story_points,ticket_type,priority,status,project_key,started_at,last_activity_at,total_turns,total_tokens,input_tokens,output_tokens,total_cost_usd,commits_count"
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

      // Debug logging to file
      if (hook_event_name === "PostToolUse") {
        const debugLog = path.join(this.dataDir, "debug.log");
        const debugMsg = `[${new Date().toISOString()}] PostToolUse - tool_name: "${tool_name}", has_tool_output: ${!!eventData.tool_output}\n`;
        fs.appendFileSync(debugLog, debugMsg);
      }

      if (hook_event_name === "UserPromptSubmit") {
        await this.handleTurnStart(session_id, eventData);
        await this.detectTicketFromPrompt(session_id, eventData);
      } else if (hook_event_name === "PreToolUse" && tool_name) {
        await this.handleToolStart(session_id || this.generateSessionId(), tool_name, eventData);
      } else if (hook_event_name === "PostToolUse" && tool_name) {
        await this.handleToolEnd(session_id, tool_name, eventData);

        // Capture Jira ticket data
        // Tool name might be prefixed with plugin name (e.g., "plugin:expressjs-monorepo:jira - jira_get_issue")
        if (tool_name && (tool_name === "jira_get_issue" || tool_name.includes("jira_get_issue"))) {
          const debugLog = path.join(this.dataDir, "debug.log");
          fs.appendFileSync(debugLog, `[${new Date().toISOString()}] Calling handleJiraTicketFetch!\n`);
          await this.handleJiraTicketFetch(session_id, eventData);
        }
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

  async detectTicketFromPrompt(sessionId, eventData) {
    try {
      const prompt = eventData.prompt || '';

      // Detect workflow command
      let workflowCommand = null;
      const workflowCommands = {
        '/wf-plan': 'plan',
        '/wf-implement': 'implement',
        '/wf-review': 'review',
        '/os-small': 'one-shot-small',
        '/os-large': 'one-shot-large'
      };

      for (const [cmd, label] of Object.entries(workflowCommands)) {
        if (prompt.includes(cmd)) {
          workflowCommand = label;
          break;
        }
      }

      // Match ticket patterns like PROJ-123, ABC-456
      const ticketPattern = /\b([A-Z]{2,10}-\d+)\b/g;
      const matches = prompt.match(ticketPattern);

      if (matches && matches.length > 0) {
        const ticketId = matches[0];
        const existingTicket = this.currentTicket[sessionId];

        // Set ticket if: (1) no existing ticket, OR (2) new workflow command detected
        const shouldSetTicket = !existingTicket ||
                                (workflowCommand && existingTicket.workflowCommand !== workflowCommand);

        if (shouldSetTicket) {
          console.log(`[Analytics] Detected ticket from prompt: ${ticketId}${workflowCommand ? ` (${workflowCommand})` : ''}`);
          this.setCurrentTicket(sessionId, {
            ticketId: ticketId,
            workflowCommand: workflowCommand,
            storyPoints: null,
            ticketType: 'Unknown',
            status: 'Unknown',
            projectKey: ticketId.split('-')[0],
            startedAt: Date.now()
          });
        } else if (existingTicket && existingTicket.ticketId !== ticketId) {
          // Different ticket in same session - set new ticket
          console.log(`[Analytics] Switching from ${existingTicket.ticketId} to ${ticketId}`);
          this.setCurrentTicket(sessionId, {
            ticketId: ticketId,
            workflowCommand: workflowCommand,
            storyPoints: null,
            ticketType: 'Unknown',
            status: 'Unknown',
            projectKey: ticketId.split('-')[0],
            startedAt: Date.now()
          });
        }
      } else {
        console.log('[Analytics] No ticket ID detected in prompt');
      }
    } catch (error) {
      console.error(`Error detecting ticket from prompt: ${error.message}`);
    }
  }

  async handleJiraTicketFetch(sessionId, eventData) {
    try {
      // Debug: Log what's in eventData
      const debugLog = path.join(this.dataDir, "debug.log");
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] handleJiraTicketFetch - eventData keys: ${Object.keys(eventData).join(', ')}\n`);

      // Debug: Log raw tool_response
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] tool_response type: ${typeof eventData.tool_response}\n`);
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] tool_response is array: ${Array.isArray(eventData.tool_response)}\n`);
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] tool_response raw (first 500 chars): ${JSON.stringify(eventData.tool_response).substring(0, 500)}\n`);

      // tool_response format: [{type: "text", text: "{json}"}]
      let toolOutput;
      if (eventData.tool_response) {
        if (Array.isArray(eventData.tool_response) && eventData.tool_response[0]?.text) {
          // MCP tools return array with {type, text} structure
          const textContent = eventData.tool_response[0].text;
          toolOutput = JSON.parse(textContent);
        } else if (Array.isArray(eventData.tool_response)) {
          toolOutput = eventData.tool_response[0];
        } else if (typeof eventData.tool_response === 'string') {
          toolOutput = JSON.parse(eventData.tool_response);
        } else {
          toolOutput = eventData.tool_response;
        }
      }

      // Debug: Log what we received
      if (!toolOutput) {
        fs.appendFileSync(debugLog, `[${new Date().toISOString()}] No tool_response in event data!\n`);
        console.warn('[Analytics] Jira ticket fetch: No tool_response in event data');
        return;
      }

      // Debug: Log tool_response structure
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] tool_response keys: ${Object.keys(toolOutput).join(', ')}\n`);
      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] tool_response.success: ${toolOutput.success}\n`);

      if (!toolOutput.success) {
        fs.appendFileSync(debugLog, `[${new Date().toISOString()}] Jira fetch failed: ${toolOutput.error || 'Unknown'}\n`);
        console.warn('[Analytics] Jira ticket fetch failed:', toolOutput.error || 'Unknown error');
        return;
      }

      if (!toolOutput.issue) {
        fs.appendFileSync(debugLog, `[${new Date().toISOString()}] No issue in tool_response\n`);
        console.warn('[Analytics] Jira ticket fetch: No issue in tool_response');
        return;
      }

      fs.appendFileSync(debugLog, `[${new Date().toISOString()}] Successfully parsed Jira issue: ${toolOutput.issue.key}\n`);

      // Parse Jira response
      const issue = toolOutput.issue;
      const fields = issue.fields;

      // Auto-detect story points from common custom field names
      const storyPoints = fields.customfield_10004 ||  // HMCTS Jira
                          fields.customfield_10016 ||  // Common in Jira Cloud
                          fields.customfield_10026 ||
                          fields.customfield_10036 ||
                          fields.customfield_10106 ||
                          fields.storyPoints ||
                          fields['Story Points'] ||
                          null;

      // Debug: Warn if we couldn't find story points
      if (storyPoints === null) {
        const customFields = Object.keys(fields).filter(k => k.startsWith('customfield_'));
        console.warn(`[Analytics] Story points not found. Available custom fields: ${customFields.join(', ')}`);
      }

      const ticketData = {
        ticketId: issue.key,
        storyPoints: storyPoints,
        ticketType: fields.issueType?.name || 'Unknown',
        priority: fields.priority?.name || null,
        status: fields.status?.name || 'Unknown',
        projectKey: fields.project?.key || issue.key.split('-')[0],
        startedAt: Date.now()
      };

      console.log(`[Analytics] Captured Jira ticket: ${ticketData.ticketId} (${ticketData.storyPoints} pts, ${ticketData.status})`);
      this.setCurrentTicket(sessionId, ticketData);
    } catch (error) {
      console.error(`[Analytics] Error handling Jira ticket fetch: ${error.message}`);
      console.error(error.stack);
    }
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

    const ticket = this.getCurrentTicket(sessionId);
    const ticketId = ticket ? ticket.ticketId : '';

    const turnData = [
      sessionId,
      this.userId,
      ticketId,
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

    // Update ticket metrics
    if (ticket) {
      ticket.totalTurns++;
      ticket.lastActivityAt = endTime;
      this.saveTicketState();
    }
  }

  async handleToolStart(sessionId, toolName, eventData) {
    const now = Date.now();
    const turnNumber = this.getCurrentTurnNumber(sessionId);
    const ticket = this.getCurrentTicket(sessionId);
    const ticketId = ticket ? ticket.ticketId : '';

    // Increment tool count for this turn
    if (this.currentTurn[sessionId]) {
      this.currentTurn[sessionId].toolCount++;
      this.saveTurnState();
    }

    const toolData = [
      sessionId,
      this.userId,
      ticketId,
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
    const ticket = this.getCurrentTicket(sessionId);
    const ticketId = ticket ? ticket.ticketId : '';

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
      ticketId,
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

        // Get ticket ID for cost tracking
        const ticket = this.getCurrentTicket(sessionId);
        const ticketId = ticket ? ticket.ticketId : '';

        // Write cost data to CSV
        const costData = [
          sessionId,
          this.userId,
          ticketId,
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

        // Update ticket cost tracking
        if (ticket) {
          ticket.totalTokens += latestRecord.total_tokens || 0;
          ticket.inputTokens += latestRecord.input_tokens || 0;
          ticket.outputTokens += latestRecord.output_tokens || 0;
          ticket.totalCost += latestRecord.total_cost_usd || 0;
          ticket.lastActivityAt = now;
          this.saveTicketState();
        }
      }
    }

    // Calculate total session cost from all costs
    if (transcript_path) {
      try {
        const costs = fs.readFileSync(this.costsFile, "utf8").split("\n");
        for (const line of costs) {
          if (line.startsWith(sessionId + ",")) {
            const parts = line.split(",");
            // Column 11 (index 10) is total_cost_usd (shifted by 1 due to ticket_id)
            totalCost += parseFloat(parts[10]) || 0;
          }
        }
      } catch (e) {
        // If can't read costs, use 0
      }
    }

    // Update or create session record (replace old entry for this session)
    this.updateSessionRecord(sessionId, turnNumber, totalCost, was_interrupted, now);

    // Update ticket summary if ticket exists (updates existing row or appends new)
    await this.updateTicketSummary(sessionId);

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

      // Create new session record (no ticket_id - use jira_tickets.csv to link)
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

  async updateTicketSummary(sessionId) {
    const ticket = this.getCurrentTicket(sessionId);
    if (!ticket) return;

    try {
      // Read existing tickets
      let tickets = [];
      if (fs.existsSync(this.ticketsFile)) {
        const content = fs.readFileSync(this.ticketsFile, "utf8");
        tickets = content.split("\n").filter((line) => line.trim());
      }

      // Prepare new ticket data
      const ticketData = [
        ticket.ticketId,
        sessionId,
        this.userId,
        ticket.workflowCommand || '',
        ticket.storyPoints || '',
        ticket.ticketType || '',
        ticket.priority || '',
        ticket.status || '',
        ticket.projectKey || '',
        ticket.startedAt,
        ticket.lastActivityAt,
        ticket.totalTurns,
        ticket.totalTokens,
        ticket.inputTokens,
        ticket.outputTokens,
        ticket.totalCost.toFixed(10),
        ticket.commitsCount
      ]
        .map((v) => this.escapeCSV(v))
        .join(",");

      // Find matching row by ticket_id + session_id + workflow_command
      const header = tickets[0];
      const dataRows = tickets.slice(1);

      const matchIndex = dataRows.findIndex((row) => {
        const cols = row.split(',');
        const rowTicketId = cols[0]?.replace(/^"|"$/g, ''); // Remove quotes
        const rowSessionId = cols[1]?.replace(/^"|"$/g, '');
        const rowWorkflowCmd = cols[3]?.replace(/^"|"$/g, '');

        return rowTicketId === ticket.ticketId &&
               rowSessionId === sessionId &&
               rowWorkflowCmd === (ticket.workflowCommand || '');
      });

      if (matchIndex >= 0) {
        // Update existing row
        dataRows[matchIndex] = ticketData;
      } else {
        // Append new row
        dataRows.push(ticketData);
      }

      // Write back all tickets
      const allTickets = [header, ...dataRows].join("\n") + "\n";
      fs.writeFileSync(this.ticketsFile, allTickets);
    } catch (error) {
      console.error(`Error updating ticket summary: ${error.message}`);
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

        // Get ticket ID from session context or commit message
        const ticket = this.getCurrentTicket(sessionId);
        let ticketId = ticket ? ticket.ticketId : '';

        // Fallback: parse commit message if no session ticket
        if (!ticketId && commitMsg) {
          const match = commitMsg.match(/\b([A-Z]{2,10}-\d+)\b/);
          if (match) {
            ticketId = match[1];
          }
        }

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
          ticketId,
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

        // Update ticket commit count
        if (ticket) {
          ticket.commitsCount++;
          this.saveTicketState();
        }
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

// Main execution
if (require.main === module) {
  const analytics = new SimpleAnalytics();

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
    } catch (error) {
      console.error("Error processing input:", error.message);
      process.exit(1);
    }
  });
}
