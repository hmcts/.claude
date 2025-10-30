# Quick (QK) Workflow

The Quick Workflow provides a streamlined, granular approach to implementing JIRA tickets. Unlike traditional waterfall workflows that run for extended periods, the QK workflow breaks work into small, fast steps that give you more control and reduce waiting time.

## Philosophy

**Quick** = Smaller, faster steps with human-in-the-loop control at each stage.

Traditional workflows can take 10-20+ minutes per step, requiring "coffee breaks" while agents work. The QK workflow completes each phase in 2-5 minutes, keeping you engaged and in control.

## Workflow Overview

```
/qk-start → /qk-plan → /qk-implement → /qk-review
  (2 min)    (3 min)      (5 min)        (3 min)
```

**Total time: ~13 minutes with multiple decision points**

Compare this to traditional workflows that might run 30-60 minutes with fewer opportunities for course correction.

## Commands

### 1. `/qk-start JIRA-XXX`

**Purpose:** Fetch JIRA ticket and prepare documentation folder

**What it does:**
- Creates `docs/tickets/JIRA-XXX/` folder
- Fetches ticket details from JIRA (summary, description, status, assignee, etc.)
- Downloads all attachments in parallel
- Saves everything to `docs/tickets/JIRA-XXX/`

**Output:**
- `docs/tickets/JIRA-XXX/ticket.md` - Ticket details
- `docs/tickets/JIRA-XXX/[attachments]` - All JIRA attachments
- Displays ticket summary

**Time:** ~2 minutes

**Next step:** Review the ticket details, then run `/qk-plan JIRA-XXX`

---

### 2. `/qk-plan JIRA-XXX`

**Purpose:** Create technical implementation plan and task list

**What it does:**
- Uses `full-stack-engineer` agent to analyze the ticket
- Creates a technical specification and implementation approach
- Generates a simple task checklist for implementation

**Output:**
- `docs/tickets/JIRA-XXX/plan.md` - Technical specification including:
  - Technical approach and architecture decisions
  - Implementation details (file structure, components, APIs, database)
  - Error handling and edge cases
  - Acceptance criteria mapping
  - Open questions/clarifications needed
- `docs/tickets/JIRA-XXX/tasks.md` - Simple task checklist:
  - Implementation tasks
  - Testing tasks

**Time:** ~3 minutes

**Decision point:** Review the plan and task list. Address any clarifications needed before proceeding.

**Next step:** If plan looks good, run `/qk-implement JIRA-XXX`

---

### 3. `/qk-implement JIRA-XXX`

**Purpose:** Execute implementation following the plan

**What it does:**
- Uses `full-stack-engineer` agent to implement the ticket
- Reads `ticket.md`, `plan.md`, and `tasks.md`
- Works through each task systematically:
  - Implements features following the technical plan
  - Writes unit tests (co-located `.test.ts` files)
  - Creates E2E tests if applicable
  - Updates `tasks.md` as each task completes (marks `[x]`)
- Runs all tests (unit and E2E)
- Verifies the application boots successfully

**Output:**
- Fully implemented feature with tests
- Updated `docs/tickets/JIRA-XXX/tasks.md` with all tasks marked complete
- All tests passing
- Application verified working

**Time:** ~5 minutes (varies by complexity)

**Decision point:** Implementation complete. Ready for review.

**Next step:** Run `/qk-review JIRA-XXX`

---

### 4. `/qk-review JIRA-XXX`

**Purpose:** Comprehensive code review and feedback

**What it does:**
- Uses `code-reviewer` agent to analyze all changes
- Reviews via `git diff` to see actual code changes
- Performs comprehensive assessment:
  - **Security:** Input validation, authentication, data protection
  - **Accessibility:** WCAG 2.2 AA compliance, GOV.UK components
  - **Code Quality:** TypeScript safety, error handling, structure
  - **Testing:** Coverage, quality, accessibility tests
  - **Performance:** Query efficiency, responsive design, optimization
  - **Standards:** GOV.UK Design System, progressive enhancement
