---
description: Full autonomous implementation of a JIRA ticket from planning to review
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

# One Shot Large: $ARGUMENT

## Initialize TodoWrite Progress Tracking
Use TodoWrite to create this checklist:
```
- [ ] Retrieve JIRA ticket and setup branch
- [ ] Generate technical specification and tasks
- [ ] Parallel implementation (engineering, testing, infrastructure)
- [ ] Run all tests and quality checks
- [ ] Code review and final verification
```

## PHASE 1: Setup
*Mark "Retrieve JIRA ticket and setup branch" as in_progress*

### Step 1.1: JIRA and Git Setup
```
EXECUTE IN PARALLEL:
1. Use mcp__jira__jira_get_issue with issue_key=$ARGUMENT
2. git stash
3. git status

THEN EXECUTE IN SEQUENCE:
1. git checkout master
2. git pull
3. git checkout -b feature/$ARGUMENT-[derive-name-from-ticket]
4. mkdir -p docs/tickets/$ARGUMENT

ACTIONS:
- Write JIRA ticket content to docs/tickets/$ARGUMENT/ticket.md
VERIFY: Branch created, folder exists, ticket documented
```
*Mark "Retrieve JIRA ticket and setup branch" as completed*

## PHASE 2: Specification Development
*Mark "Generate technical specification and tasks" as in_progress*

### Step 2.1: Create Specification

```
STEP 1: Create Technical Specification
AGENT: full-stack-engineer
TASK: Create technical specification
PROMPT FOR AGENT:
"Create docs/tickets/$ARGUMENT/specification.md based on docs/tickets/$ARGUMENT/ticket.md covering:
1. High level technical implementation approach
2. File structure and routing (use libs/ per CLAUDE.md)
3. Error handling implementation
4. RESTful API endpoints if needed
5. Database schema if needed
IMPORTANT: Only focus on this ticket, no cross-cutting concerns."

STEP 2: Create Infrastructure Assessment
AGENT: infrastructure-engineer
TASK: Assess infrastructure needs
PROMPT FOR AGENT:
"Review docs/tickets/$ARGUMENT/specification.md and determine infrastructure needs.
If changes needed, ADD infrastructure section to docs/tickets/$ARGUMENT/specification.md covering:
1. Database changes
2. Environment variables
3. Helm chart updates
4. Docker/Kubernetes updates
5. CI/CD pipeline changes
If no changes needed, skip this step.
IMPORTANT: Only focus on this ticket."

STEP 3: CREATE TASK LIST
AGENT: orchestrator
TASK: Create task breakdown
PROMPT FOR AGENT:
"Create docs/tickets/$ARGUMENT/tasks.md with structure:

## Implementation Tasks (full-stack-engineer)
- [ ] [List implementation tasks from specification]
- [ ] Write unit tests for all new code

## Testing Tasks (test-engineer)
- [ ] Create E2E tests for happy path

## Infrastructure Tasks (infrastructure-engineer)
- [ ] [List infrastructure tasks if any, or mark N/A]

## Review Tasks (code-reviewer)
- [ ] Review code quality and standards
- [ ] Ensure 80-90% test coverage
- [ ] Check security implementation

Base this on the specification in docs/tickets/$ARGUMENT/specification.md"

```
*Mark "Generate technical specification and tasks" as completed*

## PHASE 3: Parallel Implementation
*Mark "Parallel implementation (engineering, testing, infrastructure)" as in_progress*

### Step 3.1: Launch Parallel Implementation [EXECUTE IN PARALLEL]

