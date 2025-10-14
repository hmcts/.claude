# One-Shot Workflows

## Overview

The one-shot workflows provide fully autonomous ticket implementation from start to finish. Unlike the [mini waterfall workflow](./waterfall-workflow.md) which separates planning, implementation, and review into distinct phases, one-shot workflows execute all phases automatically in a single command.

**Use one-shot workflows when you want**: Fully autonomous execution with minimal human intervention.

**Use waterfall workflows when you want**: More control and visibility at each phase, or the ability to adjust specifications before implementation.

## Available Commands

| Command | Purpose | Complexity | Execution Time |
|---------|---------|------------|----------------|
| `/os-small <ticket-id>` | Quick autonomous implementation | Simple bug fixes, small features | 5-15 minutes |
| `/os-large <ticket-id>` | Full autonomous implementation | Complex features, multi-component | 20-60 minutes |

## Small One-Shot (`/os-small`)

### Purpose
Rapid, autonomous implementation of simple JIRA tickets with minimal overhead.

### When to Use
✅ **Perfect for**:
- Bug fixes
- Simple feature additions
- Configuration changes
- Single-component updates
- Straightforward UI changes
- Documentation updates with code

❌ **Not suitable for**:
- Multi-page features
- Database schema changes
- Complex business logic
- Features requiring multiple services
- Infrastructure-heavy changes

### What It Does

#### Phase 1: Setup
```
1. Retrieves JIRA ticket
2. Creates feature branch: feature/<ticket-id>-<name>
3. Creates minimal docs structure:
   └── docs/tickets/<ticket-id>/
       ├── ticket.md    # JIRA details
       └── tasks.md     # Simple checklist
```

**No specification phase** - goes straight to implementation.

#### Phase 2: Parallel Implementation
Launches **2 agents** simultaneously:

**Full-Stack Engineer Agent**:
- Reads ticket directly
- Implements feature following `CLAUDE.md` guidelines
- Writes co-located unit tests (`.test.ts`)
- Maintains >80% coverage
- Updates `tasks.md` as work completes

**Test Engineer Agent**:
- Assesses if E2E tests needed
- Creates E2E tests if user journey involved
- Includes accessibility checks (axe-core)
- Marks as N/A if not applicable
- Updates `tasks.md`

Both agents work in parallel for maximum speed.

#### Phase 3: Quality Checks
Runs full test suite automatically:
```bash
yarn lint              # Code style
yarn dev               # Boots app (10s verification)
yarn test              # Unit tests
yarn test:e2e          # E2E tests
```

**Auto-healing**: If tests fail, appropriate agent fixes issues and re-runs until passing.

### Output Artifacts
```
docs/tickets/<ticket-id>/
├── ticket.md          # JIRA ticket details
└── tasks.md           # Simple completion checklist
```

### Example Usage

#### Scenario: Fix validation bug in login form
```bash
/os-small BUG-789
```

**Execution** (~8 minutes):
1. **Setup** (1 min): Retrieves ticket, creates branch `feature/BUG-789-fix-login-validation`
2. **Implementation** (5 min):
   - Engineer fixes validation logic in `libs/auth/validation.ts`
   - Engineer writes unit tests for validation fix
   - Test engineer determines no E2E changes needed (marks N/A)
3. **Quality** (2 min):
   - All tests pass
   - Lint checks pass

**Result**:
- ✅ Bug fixed with tests
- ✅ Ready for PR
- 📊 Minimal documentation overhead

### Comparison with `/os-large`

| Aspect | `/os-small` | `/os-large` |
|--------|-------------|-------------|
| Specification phase | ❌ No | ✅ Yes |
| Infrastructure assessment | ❌ No | ✅ Yes |
| Code review phase | ❌ No | ✅ Yes |
| Parallel agents | 2 | 3 |
| Documentation | Minimal | Comprehensive |
| Best for | Simple tickets | Complex tickets |

## Large One-Shot (`/os-large`)

### Purpose
Complete, autonomous implementation of complex JIRA tickets with full specification, parallel implementation, and automated code review.

### When to Use
✅ **Perfect for**:
- Multi-page features
- Complex user journeys
- Database schema changes
- Features spanning multiple components
- Infrastructure changes required
- Features requiring detailed planning

❌ **Not suitable for**:
- Quick fixes (use `/os-small`)
- Tickets requiring stakeholder clarification mid-implementation
- Experimental features where approach is uncertain

### What It Does

