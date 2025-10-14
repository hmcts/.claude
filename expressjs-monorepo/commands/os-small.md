---
description: Quick autonomous implementation of a small JIRA ticket
argument-hint: <ticket-id>
allowed-tools:
  - Task
  - TodoWrite
  - Bash
  - mcp__jira__*
  - Read
  - Write
  - Edit
  - MultiEdit
  - Glob
  - Grep
---

# One Shot Small: $ARGUMENT

## Initialize TodoWrite Progress Tracking
Use TodoWrite to create this checklist:
```
- [ ] Retrieve JIRA ticket and setup branch
- [ ] Implement feature with tests
- [ ] Run quality checks
```

## PHASE 1: Setup
*Mark "Retrieve JIRA ticket and setup branch" as in_progress*

### Step 1.1: JIRA and Git Setup
```
EXECUTE:
1. Use mcp__jira__jira_get_issue with issue_key=$ARGUMENT
2. git stash
3. git checkout master
4. git pull
5. git checkout -b feature/$ARGUMENT-[derive-name-from-ticket]
6. mkdir -p docs/tickets/$ARGUMENT

ACTIONS:
- Write JIRA ticket content to docs/tickets/$ARGUMENT/ticket.md
- Create docs/tickets/$ARGUMENT/tasks.md with simple structure:

## Implementation Tasks
- [ ] Implement feature
- [ ] Write unit tests
- [ ] Create E2E tests (if applicable)

VERIFY: Branch created, documentation present
```
*Mark "Retrieve JIRA ticket and setup branch" as completed*

## PHASE 2: Implementation
*Mark "Implement feature with tests" as in_progress*

### Step 2.1: Parallel Implementation [EXECUTE IN PARALLEL]

```
LAUNCH 2 AGENTS IN PARALLEL:

AGENT 1: full-stack-engineer
PROMPT FOR AGENT:
"Quick implementation of $ARGUMENT:
1. Read docs/tickets/$ARGUMENT/ticket.md
2. Implement the feature following CLAUDE.md guidelines
3. Write unit tests (co-located .test.ts files)
4. Ensure >80% test coverage on new code
5. Update docs/tickets/$ARGUMENT/tasks.md marking implementation tasks as [x]
Keep it simple and focused."

AGENT 2: test-engineer
PROMPT FOR AGENT:
"Create E2E tests for $ARGUMENT if applicable:
1. Read docs/tickets/$ARGUMENT/ticket.md
2. If user journey involved, create E2E test in e2e-tests/
3. Include accessibility checks with axe-core
4. If no E2E test needed, mark task as N/A
5. Update docs/tickets/$ARGUMENT/tasks.md
DO NOT run tests yet."

WAIT FOR BOTH AGENTS TO COMPLETE
```
*Mark "Implement feature with tests" as completed*

## PHASE 3: Quality Checks
*Mark "Run quality checks" as in_progress*

### Step 3.1: Run Tests
```
EXECUTE IN SEQUENCE:
1. yarn lint
2. yarn dev (verify boots - kill after 10 seconds)
3. yarn test
4. yarn test:e2e

IF FAILURES:
  - Fix with e2e tests with test-engineer, everything else with full-stack-engineer agent
  - Re-run failed tests
  - Repeat until passing

VERIFY: All checks pass
```
*Mark "Run quality checks" as completed*

## COMPLETION CHECK
```
FINAL VALIDATION:
- Feature implemented
- Tests passing (lint, unit, e2e)
- Tasks.md reflects completion
- No obvious quality issues
```

## Success Output
"Quick implementation of $ARGUMENT complete:
- ✅ Feature implemented
- ✅ Tests written and passing
- ✅ Quality checks passed

Documentation: docs/tickets/$ARGUMENT/
Branch: feature/$ARGUMENT-[name]

Ready for PR creation or manual review."