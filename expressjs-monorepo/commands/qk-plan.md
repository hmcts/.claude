---
description: Create technical implementation plan for a JIRA ticket
argument-hint: <JIRA-KEY>
allowed-tools:
  - Task
  - TodoWrite
  - Read
  - Write
---

# Quick Plan: $ARGUMENT

## Initialize Progress Tracking
Use TodoWrite to create this checklist:
```
- [ ] Create technical implementation plan
- [ ] Create task list
```

## PHASE 1: Technical Planning
*Mark "Create technical implementation plan" as in_progress*

### Step 1.1: Generate Implementation Plan [ISOLATED AGENT]

```
AGENT: full-stack-engineer
TASK: Create a technical implementation plan and task list for the ticket
INPUT: docs/tickets/$ARGUMENT/ticket.md
OUTPUT: docs/tickets/$ARGUMENT/plan.md AND docs/tickets/$ARGUMENT/tasks.md

PROMPT FOR AGENT:
"Review the JIRA ticket details in docs/tickets/$ARGUMENT/ticket.md and create TWO separate files:

**FILE 1: docs/tickets/$ARGUMENT/plan.md**
This is the technical specification/plan including:

1. **Technical Approach**
   - High-level implementation strategy
   - Architecture decisions
   - Key technical considerations

2. **Implementation Details**
   - File structure and organization (following @CLAUDE.md guidelines - use libs/ for features)
   - Components/modules to create
   - API endpoints (if needed)
   - Database schema changes (if needed)

3. **Error Handling & Edge Cases**
   - Potential error scenarios
   - Validation requirements
   - Edge cases to handle

4. **Acceptance Criteria Mapping**
   - How each acceptance criterion will be satisfied
   - Verification approach for each criterion

5. **Open Questions**
   - Any ambiguities that need clarification
   - Technical decisions that need input
   - Listed in a 'CLARIFICATIONS NEEDED' section at the end

**FILE 2: docs/tickets/$ARGUMENT/tasks.md**
This is a simple checklist of implementation tasks in order:

## Implementation Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

Keep both files focused and practical. Only address concerns directly related to this ticket."

WAIT FOR AGENT TO COMPLETE
```
*Mark "Create technical implementation plan" as completed*
*Mark "Create task list" as completed*

## Output to User

Display the following message:

```
Technical planning complete for $ARGUMENT:

Files created:
- docs/tickets/$ARGUMENT/plan.md - Technical specification and implementation approach
- docs/tickets/$ARGUMENT/tasks.md - Implementation task checklist

Review the plan and address any clarifications needed before implementation.

---

Ready to implement? Run: /qk-implement $ARGUMENT
```
