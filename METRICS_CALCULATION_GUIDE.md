# Metrics Calculation Guide

Quick reference for understanding how each metric is calculated.

---

## 📊 NK/T Metrics (Gene Kim's Options Value Framework)

### N - Number of Independent Modules
**What:** Independent modules/files that can be worked on simultaneously without conflicts

**Date Filter:** Uses PR `created_at` (only counts merged PRs)

```
N = Total Files - Overlapping Files
```

**Example:** 100 files changed, 15 appear in multiple PRs → **N = 85**

---

### K - Number of Parallel Experiments
**What:** Number of parallel experiments that can run (concurrent developers)

**Date Filter:** Uses PR `created_at` to determine active days

```
K = Average(developers active per day)
```

**Example:** Week has 3, 4, 2, 3, 4, 2, 3 devs active → **K = 3.0**

**Excludes:** Bots, dependabot, infrastructure setup work

---

### T - Time to Complete One Experiment Cycle
**What:** Time from "In Progress" to "Ready for Test" (one full development cycle)

**Date Filter:** Uses PR `created_at` to filter PRs in the analysis period (only counts merged PRs)

**Method 1 (JIRA):** Sum all time spent in "In Progress" status
```
T = Total "In Progress" time / 24 hours
```

**Method 2 (GitHub fallback):** PR created → merged
```
T = (merged_at - created_at) / 24 hours
```

**⚠️ Note:** This fallback method **DOES include QA time** because it measures the entire PR lifecycle from creation to merge. This differs from Method 1 which excludes QA time.

**When is fallback used?**
- PRs without a ticket ID in the title/body
- PRs where JIRA ticket data is unavailable or incomplete
- PRs where ticket was never moved to "In Progress" status

In most projects with good JIRA hygiene, this affects only a small percentage of PRs.

**Example:** 30 hours in progress + 7 hours rework → **T = 1.54 days**

**Important Notes:**
- **Filter:** Only merged PRs are included (ensures completed work)
- **Measurement:** Uses JIRA status transitions, NOT PR merge time
- **QA Time:** Excluded - measurement stops at "Ready for Test", before PR merge
- **Timeline Example:**
  ```
  Day 1: Ticket → "In Progress"         (Dev starts)
  Day 3: Ticket → "Ready for Test"      (Dev ends) ← T measures up to here (2 days)
  Day 5: PR merged                      (QA ends) ← Filter checks here, but doesn't measure this time
  ```
- Even though only merged PRs are measured, T captures **development time only** (In Progress periods), excluding the QA/review time that happens after "Ready for Test"

---

### NK/T - Option Value
**What:** Capacity for experimentation and innovation in a given amount of time

```
NK/T = (N × K) / T
```

**Example:** (85 × 3.0) / 1.54 → **NK/T = 165.6**

**Interpretation:** The bigger the option value, the more experimentation and innovation the system can perform. Higher NK/T = more independent experiments completed faster

---

## 📈 Story Points

**Date Filter:** Uses PR `created_at` (extracts ticket IDs from PRs, then fetches story points)

**Counted when:** PR is created (and eventually merged)

**Why align with PRs?** Ensures story points correspond exactly to the same PRs used for all other metrics (LOC, quality, costs). This gives accurate Cost/SP and LOC/SP ratios.

**Method:**
```
For each merged PR created in the week:
  1. Extract ticket ID from PR title/body (e.g., "CATH-123")
  2. Fetch ticket's story points from JIRA
  3. Sum all story points

Result: Story points from PRs created this week
```

**Example:** Week 3 has 6 PRs → Extract tickets → Total 20 SP from those 6 PRs

---

## 🤖 Token Metrics

### Tokens per Story Point (Weekly Aggregate)
```
Tokens/SP = Total Tokens Used / Story Points Completed
```

**Example:** 189,577 tokens ÷ 28 SP → **6,771 tokens/SP**

**Method:** Uses weekly totals from sessions.csv and costs.csv matched to PR creation dates

---

### Tokens per Story Point Size (Per-Ticket Analysis)

**What:** Shows token usage patterns by story point size (e.g., "1 SP tickets use X tokens, 8 SP tickets use Y tokens")

**Date Filter:** Uses analytics CSVs to attribute tokens to specific tickets

**Method:**
```
For each merged PR:
  1. Extract ticket ID from PR title/body
  2. Match PR branch to sessions.csv branch field
  3. Sum tokens from costs.csv for matching sessions
  4. Get story points from JIRA for that ticket
  5. Group by SP size and calculate averages
```

