# JIRA-Based Mini Waterfall Workflow

## Overview

This workflow provides a structured, three-phase approach to implementing JIRA tickets using specialized AI agents. It combines planning, parallel implementation, and comprehensive review into a mini waterfall process that ensures quality, consistency, and thorough documentation.

## Workflow Phases

The workflow consists of three sequential slash commands:

1. **`/wf-plan <ticket-id>`** - Planning and specification
2. **`/wf-implement <ticket-id>`** - Parallel implementation
3. **`/wf-review <ticket-id>`** - Code review and quality assurance

## Phase 1: Planning (`/wf-plan`)

### Purpose
Create a comprehensive technical specification and implementation plan for a JIRA ticket.

### What It Does

#### 1. Setup
- Retrieves JIRA ticket details using MCP JIRA integration
- Creates a feature branch: `feature/<ticket-id>-<derived-name>`
- Creates documentation structure at `docs/tickets/<ticket-id>/`

#### 2. Specification Development
Uses specialized agents in isolation:

**Full-Stack Engineer Agent**
- Creates `specification.md` with:
  - High-level technical approach
  - File structure and routing (following libs/ over apps/ convention)
  - Error handling strategy
  - RESTful API endpoints (if needed)
  - Database schema (if needed)
  - Flags ambiguities for clarification

**Infrastructure Engineer Agent**
- Reviews specification for infrastructure needs
- Documents requirements for:
  - Database changes
  - Environment variables
  - Helm chart updates
  - Docker/Kubernetes configuration
  - CI/CD pipeline changes
- Only adds infrastructure section if changes are actually needed

#### 3. Task Assignment
Creates `tasks.md` with role-specific assignments:
- Implementation tasks (full-stack-engineer)
- Testing tasks (test-engineer)
- Review tasks (code-reviewer)
- UI/UX tasks (ui-ux-engineer)

### Output Artifacts
```
docs/tickets/<ticket-id>/
├── ticket.md           # JIRA ticket details
├── specification.md    # Technical specification
└── tasks.md           # Role-assigned task checklist
```

### When to Use
- At the start of any non-trivial ticket implementation
- When you need clear technical direction before coding
- When multiple team members need to understand the approach

### Example Usage
```bash
/wf-plan PROJ-123
```

## Phase 2: Implementation (`/wf-implement`)

### Purpose
Execute the implementation plan using parallel, specialized agents.

### What It Does

#### 1. Parallel Execution
Launches three agents simultaneously:

**Full-Stack Engineer Agent**
- Implements all engineering tasks from `tasks.md`
- Writes co-located unit tests (`.test.ts` files)
- Maintains >80% test coverage on business logic
- Updates `tasks.md` as tasks complete (changes `[ ]` to `[x]`)

**Test Engineer Agent**
- Creates E2E tests for user journeys (Playwright)
- Includes accessibility tests using axe-core
- Updates `tasks.md` as test suites complete
- Does NOT run tests yet (runs in final phase)

**Infrastructure Engineer Agent**
- Implements infrastructure changes if specified
- Updates Helm charts, Docker configs, CI/CD pipelines
- Reports if no infrastructure changes needed
- Documents findings in `tasks.md`

#### 2. Final Checks
After parallel work completes:

**Full-Stack Engineer Final Pass**
- Ensures all unit tests pass
- Verifies application boots with `yarn dev`
- Fixes any issues found

**Test Engineer Final Pass**
- Runs all E2E tests with `yarn test:e2e`
- Ensures all tests pass
- Fixes any failing tests

#### 3. Verification
- Validates all tasks in `tasks.md` are completed
- Generates completion report by role
- Documents any exceptions or blockers

### Progress Tracking
All agents actively update `tasks.md` to provide real-time visibility into progress. The coordinator validates all tasks are marked complete before finishing.

### When to Use
- After completing `/wf-plan`
- When ready to begin actual implementation
- When you want parallel work by specialized agents

### Example Usage
```bash
/wf-implement PROJ-123
```

## Phase 3: Review (`/wf-review`)

### Purpose
Comprehensive code review and quality validation before merging.

### What It Does

#### 1. Code Review
**Code Reviewer Agent** performs deep analysis:

**Convention Adherence** (per `CLAUDE.md`):
- Naming conventions
- Module structure (libs/ vs apps/)
- Welsh translations included
- No business logic in apps/
- TypeScript strict mode compliance

**Security Review**:
- Input validation present
- No hardcoded secrets
- Parameterized database queries
- Proper error handling

**Test Quality**:
- Coverage metrics (>80% target)
- Test meaningfulness
- Edge case coverage

**Output**: `docs/tickets/<ticket-id>/review.md` with:
- Blocking issues (must fix)
- Non-blocking suggestions (improvements)

#### 2. Quality Checks
Runs full test suite in sequence:
```bash
yarn lint              # Code style
yarn dev               # Application boots
yarn test              # Unit tests
yarn test:e2e          # E2E tests
yarn test:coverage     # Coverage report
```

If any check fails, identifies and fixes issues before proceeding.

#### 3. Final Verification
- Validates all tasks from `tasks.md` completed
- Ensures all blocking review issues resolved
- Confirms all quality gates passed

### Output Artifacts
```
docs/tickets/<ticket-id>/
└── review.md          # Detailed code review report
```

### When to Use
- After completing `/wf-implement`
- Before creating a pull request
- When you need quality assurance validation

### Example Usage
```bash
/wf-review PROJ-123
```

## Complete Workflow Example

### Scenario
Implementing JIRA ticket PROJ-456: "Add user profile management"

### Step 1: Plan
```bash
/wf-plan PROJ-456
```

**Result**:
- Branch: `feature/PROJ-456-user-profile-management`
- Specification created with page structure, routing, validation
- Infrastructure requirements documented (database schema changes)
- Tasks assigned to each agent role

