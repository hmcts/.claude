---
description: Implement a JIRA ticket with parallel engineering, testing, and infrastructure work
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

# Implement Task: $ARGUMENT

## Initialize TodoWrite Progress Tracking
Use TodoWrite to create this checklist:
```
- [ ] Retrieve $ARGUMENT specifications in /docs/tickets/$ARGUMENT/
- [ ] Execute parallel implementation (engineering, testing, infrastructure)
- [ ] Complete implementation of tests and run tests
- [ ] Final verification
```

## PHASE 1: Setup and Preparation
*Mark "Retrieve $ARGUMENT specifications in /docs/tickets/$ARGUMENT/" as in_progress*

### Step 1.1: Documentation Loading
```
ACTION: Read specification
READ: docs/tickets/$ARGUMENT/specification.md
READ: docs/tickets/$ARGUMENT/tasks.md
VERIFY: All documentation available
```
*Mark "Retrieve $ARGUMENT specifications in /docs/tickets/$ARGUMENT/" as completed*

## PHASE 2: Parallel Implementation
*Mark "Execute parallel implementation" as in_progress*

### Step 2.1: Launch Parallel Agents [EXECUTE IN PARALLEL]

#### Engineering Implementation Agent
```
AGENT: full-stack-engineer
TASK: Implement all engineering tasks from docs/tickets/$ARGUMENT/tasks.md

PROMPT FOR AGENT:
"Implement the engineering tasks for ticket $ARGUMENT:
1. Read the specification at docs/tickets/$ARGUMENT/specification.md
2. Read the task list at docs/tickets/$ARGUMENT/tasks.md
3. Implement ALL items assigned to the full-stack-engineer 
4. AS YOU COMPLETE EACH TASK:
   - Use the Edit tool to update docs/tickets/$ARGUMENT/tasks.md
   - Change '- [ ]' to '- [x]' for each completed task
   - Update the checklist after completing each major section
5. Write unit tests for all new code (co-located .test.ts files)
6. Ensure >80% test coverage on business logic
7. BEFORE FINISHING: Verify all your tasks in docs/tickets/$ARGUMENT/tasks.md are marked as [x]
IMPORTANT: You MUST update tasks.md to track your progress"
```

#### Testing Implementation Agent
```
AGENT: test-engineer
TASK: Implement all testing tasks from docs/tickets/$ARGUMENT/tasks.md

PROMPT FOR AGENT:
"Implement the testing tasks for ticket $ARGUMENT:
1. Read the task list at docs/tickets/$ARGUMENT/tasks.md
2. Implement ALL items assigned to the test-engineer
3. AS YOU COMPLETE EACH TASK:
   - Use the Edit tool to update docs/tickets/$ARGUMENT/tasks.md
   - Change '- [ ]' to '- [x]' for each completed test category
   - Update the checklist after completing each test suite
4. If the ticket involves a user journey, create E2E tests for the happy path using Playwright in e2e-tests/
5. Include accessibility tests using axe-core in the happy path tests (not separate tests)
6. BEFORE FINISHING: Verify all your tasks in docs/tickets/$ARGUMENT/tasks.md are marked as [x]
IMPORTANT: Create the E2E tests but do not run them yet - they will be run in the final testing phase"
```

#### Infrastructure Implementation Agent
```
AGENT: infrastructure-engineer
TASK: Implement infrastructure requirements if needed

PROMPT FOR AGENT:
"Review and implement infrastructure needs for ticket $ARGUMENT:
1. Read specification at docs/tickets/$ARGUMENT/specification.md
2. Check if infrastructure section exists
3. IF infrastructure changes needed:
   - Update Helm charts if needed
   - Modify Docker configurations if required
   - Update CI/CD pipeline if needed
   - Use Edit tool to mark infrastructure tasks as [x] in docs/tickets/$ARGUMENT/tasks.md
4. IF no infrastructure changes needed:
   - Report 'No infrastructure changes required'
   - If infrastructure tasks exist in docs/tickets/$ARGUMENT/tasks.md, mark them as N/A
5. DO NOT run migrations or builds - coordinator will handle
6. Update docs/tickets/$ARGUMENT/tasks.md with your findings
IMPORTANT: Document your infrastructure assessment in tasks.md"
```

WAIT FOR ALL AGENTS TO COMPLETE
VERIFY: All three agents have finished their tasks

### Step 2.2: Code Review and Quality Checks
*Mark "Complete implementation of tests and run tests" as in_progress*

#### Full Stack Engineer Final Checks 
```
AGENT: full-stack-engineer
TASK: Ensure unit tests are passing and the app is booting

PROMPT FOR AGENT:
"Finalize your implementation for ticket $ARGUMENT:
1. Ensure all unit tests pass
2. Ensure the application boots with `yarn dev` without errors
3. Address any issues found during testing
4. Update docs/tickets/$ARGUMENT/tasks.md to reflect your review status
```

#### Test Engineer Final Checks 

```
AGENT: test-engineer
TASK: Ensure E2E tests are passing
PROMPT FOR AGENT:
"Finalize your testing for ticket $ARGUMENT:
1. Run all E2E tests with `yarn test:e2e`
2. Ensure all tests pass
3. Address any issues found during testing
4. Update docs/tickets/$ARGUMENT/tasks.md to reflect your review status
```

## PHASE 3: Final Verification
*Mark "Final verification" as in_progress*

### Step 3.1: Final Checks
```
EXECUTE FINAL VERIFICATION:
- All tasks from docs/tickets/$ARGUMENT/tasks.md completed
- All blocking review issues resolved
```
*Mark "Complete implementation of tests and run tests" as completed*
*Mark "Final verification" as in_progress*

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
"Implementation of $ARGUMENT complete:
- ✅ All engineering tasks implemented
- ✅ All tests written and passing
- ✅ Infrastructure updated (if needed)
- ✅ Task tracking updated in docs/tickets/$ARGUMENT/tasks.md

Next step: Run /wf-review $ARGUMENT to perform code review and final validation"
