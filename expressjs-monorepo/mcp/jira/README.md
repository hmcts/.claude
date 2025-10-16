# JIRA MCP Server

A simplified, zero-dependency JIRA MCP (Model Context Protocol) server written in pure Node.js.

## Features

- **Zero Dependencies**: Uses only Node.js built-in modules (https, fs, path, readline)
- **Three Essential Tools**:
  - `jira_get_issue` - Get details of a JIRA issue
  - `jira_search` - Search issues using JQL
  - `jira_download_attachments` - Download issue attachments
- **PAT Authentication**: Simple Personal Access Token authentication

## Prerequisites

- Node.js 22.0.0 or higher
- JIRA Personal Access Token (PAT)

## Setup

### 1. Create a JIRA Personal Access Token

**For JIRA Cloud:**
1. Go to: `https://your-domain.atlassian.net/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`
2. Click "Create token"
3. Give it a name and click "Create"
4. Copy the token (you won't be able to see it again!)

**For JIRA Server/DC:**
1. Go to your profile settings
2. Navigate to Personal Access Tokens
3. Create a new token

### 2. Configure Environment Variables

The plugin expects these environment variables to be set in your shell or `.mcp.env` file:

```bash
# Required
export JIRA_URL=https://your-domain.atlassian.net
export JIRA_PERSONAL_TOKEN=your_personal_access_token_here
```

**Option A: Set in your shell profile** (recommended)

Add to `~/.bashrc`, `~/.zshrc`, or equivalent:

```bash
export JIRA_URL=https://your-domain.atlassian.net
export JIRA_PERSONAL_TOKEN=your_token_here
```

Then reload: `source ~/.bashrc` or `source ~/.zshrc`

**Option B: Create a .mcp.env file**

Create `/path/to/your/project/.claude/.mcp.env`:

```bash
JIRA_URL=https://your-domain.atlassian.net
JIRA_PERSONAL_TOKEN=your_token_here
```

Note: This file is already referenced in the plugin's `.mcp.json` configuration.

### 3. Verify Setup

The plugin's `.mcp.json` should already be configured to use this server:

```json
{
  "mcpServers": {
    "jira": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_DIR}/mcp/jira/server.js"],
      "env": {
        "JIRA_URL": "${JIRA_URL}",
        "JIRA_PERSONAL_TOKEN": "${JIRA_PERSONAL_TOKEN}"
      }
    }
  }
}
```

## Usage

Once configured, the JIRA tools will be available in Claude Code:

### Get Issue Details

```
Get details of issue PROJ-123
```

The `jira_get_issue` tool will return:
- Issue summary, status, description
- Assignee and reporter information
- Comments, attachments, labels
- Dates (created, updated, due date)
- Custom fields (if requested)

### Search Issues

```
Search JIRA for all open bugs in project PROJ
```

The `jira_search` tool accepts JQL queries like:
- `project = PROJ AND status = Open`
- `assignee = currentUser() AND status != Done`
- `labels = urgent AND created >= -7d`

### Download Attachments

```
Download all attachments from issue PROJ-123 to ./attachments
```

The `jira_download_attachments` tool will:
- Create the target directory if it doesn't exist
- Download all attachments from the issue
- Save them with their original filenames
- Return a summary of downloaded and failed files

## Architecture

```
mcp/jira/
├── server.js                 # MCP protocol handler (stdio)
├── client/
│   └── jira.js              # JIRA REST API client
├── tools/
│   ├── get-issue.js         # jira_get_issue implementation
│   ├── search.js            # jira_search implementation
│   └── download-attachments.js  # jira_download_attachments
├── .mcp.env.example         # Configuration template
├── IMPLEMENTATION.md        # Technical documentation
└── README.md               # This file
```

## Troubleshooting

### Authentication Errors

**Error: "Authentication failed"**
- Check that your PAT is correct and hasn't expired
- Verify JIRA_URL doesn't have a trailing slash

### Node Version Errors

**Error: "Node.js version 22 or higher is required"**
```bash
# Check your version
node --version

# Update Node.js using nvm (recommended)
nvm install 22
nvm use 22
```

### Server Not Starting

Check the Claude Code logs for errors:
```bash
# Look for [JIRA MCP] log messages
# The server logs to stderr for debugging
```

### Connection Issues

**Error: "Network error" or timeouts**
- Check that JIRA_URL is accessible from your network
- Verify you're not behind a proxy that requires configuration
- Test the URL in your browser: `${JIRA_URL}/rest/api/3/serverInfo`

### Issue Not Found

**Error: "Resource not found"**
- Verify the issue key is correct (e.g., PROJ-123, not proj-123)
- Check that you have permission to view the issue
- Ensure the issue exists in your JIRA instance

## Development

This is a minimal implementation with no dependencies. To modify or extend:

1. **Add a new tool**: Create a new file in `tools/` and register it in `server.js`
2. **Modify API client**: Edit `jira-client.js` to add new API methods
3. **Test locally**: Run directly with `node server.js` and send JSON-RPC messages via stdin


## License

MIT

## Support

For issues with this MCP server, check:
1. Claude Code documentation
2. JIRA REST API documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
3. MCP specification: https://modelcontextprotocol.io/
