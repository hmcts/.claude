#!/bin/bash

# Unified pre-bash hook that routes to specific handlers based on the command
# This script receives the command that Claude is about to run and decides
# which specialized hook to call

set -e

# Get the command that Claude is about to run
# The hook receives JSON data via stdin with the command in tool_input.command
JSON_INPUT=$(cat)
# Extract the command from JSON using bash string manipulation to avoid jq dependency
COMMAND=$(echo "$JSON_INPUT" | sed -n 's/.*"command":"\([^"]*\)".*/\1/p')

# Check if this is a git commit command
if [[ "$COMMAND" =~ ^git\ commit ]]; then
    exec "$PROJECT_DIR/.claude/hooks/pre-commit.sh"
fi

# Check if this is a PR creation command
if [[ "$COMMAND" =~ ^gh\ pr\ create ]]; then
    exec "$PROJECT_DIR/.claude/hooks/pre-pr.sh"
fi