#### Phase 1: Setup
```
1. Retrieves JIRA ticket
2. Stashes changes, checks out master, pulls latest
3. Creates feature branch: feature/<ticket-id>-<name>
4. Creates docs structure: docs/tickets/<ticket-id>/
5. Documents ticket details
```

#### Phase 2: Specification Development
Creates comprehensive technical specification using **2 specialized agents**:

**Full-Stack Engineer Agent**:
Creates `specification.md` with:
- High-level technical approach
- File structure and routing (libs/ convention)
- Error handling strategy
- RESTful API endpoints (if needed)
- Database schema (if needed)
- Flags ambiguities

**Infrastructure Engineer Agent**:
Reviews specification and adds infrastructure section if needed:
- Database changes
- Environment variables
- Helm chart updates
- Docker/Kubernetes configuration
- CI/CD pipeline changes

**Then creates task breakdown** (`tasks.md`) with role assignments:
- Implementation tasks (full-stack-engineer)
- Testing tasks (test-engineer)
- Infrastructure tasks (infrastructure-engineer)
- Review tasks (code-reviewer)

#### Phase 3: Parallel Implementation
Launches **3 agents** simultaneously:

**Full-Stack Engineer Agent**:
- Reads specification and tasks
- Implements ALL engineering tasks
- Writes co-located unit tests
- Ensures >80% coverage
- Updates `tasks.md` progressively (changes `[ ]` to `[x]`)

**Test Engineer Agent**:
- Creates E2E tests for happy path (Playwright)
- Includes accessibility tests (axe-core)
- Updates `tasks.md` as test suites complete
- Does NOT run tests yet

**Infrastructure Engineer Agent**:
- Implements infrastructure changes if specified
- Updates Helm, Docker, CI/CD configs
- Marks as N/A if not needed
- Updates `tasks.md`

All three agents work concurrently for maximum efficiency.

#### Phase 4: Testing and Quality
Sequential test execution with auto-healing:
```bash
yarn lint              # Code style checks
yarn dev               # Application boots (10s check)
yarn test              # Unit tests
yarn test:e2e          # E2E tests
```

**Auto-healing logic**:
- If E2E tests fail → test-engineer agent fixes
- If unit tests or lint fails → full-stack-engineer agent fixes
- Re-runs tests until all pass

#### Phase 5: Code Review
**Code Reviewer Agent** performs comprehensive review:

**Convention Adherence** (`CLAUDE.md`):
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
- Coverage >80% on business logic
- Test meaningfulness
- Edge case coverage

**Output**: `review.md` with:
- Blocking issues (must fix before completion)
- Non-blocking suggestions (improvements)

**Auto-fixing**: If blocking issues found, appropriate agents fix them and review re-runs.

#### Final Verification
- Validates all tasks in `tasks.md` completed
- Confirms all tests passing
- Ensures no blocking review issues remain
- Generates completion report

### Output Artifacts
```
docs/tickets/<ticket-id>/
├── ticket.md           # JIRA ticket details
├── specification.md    # Technical specification with infrastructure section
├── tasks.md           # Role-assigned task checklist with [x] progress
└── review.md          # Code review report with findings
```

### Example Usage

#### Scenario: Implement multi-page user profile feature
```bash
/os-large FEAT-123
```

**Execution** (~35 minutes):

**Phase 1: Setup** (2 min)
- Retrieves JIRA ticket FEAT-123
- Creates branch `feature/FEAT-123-user-profile-management`
- Creates docs structure

**Phase 2: Specification** (5 min)
- Full-stack engineer creates specification:
  - Profile view page (`/profile`)
  - Profile edit page (`/profile/edit`)
  - API endpoints: `GET /api/profile`, `PUT /api/profile`
  - Validation rules for profile fields
  - Database: Add `profile_image_url` to users table
- Infrastructure engineer adds:
  - Database migration needed
  - Environment variable for image upload service
  - No Helm changes required

**Phase 3: Parallel Implementation** (20 min)
- **Engineer** (parallel):
  - Creates `libs/profile/routes.ts`
  - Creates `libs/profile/validation.ts`
  - Creates `libs/profile/api-client.ts`
  - Creates profile pages in appropriate app
  - Writes 15 unit tests (87% coverage)
  - Updates `tasks.md`: All implementation tasks marked `[x]`

- **Test Engineer** (parallel):
  - Creates `e2e-tests/profile-management.spec.ts`
  - Tests: View profile, Edit profile, Save changes
  - Includes accessibility checks
  - Updates `tasks.md`: E2E tasks marked `[x]`