```
LAUNCH 3 AGENTS IN PARALLEL:

AGENT 1: full-stack-engineer
PROMPT FOR AGENT:
"Implement all engineering tasks for $ARGUMENT:
1. Read docs/tickets/$ARGUMENT/specification.md
2. Read docs/tickets/$ARGUMENT/tasks.md
3. Implement ALL full-stack-engineer tasks
4. AS YOU COMPLETE EACH TASK:
   - Update docs/tickets/$ARGUMENT/tasks.md
   - Change '- [ ]' to '- [x]'
5. Write unit tests (co-located .test.ts files)
6. Ensure >80% test coverage
7. VERIFY all your tasks are marked [x]"

AGENT 2: test-engineer
PROMPT FOR AGENT:
"Implement E2E tests for $ARGUMENT:
1. Read docs/tickets/$ARGUMENT/tasks.md
2. Create E2E tests for happy path in e2e-tests/
3. Include accessibility tests using axe-core
4. Update docs/tickets/$ARGUMENT/tasks.md marking tests as [x]
5. DO NOT run tests yet - will run in next phase"

AGENT 3: infrastructure-engineer
PROMPT FOR AGENT:
"Handle infrastructure for $ARGUMENT:
1. Read docs/tickets/$ARGUMENT/specification.md
2. If infrastructure section exists, implement changes
3. If no infrastructure needed, mark tasks as [x] or N/A
4. Update docs/tickets/$ARGUMENT/tasks.md
5. DO NOT run migrations - will run in next phase"

WAIT FOR ALL AGENTS TO COMPLETE
```
*Mark "Parallel implementation (engineering, testing, infrastructure)" as completed*

## PHASE 4: Testing and Quality
*Mark "Run all tests and quality checks" as in_progress*

### Step 4.1: Run Test Suite
```
EXECUTE IN SEQUENCE:
1. yarn lint
2. yarn dev (verify app boots - kill after 10 seconds if successful)
3. yarn test (unit tests)
4. yarn test:e2e (E2E tests)

IF ANY FAILURES:
  - Use test engineer to fix e2e tests, use full-stack-engineer agent to fix everything else
  - Re-run failed tests
  - Repeat until all pass

VERIFY: All tests passing
```
*Mark "Run all tests and quality checks" as completed*

## PHASE 5: Code Review
*Mark "Code review and final verification" as in_progress*

### Step 5.1: Automated Review
```
AGENT: code-reviewer
TASK: Comprehensive code review
PROMPT FOR AGENT:
"Review implementation of $ARGUMENT:
1. Run git diff master to see all changes
2. Check CLAUDE.md adherence:
   - Naming conventions
   - Module structure
   - Welsh translations included
   - No business logic in apps/
   - TypeScript strict mode
3. Security requirements:
   - Input validation
   - No hardcoded secrets
   - Parameterized queries
4. Test coverage and quality
5. Create docs/tickets/$ARGUMENT/review.md with:
   - Issues that MUST be fixed (blocking)
   - Suggestions for improvement (non-blocking)

IF BLOCKING ISSUES FOUND:
  - Fix them using appropriate agents
  - Re-run tests
  - Update review.md"

VERIFY: Review complete, blocking issues resolved
```

### Step 5.2: Final Task Verification
```
ACTION: Verify task completion
1. Read docs/tickets/$ARGUMENT/tasks.md
2. Count completed [x] vs total tasks
3. Verify all critical tasks marked [x]
4. Generate completion report

IF ANY TASKS INCOMPLETE:
  - Verify if work was done (git status)
  - Complete missing work OR document why cannot complete
  - Update tasks.md
```
*Mark "Code review and final verification" as completed*

## COMPLETION CHECK
```
FINAL VALIDATION:
- All tasks in docs/tickets/$ARGUMENT/tasks.md marked [x] or documented
- All tests passing (lint, unit, e2e)
- Code review completed
- Review.md shows no blocking issues
```

## Success Output
"Full implementation of $ARGUMENT complete:
- ✅ Specification created
- ✅ All engineering tasks implemented
- ✅ All tests written and passing
- ✅ Infrastructure updated (if needed)
- ✅ Code review completed with no blocking issues

Documentation: docs/tickets/$ARGUMENT/
Branch: feature/$ARGUMENT-[name]

Ready for PR creation or manual review."