### Step 2: Implement
```bash
/wf-implement PROJ-456
```

**Result**:
- Profile pages implemented with validation
- Unit tests for profile logic (85% coverage)
- E2E tests for profile creation/editing journey
- Database migration scripts created
- All tasks marked complete in `tasks.md`

### Step 3: Review
```bash
/wf-review PROJ-456
```

**Result**:
- Code review identifies missing Welsh translation
- All tests pass after fixing translations
- Review report confirms ready for PR
- Quality gates: ✅ Lint, ✅ Unit, ✅ E2E, ✅ Coverage

### Step 4: Submit
Create pull request with documentation from `docs/tickets/PROJ-456/`

## Key Features

### 🎯 Task Tracking
All commands use TodoWrite for real-time progress visibility. Agents update `tasks.md` as they complete work, providing transparency.

### 🔄 Parallel Execution
Implementation phase runs multiple agents concurrently, dramatically reducing time compared to sequential execution.

### 🔍 Isolation Boundaries
Agents focus only on ticket-specific work. They explicitly avoid solving cross-cutting concerns that belong in separate tickets.

### 📊 Comprehensive Documentation
Every ticket gets full documentation trail:
- Original requirements (ticket.md)
- Technical approach (specification.md)
- Task breakdown (tasks.md)
- Quality review (review.md)

### ✅ Quality Gates
Review phase enforces quality standards:
- Lint checks
- Unit test coverage
- E2E test coverage
- Security review
- Convention adherence

## Best Practices

### When to Use This Workflow
✅ **Use for**:
- Features requiring multiple components
- User-facing functionality changes
- Database schema changes
- Complex business logic
- Multi-step user journeys

❌ **Skip for**:
- Simple bug fixes
- Typo corrections
- Documentation-only changes
- Configuration updates

### Customizing for Your Needs

#### Adjust Test Coverage Targets
In `wf-implement.md`, modify coverage requirements:
```markdown
6. Ensure >80% test coverage on business logic
```

#### Add Custom Quality Gates
In `wf-review.md`, add additional checks:
```markdown
5. yarn build              # Production build
6. yarn security:audit     # Security scanning
```

#### Modify Agent Prompts
Each agent prompt can be customized for project-specific conventions:
```markdown
PROMPT FOR AGENT:
"Implement tasks following our team conventions:
1. Use React hooks (not class components)
2. Implement Redux for state management
3. Follow our error handling patterns..."
```

### Handling Clarifications

If agents flag ambiguities during planning:
1. Review consolidated questions from specification
2. Get clarification from product owner/stakeholders
3. Update `specification.md` with answers
4. Re-run `/wf-plan` if significant changes
5. Or proceed to `/wf-implement` with updated spec

### Progress Monitoring

Check progress anytime by reading task tracking:
```bash
cat docs/tickets/<ticket-id>/tasks.md
```

Each `[x]` represents completed work; `[ ]` represents pending work.

## Troubleshooting

### "Documentation not found" errors
**Cause**: Running commands out of sequence
**Solution**: Always run `/wf-plan` before `/wf-implement`

### Agents not updating tasks.md
**Cause**: Agent prompts not emphasizing updates
**Solution**: Verify agent includes TodoWrite/Edit in allowed-tools

### Tests failing in review phase
**Cause**: Insufficient testing in implement phase
**Solution**: Ensure implementation phase includes "Final Checks" section

### Infrastructure changes missed
**Cause**: Specification didn't identify infrastructure needs
**Solution**: Review specification.md for infrastructure section, re-run infrastructure agent if needed

## Architecture Notes

### Why Three Phases?
The workflow mirrors traditional waterfall (plan → build → test) but compressed into a "mini" version optimized for single tickets. This structure:
- Prevents rework from unclear requirements
- Enables parallel execution where possible
- Ensures quality gates before completion

### Agent Specialization
Each agent type (full-stack-engineer, test-engineer, infrastructure-engineer, code-reviewer) has:
- Specific domain expertise
- Focused responsibilities
- Clear success criteria

This specialization mirrors real-world team roles and produces higher quality results than generalist approaches.

### Documentation-Driven Development
All work products are documented in `docs/tickets/`. This creates:
- Audit trail for decisions
- Onboarding material for new team members
- Reference for similar future tickets
- Context for code reviewers

## Extending the Workflow

### Adding New Phases
Create additional slash commands following the pattern:
```markdown
---
description: Your new phase description
argument-hint: <ticket-id>
allowed-tools: [Tool1, Tool2, ...]
---

# Your Phase: $ARGUMENT

## Initialize TodoWrite Progress Tracking
Use TodoWrite to create checklist...

## PHASE 1: Your Steps
*Mark "task" as in_progress*
...
```

### Custom Agent Types
Define new agent types in your plugin configuration:
```json
{
  "agents": {
    "security-reviewer": {
      "description": "Specialized security auditor",
      "tools": ["Read", "Grep", "Write"]
    }
  }
}
```

Then reference in command prompts:
```markdown
AGENT: security-reviewer
TASK: Perform security audit
```

## Related Documentation

- See `CLAUDE.md` for project-specific conventions
- See individual agent definitions for capability details
- See `.claude/` for slash command implementations

## Quick Reference

| Command | Purpose | Output Location | Prerequisites |
|---------|---------|----------------|---------------|
| `/wf-plan <id>` | Create specification | `docs/tickets/<id>/` | JIRA ticket exists |
| `/wf-implement <id>` | Build implementation | Code + tests | `/wf-plan` completed |
| `/wf-review <id>` | Quality validation | `docs/tickets/<id>/review.md` | `/wf-implement` completed |

---

**Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: ExpressJS Monorepo Team