- **Infrastructure** (parallel):
  - Creates database migration script
  - Documents new environment variable
  - Updates `tasks.md`: Infrastructure tasks marked `[x]`

**Phase 4: Quality** (5 min)
- Lint: ✅ Pass
- Dev boots: ✅ Pass
- Unit tests: ✅ 47/47 pass
- E2E tests: ❌ 1 failure (profile image upload)
  - Test engineer fixes E2E test
  - Re-run: ✅ 8/8 pass

**Phase 5: Review** (3 min)
- Code reviewer analyzes `git diff master`
- Finds 1 blocking issue: Missing Welsh translations
- Full-stack engineer adds Welsh translations
- Review updated: ✅ No blocking issues
- Non-blocking: Suggests adding loading spinner (noted for future)

**Result**:
```
Implementation of FEAT-123 complete:
- ✅ Specification created
- ✅ All engineering tasks implemented
- ✅ All tests written and passing (47 unit, 8 E2E)
- ✅ Infrastructure updated (migration + env var)
- ✅ Code review completed with no blocking issues

Documentation: docs/tickets/FEAT-123/
Branch: feature/FEAT-123-user-profile-management

Ready for PR creation or manual review.
```

## Choosing Between Workflows

### Decision Tree

```
Is the ticket simple (single component, no DB changes)?
├─ Yes → Use /os-small
└─ No → Is detailed specification important?
         ├─ Yes → Need to review spec before implementation?
         │        ├─ Yes → Use /wf-plan, review, then /wf-implement
         │        └─ No → Use /os-large
         └─ No → Use /os-small or /wf-plan + /wf-implement
```

### Workflow Comparison Matrix

| Criteria | `/os-small` | `/os-large` | `/wf-plan` + `/wf-implement` + `/wf-review` |
|----------|-------------|-------------|---------------------------------------------|
| **Autonomy** | Full | Full | Manual checkpoints |
| **Control** | Low | Low | High |
| **Speed** | Fastest | Fast | Slower |
| **Specification** | None | Auto-generated | Review before implementation |
| **Code Review** | None | Automated | Automated (separate phase) |
| **Best for** | Simple tickets | Complex tickets | Mission-critical features |
| **Human checkpoints** | 0 | 0 | 3 (after plan, implement, review) |
| **Documentation** | Minimal | Comprehensive | Comprehensive |
| **Risk tolerance** | Low risk only | Medium risk | Any risk level |

### Practical Examples

#### Example 1: Fix typo in error message
**Best choice**: `/os-small BUG-456`
- **Why**: Single file change, trivial fix
- **Time**: ~5 minutes
- **Output**: Fixed code + tests

#### Example 2: Add email notification feature
**Best choice**: `/os-large FEAT-789`
- **Why**: Multiple components, email service integration, testing needed
- **Time**: ~30 minutes
- **Output**: Specification, implementation, tests, review

#### Example 3: Implement payment processing
**Best choice**: `/wf-plan PAY-101` → review spec → `/wf-implement PAY-101` → `/wf-review PAY-101`
- **Why**: High-risk feature, needs specification review before implementation
- **Time**: ~60 minutes + review time
- **Output**: Reviewed specification, implementation, comprehensive review

#### Example 4: Update button color
**Best choice**: `/os-small UI-222`
- **Why**: Simple UI change, low complexity
- **Time**: ~5 minutes
- **Output**: Updated CSS + visual regression tests

#### Example 5: Refactor authentication module
**Best choice**: `/wf-plan AUTH-333` → review spec → `/wf-implement AUTH-333` → `/wf-review AUTH-333`
- **Why**: Security-critical, complex, affects multiple areas
- **Time**: ~90 minutes + review time
- **Output**: Detailed refactoring plan, incremental implementation, security review

## Key Features

### 🚀 Full Automation
One-shot workflows run end-to-end without human intervention:
- No manual phase transitions
- Auto-healing test failures
- Self-documenting progress

### ⚡ Parallel Execution
Multiple agents work simultaneously:
- `/os-small`: 2 agents (engineer + tester)
- `/os-large`: 3 agents (engineer + tester + infrastructure)
- Dramatically reduces execution time

### 🔄 Auto-Healing
Intelligent failure recovery:
- Tests fail → Appropriate agent fixes → Re-runs
- Review finds blocking issues → Agent fixes → Re-reviews
- Continues until all quality gates pass

### 📊 Progress Tracking
Real-time visibility via `tasks.md`:
- Each agent updates `tasks.md` as work completes
- Track progress with `[x]` checkboxes
- Final report shows completion statistics

