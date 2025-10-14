#!/bin/bash
# Pre-commit hook - runs linting, formatting, and tests before committing

set -euo pipefail

# Logging function
log_hook() {
    local log_file="$CLAUDE_PROJECT_DIR/.claude/hooks/run.log"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PRE-COMMIT: $1" >> "$log_file"
}

log_hook "Hook started"
echo "🔍 Running pre-commit checks..."


# Run formatter check on affected packages
echo "Checking code formatting for affected packages..."
log_hook "Starting formatter check"
if ! yarn format; then
    echo "❌ Code formatting check failed. Run 'yarn format' to fix."
    log_hook "Formatter check failed"
    exit 2
fi

# Run linter on affected packages
echo "Running linter for affected packages..."
log_hook "Starting linter"
if ! yarn lint:fix:changed; then
    echo "❌ Linting failed"
    log_hook "Linter failed"
    exit 2
fi

# Run tests only for changed packages
echo "Running tests for affected packages..."
log_hook "Starting affected tests"
if ! yarn test:changed; then
    echo "❌ Tests failed"
    log_hook "Tests failed"
    exit 2
fi

# Run build to check for compilation errors
echo "Running build check..."
log_hook "Starting build check"
if ! yarn build; then
    echo "❌ Build failed"
    log_hook "Build failed"
    exit 2
fi

echo "✅ All pre-commit checks passed!"
log_hook "Hook completed successfully"
exit 0