**Example Output:**
```
1 SP tickets: 3,500 tokens/ticket (10 tickets)
3 SP tickets: 9,800 tokens/ticket (5 tickets)
8 SP tickets: 28,000 tokens/ticket (3 tickets)
```

**Why branch matching?** Direct attribution - only counts Claude sessions actually worked on that specific PR branch

**Script:** `tokens_per_story_point_size.js`

---

### LOC per Token
```
LOC/Token = Total Lines Changed / Total Tokens
```

**Example:** 18,090 lines ÷ 189,577 tokens → **0.0954 lines/token**

Higher = More efficient code generation

---

### Tokens per Cycle Time
```
Tokens/Day = (Total Tokens / PRs) / Avg Cycle Time
```

**Example:** (189,577 ÷ 12) ÷ 0.84 days → **18,807 tokens/day**

Shows AI "burn rate" per day of development

---

## ⏱️ Time to Context Window

**What:** Minutes from session start to first context compaction

```
Time to CW = (First Compaction Timestamp - Session Start) / 60000
```

**Example:** Session 10:00am, first compaction 10:02:27am → **2.45 minutes**

**Auto vs Manual:**
- **Auto:** Automatic when threshold reached
- **Manual:** User-triggered cleanup

---

## 💰 Cost Metrics

**Date Filter:** Uses PR `created_at` for PR-based cost metrics (only counts merged PRs)

**Source:** `bedrock-costs.csv` (AWS Bedrock billing)

### Cost per Story Point
```
Cost/SP = Total Week Cost / Story Points Completed
```

**Example:** $375.90 ÷ 28 SP → **$13.42/SP**

---

### Cost per LOC
```
Cost/LOC = Total Week Cost / Lines Changed
```

**Example:** $375.90 ÷ 18,090 → **$0.0208/line**

---

### Cost per PR
```
Cost/PR = Total Week Cost / Feature PRs
```

**Example:** $375.90 ÷ 12 PRs → **$31.32/PR**

---

## ✅ Quality Metrics

**Date Filter:** Uses PR `created_at` (only counts merged PRs)

**Source:** SonarCloud API (per PR, then averaged)

| Metric | Calculation | Scale |
|--------|-------------|-------|
| **Test Coverage** | % of code covered by tests | 0-100% |
| **CVEs** | Count of vulnerabilities | Lower is better |
| **Code Smells** | Count of maintainability issues | Lower is better |
| **Maintainability** | Technical debt ratio | A (best) to E (worst) |
| **Reliability** | Bug risk rating | A (best) to E (worst) |
| **Security** | Security risk rating | A (best) to E (worst) |
| **Duplicated Lines** | % of duplicated code | 0-100% (target <3%) |

**Rating Scale:**
- **A (1.0):** ≤5% debt ratio
- **B (2.0):** 6-10%
- **C (3.0):** 11-20%
- **D (4.0):** 21-50%
- **E (5.0):** >50%

---

## 👥 Developer Productivity

**Date Filter:** Uses PR `created_at` (only counts merged PRs)

### LOC per Developer
```
LOC/Dev = Total Lines Changed / Active Developers
```

**Example:** 18,090 lines ÷ 3 devs → **6,030 LOC/dev**

---

### LOC per PR
```
LOC/PR = (Additions + Deletions) / Feature PRs
```

**Example:** 18,090 lines ÷ 12 PRs → **1,508 LOC/PR**

---

## 💬 Code Review

**Date Filter:** Uses PR `created_at` (only counts merged PRs)

### Comments per PR
```
Comments/PR = (Review Comments + Reviews + Issue Comments) / PRs
```

**What counts:**
- ✅ Line-specific review comments
- ✅ Review submissions (approve/request changes)
- ✅ General PR discussion
- ❌ Bot comments

**Example:** 25 comments ÷ 12 PRs → **2.08 comments/PR**

---

## 🗂️ Data Sources Summary

| Metric | Data Source | Refresh |
|--------|-------------|---------|
| N, K, T, NK/T | GitHub API | Real-time |
| Story Points | JIRA API | Real-time |
| Token Metrics | `sessions.csv`, `costs.csv` | Weekly merge |
| Time to Context Window | `compactions.csv` | Weekly merge |
| Cost Metrics | `bedrock-costs.csv` | Weekly export |
| Quality Metrics | SonarCloud API | Real-time |
| LOC, Comments | GitHub API | Real-time |

---

## 🔄 Data Deduplication

**Sessions:** Deduplicated by `session_id + started_at`

**Compactions:** Deduplicated by `session_id + timestamp (rounded to 10ms)`

This handles duplicate rows and header lines in CSVs automatically.

---

## 📋 Quick Reference Table