- Verifies all acceptance criteria are met

**Output:**
- `docs/tickets/JIRA-XXX/review.md` - Detailed review report with:
  - 🚨 **CRITICAL Issues** - Must fix before deployment
  - ⚠️ **HIGH PRIORITY Issues** - Should fix
  - 💡 **SUGGESTIONS** - Consider improving
  - ✅ **Positive Feedback** - Things done well
  - Test coverage assessment
  - Acceptance criteria verification
  - Overall assessment (APPROVED / NEEDS CHANGES / MAJOR REVISIONS REQUIRED)
- Summary displayed in terminal

**Time:** ~3 minutes

**Decision point:** Review the feedback.

**Next steps:**
- **If APPROVED:** Ready to commit and create PR
  ```bash
  git add . && git commit -m "Implement JIRA-XXX"
  gh pr create
  ```
- **If NEEDS CHANGES:** Address issues and re-run `/qk-review JIRA-XXX`

---

## Complete Example

```bash
# Step 1: Fetch ticket (2 min)
/qk-start PROJ-123
# Review ticket summary, check attachments

# Step 2: Create plan (3 min)
/qk-plan PROJ-123
# Review plan.md and tasks.md, address clarifications

# Step 3: Implement (5 min)
/qk-implement PROJ-123
# Watch progress as tasks complete in tasks.md

# Step 4: Review (3 min)
/qk-review PROJ-123
# Review feedback in review.md

# If approved, commit and PR
git add . && git commit -m "Implement PROJ-123"
gh pr create
```

## Files Created

For ticket `PROJ-123`, the workflow creates:

```
docs/tickets/PROJ-123/
├── ticket.md          # JIRA ticket details (from qk-start)
├── [attachments]      # JIRA attachments (from qk-start)
├── plan.md            # Technical specification (from qk-plan)
├── tasks.md           # Task checklist (from qk-plan)
└── review.md          # Code review report (from qk-review)
```

## Advantages Over Traditional Workflows

### Quick Workflow (QK)
- ✅ **Granular steps:** 4 distinct phases with decision points
- ✅ **Fast execution:** 2-5 minutes per step (~13 min total)
- ✅ **Human-in-the-loop:** Review and approve at each stage
- ✅ **Easy course correction:** Catch issues early
- ✅ **No coffee breaks needed:** Stay engaged throughout
- ✅ **Clear artifacts:** Each step produces reviewable output
- ✅ **Flexible:** Skip or repeat steps as needed

## When to Use QK Workflow

**Use QK workflow when:**
- You want more control over each phase
- You prefer incremental progress with reviews
- You're learning or exploring the codebase
- The ticket requirements might need clarification
- You want to stay engaged without long waits
- You're working on complex or unfamiliar features

**Consider traditional workflows when:**
- You have a very clear, well-defined ticket
- You're comfortable with longer autonomous execution
- You want to batch multiple tickets
- You're confident in the approach and don't need incremental review

## Tips for Success

1. **Review each output:** Don't rush through. Read `plan.md`, check `tasks.md`, review `review.md`
2. **Address clarifications early:** If `plan.md` has open questions, answer them before implementing
3. **Watch tasks.md progress:** During implementation, you can open `tasks.md` to see progress
4. **Use git status frequently:** Check what's being changed at each step
5. **Re-run as needed:** If review identifies issues, fix them and run `/qk-review` again
6. **Document decisions:** Add notes to ticket files if you make important decisions

## Integration with Existing Workflows

The QK workflow complements existing workflows:

- **For small tickets:** Use QK workflow end-to-end
- **For large tickets:** Use `/wf-plan` for detailed planning, then QK for implementation phases
- **For urgent fixes:** Use `/os-small` for one-shot implementation
- **For complex features:** Use QK workflow with multiple review cycles
