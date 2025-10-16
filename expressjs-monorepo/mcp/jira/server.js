#!/usr/bin/env node

/**
 * Simplified JIRA MCP Server
 * Zero-dependency Node.js implementation using only built-in modules
 * Supports MCP protocol over stdio
 */

import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JiraClient } from './client/jira.js';
import { getIssue } from './tools/get-issue.js';
import { search } from './tools/search.js';
import { downloadAttachments } from './tools/download-attachments.js';

/**
 * Load environment variables from .claude/.mcp.env if it exists in PWD
 */
function loadEnvFile() {
  const cwd = process.cwd();
  const envPath = join(cwd, '.claude', '.mcp.env');

  console.error(`[JIRA MCP] Current working directory: ${cwd}`);
  console.error(`[JIRA MCP] Looking for env file at: ${envPath}`);

  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        // Skip empty lines and comments
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Parse KEY=VALUE
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex === -1) continue;

        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();

        // Only set if not already in environment
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }

      console.error(`[JIRA MCP] Loaded environment from ${envPath}`);
    } catch (error) {
      console.error(`[JIRA MCP] Warning: Failed to load ${envPath}:`, error.message);
    }
  } else {
    console.error(`[JIRA MCP] No .mcp.env file found at ${envPath}`);
  }
}

// Load .mcp.env before starting server
loadEnvFile();

const SERVER_INFO = {
  name: 'jira-mcp-server',
  version: '1.0.0',
  protocolVersion: '2024-11-05'
};

const TOOLS = [
  {
    name: 'jira_get_issue',
    description: 'Get details of a specific JIRA issue by its key',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: {
          type: 'string',
          description: 'The JIRA issue key (e.g., PROJ-123)'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of fields to return (default: summary, status, description, assignee, created, updated)',
          default: ['summary', 'status', 'description', 'assignee', 'created', 'updated']
        },
        expand: {
          type: 'string',
          description: 'Optional comma-separated list of fields to expand (e.g., renderedFields, changelog)'
        }
      },
      required: ['issue_key']
    }
  },
  {
    name: 'jira_search',
    description: 'Search JIRA issues using JQL (JIRA Query Language)',
    inputSchema: {
      type: 'object',
      properties: {
        jql: {
          type: 'string',
          description: 'JQL query string (e.g., "project = PROJ AND status = Open")'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of fields to return',
          default: ['summary', 'status', 'assignee', 'created']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50, max: 100)',
          default: 50,
          minimum: 1,
          maximum: 100
        },
        startAt: {
          type: 'number',
          description: 'Index of the first result to return (for pagination)',
          default: 0,
          minimum: 0
        }
      },
      required: ['jql']
    }
  },
  {
    name: 'jira_download_attachments',
    description: 'Download all attachments from a JIRA issue to a specified directory',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: {
          type: 'string',
          description: 'The JIRA issue key (e.g., PROJ-123)'
        },
        target_dir: {
          type: 'string',
          description: 'Directory path where attachments should be saved'
        }
      },
      required: ['issue_key', 'target_dir']
    }
  }
];

class MCPServer {
  constructor() {
    this.jiraClient = null;
    this.requestId = 0;
  }

  async initialize() {
    // Validate environment variables
    const jiraUrl = process.env.JIRA_URL;
    const jiraPersonalToken = process.env.JIRA_PERSONAL_TOKEN;

    if (!jiraUrl || !jiraPersonalToken) {
      throw new Error('Missing required environment variables: JIRA_URL and JIRA_PERSONAL_TOKEN must be set');
    }

    this.jiraClient = new JiraClient(jiraUrl, jiraPersonalToken);

    // Log initialization (to stderr so it doesn't interfere with MCP protocol)
    console.error(`[JIRA MCP] Initialized with URL: ${jiraUrl}`);
  }

  async handleRequest(message) {
    const { jsonrpc, id, method, params } = message;

    try {
      switch (method) {
        case 'initialize':
          await this.initialize();
          return {
            jsonrpc,
            id,
            result: {
              protocolVersion: SERVER_INFO.protocolVersion,
              serverInfo: {
                name: SERVER_INFO.name,
                version: SERVER_INFO.version
              },
              capabilities: {
                tools: {}
              }
            }
          };

        case 'tools/list':
          return {
            jsonrpc,
            id,
            result: {
              tools: TOOLS
            }
          };

        case 'tools/call':
          const { name, arguments: args } = params;
          const result = await this.callTool(name, args);
          return {
            jsonrpc,
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          };

        case 'ping':
          return {
            jsonrpc,
            id,
            result: {}
          };

        default:
          throw new Error(`Unknown method: ${method}`);
      }
    } catch (error) {
      console.error(`[JIRA MCP] Error handling ${method}:`, error);
      return {
        jsonrpc,
        id,
        error: {
          code: -32603,
          message: error.message,
          data: { details: error.stack }
        }
      };
    }
  }

  async callTool(name, args) {
    if (!this.jiraClient) {
      throw new Error('JIRA client not initialized. Call initialize first.');
    }

    switch (name) {
      case 'jira_get_issue':
        return await getIssue(this.jiraClient, args);

      case 'jira_search':
        return await search(this.jiraClient, args);

      case 'jira_download_attachments':
        return await downloadAttachments(this.jiraClient, args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  start() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    console.error('[JIRA MCP] Server starting...');

    rl.on('line', async (line) => {
      try {
        const message = JSON.parse(line);
        const response = await this.handleRequest(message);

        // Write response to stdout (MCP protocol)
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        console.error('[JIRA MCP] Error parsing message:', error);
        // Send error response
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: { details: error.message }
          }
        }) + '\n');
      }
    });

    rl.on('close', () => {
      console.error('[JIRA MCP] Server stopped');
      process.exit(0);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.error('[JIRA MCP] Received SIGINT, shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('[JIRA MCP] Received SIGTERM, shutting down...');
      process.exit(0);
    });
  }
}

// Start the server
const server = new MCPServer();
server.start();
