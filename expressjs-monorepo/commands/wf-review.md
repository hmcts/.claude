---
description: Review implementation of a JIRA ticket with code review and quality checks
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

# Review Task: $ARGUMENT

## Initialize TodoWrite Progress Tracking
Use TodoWrite to create this checklist:
```
- [ ] Retrieve $ARGUMENT specifications in /docs/tickets/$ARGUMENT/
- [ ] Perform code review
- [ ] Run code quality checks (lint, unit test, e2e tests)
- [ ] Final verification
```

## PHASE 1: Setup and Preparation
*Mark "Retrieve $ARGUMENT specifications in /docs/tickets/$ARGUMENT/" as in_progress*

### Step 1.1: Documentation Loading
```
ACTION: Read specification
READ: docs/tickets/$ARGUMENT/ticket.md
READ: docs/tickets/$ARGUMENT/specification.md
READ: docs/tickets/$ARGUMENT/tasks.md
VERIFY: All documentation available
```
*Mark "Retrieve $ARGUMENT specifications in /docs/tickets/$ARGUMENT/" as completed*

## PHASE 2: Code Review

### Step 2.1: Code Review
*Mark "Perform code review" as in_progress*
```
AGENT: code-reviewer
TASK: Review all changes and provide feedback

PROMPT FOR AGENT:
1. Run git diff against master to see all changes
2. Check adherence to CLAUDE.md conventions:
   - Naming conventions followed
   - Module structure correct
   - Welsh translations included
   - No business logic in apps/
   - TypeScript strict mode compliance
3. Verify security requirements:
   - Input validation present
   - No hardcoded secrets
   - Parameterized queries used
4. Check test coverage and quality
5. Create a review report with:
   - Issues that MUST be fixed (blocking)
   - Suggestions for improvement (non-blocking)
OUTPUT: Save review to docs/tickets/$ARGUMENT/review.md"

VERIFY: Review document created
```
*Mark "Perform code review" as completed*

### Step 2.2: Code Quality Checks
*Mark "Run code quality checks (lint, unit test, e2e tests)" as in_progress*
```
EXECUTE IN SEQUENCE:
1. yarn lint
2. yarn dev (test the app boots)
3. yarn test (run unit tests)
4. yarn test:e2e (run Playwright E2E tests)
5. yarn test:coverage (verify coverage >80%)
VERIFY: All tests pass
IF tests fail:
  - Identify failing tests
  - Fix implementation or test issues
  - Re-run until all pass
```
*Mark "Run code quality checks (lint, unit test, e2e tests)" as completed*

## PHASE 3: Final Verification
*Mark "Final verification" as in_progress*

### Step 6.1: Final Checks
```
EXECUTE FINAL VERIFICATION:
- All tasks from docs/tickets/$ARGUMENT/tasks.md completed
- All blocking review issues resolved
```
*Mark "Final verification" as completed*
 
## COMPLETION CHECK
```
ACTION: Final validation of task tracking
1. Read docs/tickets/$ARGUMENT/tasks.md
2. Count total tasks vs completed [x] tasks
3. Generate completion report:
   - Implementation Tasks: X/Y completed
   - Testing Tasks: X/Y completed
   - Infrastructure Tasks: X/Y completed or N/A

IF any tasks remain unchecked:
  - Identify which specific tasks are incomplete
  - Verify if work was actually done (check git status)
  - Either complete missing work OR document why task cannot be completed
  - Update tasks.md accordingly

FINAL VALIDATION:
- All critical tasks must be marked [x] or have documented exceptions
- Definition of Done checklist should reflect actual state
```

## Success Output
"Review of $ARGUMENT complete:
- ✅ All engineering tasks implemented
- ✅ Code review completed
- ✅ Lint checks passing
- ✅ Unit tests passing
- ✅ E2E tests passing

Review completed. Check docs/tickets/$ARGUMENT/review.md for detailed feedback and recommendations.
"