### 🎯 Focused Scope
Agents stay on task:
- Only address ticket-specific work
- Explicitly avoid cross-cutting concerns
- Flag issues for separate tickets

## Best Practices

### Pre-Execution Checklist
Before running one-shot commands:
- ✅ Ensure JIRA ticket has clear acceptance criteria
- ✅ Verify ticket is appropriately sized for workflow
- ✅ Confirm no open questions requiring stakeholder input
- ✅ Check working directory is clean (or stash changes)
- ✅ Ensure on correct base branch (usually master)

### During Execution
While one-shot runs autonomously, you can:
- Monitor progress: `cat docs/tickets/<ticket-id>/tasks.md`
- Review output logs as agents complete
- Interrupt if needed (Ctrl+C), work persists

### Post-Execution Review
After completion:
1. Review generated documentation in `docs/tickets/<ticket-id>/`
2. Check specification (if `/os-large`)
3. Review test coverage and quality
4. Read code review findings
5. Manually test in browser if UI changes
6. Create PR with documentation

### When to Intervene

**Let it run**:
- Test failures (auto-heals)
- Minor code review issues (auto-fixes)
- Task tracking updates

**Consider stopping**:
- Specification seems fundamentally wrong
- Agent repeatedly failing same test
- Scope creep detected (solving unrelated problems)

### Customization Tips

#### Adjust Coverage Thresholds
In command files, modify coverage requirements:
```markdown
6. Ensure >80% test coverage
```
Change to:
```markdown
6. Ensure >90% test coverage
```

#### Add Custom Quality Gates
In Phase 4 (Testing), add additional checks:
```markdown
EXECUTE IN SEQUENCE:
1. yarn lint
2. yarn dev
3. yarn test
4. yarn test:e2e
5. yarn build              # ADD: Production build
6. yarn security:audit     # ADD: Security scanning
```

#### Modify Agent Behavior
Customize agent prompts for project-specific needs:
```markdown
PROMPT FOR AGENT:
"Implement tasks for $ARGUMENT following these standards:
1. Use React hooks (not class components)
2. Implement Redux for global state
3. Follow atomic design principles
4. Use styled-components for styling
..."
```

#### Change Documentation Structure
Modify where documentation is stored:
```markdown
mkdir -p docs/tickets/$ARGUMENT
```
Change to:
```markdown
mkdir -p documentation/features/$ARGUMENT
```

## Troubleshooting

### "JIRA ticket not found"
**Cause**: Ticket ID doesn't exist or MCP JIRA not configured
**Solution**:
- Verify ticket exists in JIRA
- Check MCP JIRA configuration in `.claude/mcp.json`
- Test with: `mcp__jira__jira_get_issue` directly

### "Git branch creation failed"
**Cause**: Uncommitted changes or branch already exists
**Solution**:
- Stash or commit current changes
- Delete existing branch: `git branch -D feature/<ticket-id>-<name>`
- Re-run command

### Tests repeatedly failing
**Cause**: Fundamental implementation issue or insufficient context
**Solution**:
- Review test failures in output
- Check if scope is too large for automated fix
- Consider manual intervention or switching to waterfall workflow

### Specification seems incorrect (`/os-large`)
**Cause**: JIRA ticket unclear or agent misunderstood requirements
**Solution**:
- Interrupt execution (Ctrl+C)
- Review generated `specification.md`
- Switch to `/wf-plan` to manually review spec before implementation

### Agent making unrelated changes
**Cause**: Ticket description too broad or agent confused
**Solution**:
- Review JIRA ticket for scope creep
- Ensure ticket has focused acceptance criteria
- May need to split into multiple tickets

### Missing Welsh translations (common failure)
**Cause**: Agent forgot to include translations
**Solution**: Auto-healing should catch this in review phase and fix
**If not**: Review phase may need stronger prompting for Welsh content

## Advanced Usage

### Chaining Multiple Tickets
For related tickets, execute sequentially:
```bash
/os-small BUG-123  # Fix validation
# Wait for completion
/os-large FEAT-456 # Build on fix
```

Agents can see changes from previous ticket in codebase.

### Partial Execution Recovery
If interrupted mid-execution:
1. Check current branch: `git branch --show-current`
2. Review `docs/tickets/<ticket-id>/tasks.md` to see progress
3. Manually complete remaining tasks OR
4. Stash changes and re-run command

