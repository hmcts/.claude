# HMCTS ExpressJS Monorepo Plugin

A Claude Code plugin providing specialized workflow commands, agents, and quality hooks for HMCTS ExpressJS monorepo development following GOV.UK standards.

## Features

### Slash Commands

**Workflow Commands:**
- `/wf-plan <ticket-id>` - Start working on a JIRA ticket with specification and planning
- `/wf-implement <ticket-id>` - Implement a JIRA ticket with parallel engineering, testing, and infrastructure work
- `/wf-review <ticket-id>` - Review implementation with code review and quality checks

**One-Shot Commands:**
- `/os-small <ticket-id>` - Quick autonomous implementation of a small JIRA ticket
- `/os-large <ticket-id>` - Full autonomous implementation from planning to review

**Git Operations:**
- `/commit` - Commit changes with clear message
- `/pr` - Create pull request with proper documentation

**Utilities:**
- `/prime` - Prime the context with project knowledge
- `/optimize` - Optimize codebase for performance and quality

### Specialized Agents

- **full-stack-engineer** - GOV.UK Frontend, Express.js, TypeScript expertise
- **infrastructure-engineer** - Kubernetes, Helm, Azure cloud infrastructure
- **test-engineer** - Playwright E2E, accessibility testing, test plans
- **ui-ux-engineer** - GOV.UK Design System, accessibility standards
- **code-reviewer** - Code quality, security, accessibility reviews

### Quality Hooks

**Pre-Bash Hook:**
- Routes git commit and PR commands to specialized handlers
- Enforces commit message standards
- Validates PR requirements

**Post-Write Hook:**
- Auto-formats code with Biome
- Runs linting checks
- Ensures code quality before continuing

## Installation

### 1. Add HMCTS Marketplace

```bash
/plugin marketplace add hmcts/.claude
```

### 2. Install Plugin

```bash
/plugin install expressjs-monorepo@hmcts
```

### 3. Restart Claude Code

After installation, restart Claude Code to activate the plugin.

## Configuration

### MCP Servers

The plugin includes configuration for:
- **Playwright MCP** - Browser automation for E2E testing
- **Jira MCP** - JIRA integration for ticket management

You'll need to create a `.mcp.env` file in your project root with:

```bash
JIRA_URL=https://your-jira-instance.atlassian.net
JIRA_EMAIL=your-email@hmcts.net
JIRA_API_TOKEN=your-api-token
```

### Project Setup

For hooks to work properly, your project should have:
- `yarn format` - Code formatting command
- `yarn lint:fix` - Linting command
- Standard HMCTS monorepo structure

## Usage

### Working with JIRA Tickets

1. **Plan a ticket:**
   ```bash
   /wf-plan PROJ-123
   ```

2. **Implement the ticket:**
   ```bash
   /wf-implement PROJ-123
   ```

3. **Review and finalize:**
   ```bash
   /wf-review PROJ-123
   ```

### Creating Pull Requests

When ready to create a PR:
```bash
/pr
```

The plugin will:
- Ensure you're on an appropriate branch
- Update task tracking in `docs/tickets/[ticket-id]/tasks.md`
- Update architecture docs if needed
- Create comprehensive PR description

### Quick Commits

For quick commits:
```bash
/commit
```

The plugin will:
- Check branch status
- Create clear commit message
- Follow repository conventions

## Development

### Plugin Structure

```
expressjs-monorepo/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── .mcp.json                # MCP server configuration
├── commands/                # Slash commands
├── agents/                  # Specialized agents
├── hooks/                   # Quality hooks
│   ├── hooks.json          # Hook configuration
│   ├── pre-bash.sh         # Pre-bash hook
│   ├── post-write.sh       # Post-write hook
│   ├── pre-commit.sh       # Pre-commit hook
│   └── pre-pr.sh           # Pre-PR hook
└── README.md
```

## Requirements

- Claude Code with plugin support
- Node.js and Yarn (for hooks)
- Docker (for Jira MCP)
- JIRA access (optional, for ticket integration)

## Support

For issues or questions:
- GitHub: https://github.com/hmcts/.claude
- HMCTS internal support channels

## License

Copyright © 2025 HMCTS
