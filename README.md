# HMCTS Claude Code Marketplace

Official HMCTS plugin marketplace for Claude Code development tools and workflows.

## Available Plugins

### ExpressJS Monorepo

**Description:** Complete development workflow for HMCTS ExpressJS monorepos with GOV.UK standards

**Features:**
- JIRA ticket workflow commands (/wf-plan, /wf-implement, /wf-review)
- One-shot implementation commands (/os-small, /os-large)
- Specialized agents (full-stack, infrastructure, testing, UI/UX, code review)
- Quality hooks (auto-formatting, linting, commit validation)
- MCP integrations (Playwright, JIRA)

**Installation:**
```bash
/plugin marketplace add hmcts/.claude
/plugin install expressjs-monorepo@hmcts
```

See [expressjs-monorepo/README.md](expressjs-monorepo/README.md) for full documentation.

## Installation

### Add This Marketplace

```bash
/plugin marketplace add hmcts/.claude
```

### List Available Plugins

```bash
/plugin marketplace list
```

### Install a Plugin

```bash
/plugin install <plugin-name>@hmcts
```

## Contributing

To add a new plugin to this marketplace:

1. Create plugin directory with proper structure:
   ```
   plugin-name/
   ├── .claude-plugin/
   │   └── plugin.json
   ├── README.md
   └── ... (commands/, agents/, hooks/, etc.)
   ```

2. Add plugin entry to `.claude-plugin/marketplace.json`

3. Submit PR with plugin documentation

## Plugin Development Guidelines

### Required Structure

Every plugin must include:
- `.claude-plugin/plugin.json` - Plugin metadata
- `README.md` - Installation and usage instructions

### Optional Components

- `commands/` - Custom slash commands
- `agents/` - Specialized agents
- `hooks/` - Event-driven automation
- `.mcp.json` - MCP server configuration

### Metadata Requirements

`plugin.json` must include:
```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Clear description",
  "author": "HMCTS",
  "homepage": "https://github.com/hmcts/.claude"
}
```

## Standards

All plugins must:
- Follow HMCTS coding standards
- Include comprehensive documentation
- Support both English and Welsh where applicable
- Meet WCAG 2.2 AA accessibility standards (for UI components)
- Include proper error handling
- Be tested before publication

## Support

For issues or questions:
- Create an issue: https://github.com/hmcts/.claude/issues
- HMCTS internal support channels

## License

Copyright © 2025 HMCTS