### Integration with PR Workflows
After one-shot completion:
```bash
# Review changes
git diff master

# Create PR with documentation
gh pr create --title "FEAT-123: User profile management" \
             --body "$(cat docs/tickets/FEAT-123/specification.md)"
```

### Monitoring Long-Running Executions
For complex `/os-large` executions:
```bash
# Terminal 1: Run command
/os-large FEAT-999

# Terminal 2: Monitor progress
watch -n 5 'cat docs/tickets/FEAT-999/tasks.md'
```

## Comparing with Waterfall Workflow

### Waterfall Workflow (`/wf-*`)
**Structure**: Three separate commands with manual checkpoints
```bash
/wf-plan TICKET-123      # Generate specification → REVIEW
/wf-implement TICKET-123 # Build implementation → REVIEW
/wf-review TICKET-123    # Quality assurance → REVIEW
```

**Advantages**:
- Full control at each phase
- Review specification before committing to implementation
- Adjust approach mid-workflow
- Better for high-stakes features

**Use when**:
- Feature is mission-critical
- Requirements need validation
- Specification needs stakeholder review
- Learning new codebase (see spec first)

### One-Shot Workflows (`/os-*`)
**Structure**: Single command, full autonomy
```bash
/os-large TICKET-123     # Everything automatically
```

**Advantages**:
- Maximum speed (no waiting between phases)
- No context switching
- Fully autonomous
- Better for experienced teams

**Use when**:
- Requirements are clear
- Trust autonomous execution
- Speed is priority
- Ticket is well-defined

### Hybrid Approach
You can mix workflows:
```bash
# Review spec first
/wf-plan COMPLEX-789
# Review generated specification.md
# If good, switch to one-shot for speed
/os-large COMPLEX-789  # Uses existing specification
```

## Architecture Notes

### Why Two One-Shot Variants?

**`/os-small`** optimizes for speed:
- Skips specification phase (interprets ticket directly)
- Only 2 agents (no infrastructure agent)
- No formal code review phase
- Minimal documentation

**`/os-large`** optimizes for quality:
- Full specification phase with infrastructure assessment
- 3 parallel agents (including infrastructure)
- Automated code review phase
- Comprehensive documentation

This split reflects the **effort vs. quality tradeoff**:
- Simple tickets don't justify specification overhead
- Complex tickets benefit from structured planning

### Auto-Healing Design
The auto-healing mechanism provides resilience:
```
Test fails → Identify failure type → Route to specialist agent → Fix → Re-test → Repeat until pass
```

This ensures workflows don't get stuck on transient issues (e.g., typos in tests).

### Parallel Agent Safety
Agents work on **different files/areas** simultaneously:
- Engineer: Source code (`libs/`, `apps/`)
- Test Engineer: Test files (`e2e-tests/`, `*.test.ts`)
- Infrastructure: Config files (`helm/`, `.env`, CI/CD)

This **spatial separation** prevents merge conflicts during parallel execution.

## Performance Metrics

### Typical Execution Times

| Workflow | Simple Ticket | Medium Ticket | Complex Ticket |
|----------|---------------|---------------|----------------|
| `/os-small` | 5-8 min | 10-15 min | N/A (too large) |
| `/os-large` | N/A (overkill) | 20-30 min | 40-60 min |
| Waterfall (manual) | 15-25 min | 45-60 min | 90-120 min |

**Time savings**: One-shot workflows can be **2-3x faster** than manual waterfall due to parallel execution and no context switching.

### Resource Usage
- **CPU**: High during parallel agent execution
- **Memory**: Moderate (3 agent contexts simultaneously)
- **Disk**: Minimal (documentation files only)

## Related Documentation

- [Waterfall Workflow](./waterfall-workflow.md) - Three-phase manual workflow
- `CLAUDE.md` - Project-specific coding conventions
- Agent definitions - Individual agent capabilities
- `.claude/` - Command implementations

## Quick Reference

| Command | Use Case | Phases | Agents | Time | Output |
|---------|----------|--------|--------|------|--------|
| `/os-small` | Simple tickets | Setup → Implement → Test | 2 | 5-15 min | Minimal docs |
| `/os-large` | Complex tickets | Setup → Spec → Implement → Test → Review | 3 | 20-60 min | Full docs |
| `/wf-plan` | Planning only | Setup → Spec | 2 | 10-15 min | Specification |
| `/wf-implement` | Implementation | Implement → Test | 3 | 20-40 min | Code + tests |
| `/wf-review` | Review only | Review → Test | 1 | 5-15 min | Review report |

---

**Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: ExpressJS Monorepo Team