| Metric | Formula | Good Direction |
|--------|---------|----------------|
| NK/T | (N × K) / T | ⬆️ Higher |
| Tokens/SP | Tokens ÷ SP | Depends on complexity |
| LOC/Token | Lines ÷ Tokens | ⬆️ Higher |
| Cost/SP | $ ÷ SP | ⬇️ Lower |
| Test Coverage | % | ⬆️ Higher |
| CVEs | Count | ⬇️ Lower (0 ideal) |
| Code Smells | Count | ⬇️ Lower |
| Cycle Time (T) | Days | ⬇️ Lower |
| Time to CW | Minutes | Depends on task |

---

## 🤖 Multi-Instance Tracking

### Agent ID
**What:** Unique identifier for each Claude Code instance (process)

**Format:** `agent_<process_id>`

**Use Case:** When multiple developers (or the same developer) run multiple Claude Code instances on the same project simultaneously, the agent_id distinguishes between them.

**Tracking:**
- Each CSV now includes an `agent_id` column as the 2nd column
- Uses process PID to ensure uniqueness
- Allows filtering analytics by specific agent instance

**Example:**
```csv
session_id,agent_id,user_id,...
session_123,agent_12345,dev@example.com,...
session_456,agent_67890,dev@example.com,...
```

In this example, the same developer (`dev@example.com`) is running two Claude Code instances simultaneously, tracked as `agent_12345` and `agent_67890`.

### Per-Turn Token Tracking
**What's Captured:** Actual token usage from transcript after EVERY turn (not just at session end)

**Real-Time Branch Attribution:**
- Uses `git branch --show-current` during turn start (NOT transcript's gitBranch)
- Stored in `branchHistory[sessionId][turnNumber]`
- Ensures accurate ticket attribution even when switching branches mid-session

**CSV Schema:**
```
costs.csv: session_id,agent_id,user_id,turn_number,message_id,model,branch,ticket_id,input_tokens,output_tokens,total_tokens,input_cost_usd,output_cost_usd,total_cost_usd,timestamp
prompts.csv: session_id,agent_id,user_id,turn_number,category,subcategory,prompt_length,timestamp
```

**Historical Issue:** Old analytics hook only captured ~5% of tokens because it wasn't writing after every turn or was using unreliable branch data. Now fixed.

---

## 🔄 Workflow: Adding New Weeks

When adding a new week (e.g., Week 7) while preserving hardcoded token data from previous weeks (e.g., Week 6 with manually-analyzed transcript tokens):

### Step 1: Prepare Data
1. Add new week definition to `WEEKS` array in `generate_dashboard_data.js`:
   ```javascript
   { name: 'Week 7', start: '2025-11-17', end: '2025-11-21', period: 'Nov 17-21' }
   ```
2. Merge Week 7 analytics CSVs into `analytics-merged/` folder
3. Add Week 7 transcripts to appropriate folder (if doing manual transcript analysis)
4. Update `bedrock-costs.csv` with Week 7 AWS costs

### Step 2: Generate Dashboard
```bash
node generate_dashboard_data.js
```

This creates timestamped files:
- `collected_metrics_YYYY-MM-DD.json`
- `ticket_token_data_YYYY-MM-DD.json`

The script will automatically update `weekly_metrics_plot.js` with all weeks' data.

### Step 3: Restore Hardcoded Token Values
**Important:** If previous weeks have hardcoded token values from manual transcript analysis (more accurate than CSV-derived values), restore them after generation.

For Week 6 example (1,812,232 tokens from transcript analysis):
1. Open `weekly_metrics_plot.js`
2. Find Week 6 entry in `weeklyData` array
3. Manually restore these values:
   ```javascript
   {
     week: 'Week 6',
     // ... other metrics
     tokensPerSP: 113265,        // 1,812,232 / 16 SP
     tokensPerCycleTime: 148544, // (1,812,232 / 5 PRs) / 2.44 days
     locPerToken: 0.0052,        // 9,390 LOC / 1,812,232 tokens
     // ... other metrics
   }
   ```

### Why This Happens
The script recalculates token metrics from analytics CSVs, which may have incomplete data due to:
- Analytics hook not running on all turns (historical issue)
- CSV only capturing ~5% of actual tokens used
- Missing session data for certain branches

Manual transcript analysis gives accurate token counts by parsing the entire conversation history.

### Best Practice
- **Hardcode token values** for weeks where you've done manual transcript analysis
- **Let script calculate** for new weeks where CSV analytics are complete
- Keep notes in `weekly_metrics_plot.js` comments about which weeks have hardcoded values

---

*Last Updated: 2025-11-23*
