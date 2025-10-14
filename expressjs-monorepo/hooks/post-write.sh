#!/bin/bash
# Post-write hook - runs after file modifications to ensure code quality

set -euo pipefail
# Change directory to CLAUDE_PROJECT_DIR

cd "$CLAUDE_PROJECT_DIR"

# Logging function
log_hook() {
    local log_file="$CLAUDE_PROJECT_DIR/.claude/hooks/run.log"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] POST-WRITE: $1" >> "$log_file"
}

log_hook "Hook started"
echo "🔧 Running post-write checks..."

# Run formatter check
echo "Checking code formatting..."
log_hook "Starting formatter check"
if ! yarn format; then
    echo "❌ Code formatting check failed. Run 'yarn format' to fix."
    log_hook "Formatter check failed"
    exit 2
fi

# Run linter and exit with code 2 if it fails
echo "Running linter..."
log_hook "Starting linter"
if ! yarn lint:fix; then
    echo "❌ Linting failed"
    log_hook "Linter failed"
    exit 2
fi

echo "✅ Post-write checks completed"
log_hook "Hook completed successfully"
exit 0