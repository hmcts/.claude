  #!/bin/bash
  # Post-write hook - runs after file modifications to ensure code quality

  set -euo pipefail
  cd "$CLAUDE_PROJECT_DIR"

  # Logging function
  log_hook() {
      local log_file="$CLAUDE_PROJECT_DIR/.claude/hooks/run.log"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] POST-WRITE: $1" >> "$log_file"
  }

  log_hook "Hook started"
  echo "🔧 Running post-write checks..."

  # Initialize quality check CSV
  QUALITY_CSV="$CLAUDE_PROJECT_DIR/.claude/hooks/analytics_data/quality_checks.csv"
  TIMESTAMP=$(date +%s%3N)

  # Get session ID from environment or use 'unknown'
  SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

  # Get user ID from git config
  USER_ID=$(git config user.email 2>/dev/null || echo "${USER:-unknown}")

  # Get tool name from environment or use 'unknown'
  TOOL_NAME="${CLAUDE_TOOL_NAME:-Edit|Write|MultiEdit}"

  # Create CSV header if file doesn't exist
  if [ ! -f "$QUALITY_CSV" ]; then
      mkdir -p "$(dirname "$QUALITY_CSV")"
      echo "session_id,user_id,timestamp,check_type,status,tool_name" > "$QUALITY_CSV"
  fi

  # Run formatter check
  echo "Checking code formatting..."
  log_hook "Starting formatter check"
  if ! yarn format; then
      echo "❌ Code formatting check failed. Run 'yarn format' to fix."
      log_hook "Formatter check failed"

      # Log failure to CSV
      echo "${SESSION_ID},${USER_ID},${TIMESTAMP},format,fail,${TOOL_NAME}" >> "$QUALITY_CSV"
      exit 2
  fi

  # Log format success
  echo "${SESSION_ID},${USER_ID},${TIMESTAMP},format,pass,${TOOL_NAME}" >> "$QUALITY_CSV"

  # Run linter and exit with code 2 if it fails
  echo "Running linter..."
  log_hook "Starting linter"
  if ! yarn lint:fix; then
      echo "❌ Linting failed"
      log_hook "Linter failed"

      # Log failure to CSV
      echo "${SESSION_ID},${USER_ID},${TIMESTAMP},lint,fail,${TOOL_NAME}" >> "$QUALITY_CSV"
      exit 2
  fi

  # Log lint success
  echo "${SESSION_ID},${USER_ID},${TIMESTAMP},lint,pass,${TOOL_NAME}" >> "$QUALITY_CSV"

  echo "✅ Post-write checks completed"
  log_hook "Hook completed successfully"
  exit 0