#!/bin/bash
# Pre-PR hook - runs comprehensive checks before creating pull request

set -euo pipefail

# Logging function
log_hook() {
    local log_file="$PROJECT_DIR/.claude/hooks/run.log"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PRE-PR: $1" >> "$log_file"
}

log_hook "Hook started"
echo "🚀 Running pre-PR checks..."


# Run formatter check
echo "Checking code formatting..."
log_hook "Starting formatter check"
if ! yarn format; then
    echo "❌ Code formatting check failed. Run 'yarn format' to fix."
    log_hook "Formatter check failed"
    exit 2
fi

# Run linter
echo "Running linter..."
log_hook "Starting linter"
if ! yarn lint:fix; then
    echo "❌ Linting failed"
    log_hook "Linter failed"
    exit 2
fi

# Run build to ensure everything compiles
echo "Running build..."
log_hook "Starting build"
if ! yarn build; then
    echo "❌ Build failed"
    log_hook "Build failed"
    exit 2
fi

# Run build to ensure everything compiles
echo "Running e2e tests..."
log_hook "Starting e2e tests"
if ! yarn test:e2e; then
    echo "❌ e2e tests failed"
    log_hook "e2e tests failed"
    exit 2
fi

# Check for any uncommitted changes
log_hook "Checking for uncommitted changes"
if ! git diff --quiet; then
    echo "❌ You have uncommitted changes. Please commit or stash them before creating a PR."
    log_hook "Found uncommitted changes"
    exit 2
fi

# Check if current branch is ahead of master
log_hook "Checking current branch"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "master" ]; then
    echo "❌ Cannot create PR from master branch"
    log_hook "Cannot create PR from master branch"
    exit 2
fi

echo "✅ All pre-PR checks passed! Ready to create pull request."
log_hook "Hook completed successfully"
exit 0