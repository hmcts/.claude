---
description: Fetch JIRA ticket and start working on it
argument-hint: <JIRA-KEY>
allowed-tools:
  - mcp__jira__*
  - Bash
  - Read
  - Write
  - TodoWrite
---

# Quick Start: $ARGUMENT

## Initialize Progress Tracking
Use TodoWrite to create this checklist:
```
- [ ] Create docs folder structure
- [ ] Fetch JIRA ticket details and download attachments (parallel)
```

## PHASE 1: Setup Documentation Folder
*Mark "Create docs folder structure" as in_progress*

### Step 1.1: Create Folder Structure
```
EXECUTE:
1. Create directory: docs/tickets/$ARGUMENT

```
*Mark "Create docs folder structure" as completed*

## PHASE 2: Fetch JIRA Data
*Mark "Fetch JIRA ticket details and download attachments (parallel)" as in_progress*

### Step 2.1: Parallel Data Retrieval

```
EXECUTE IN PARALLEL:

TASK 1: Fetch JIRA Ticket Details
- Use mcp__jira__jira_get_issue with issue_key=$ARGUMENT
- Extract: summary, description, status, assignee, reporter, labels, created, updated
- Write to docs/tickets/$ARGUMENT/ticket.md with format:

---
# $ARGUMENT: [Summary]

**Status:** [Status]
**Assignee:** [Assignee]
**Reporter:** [Reporter]
**Labels:** [Labels]
**Created:** [Created Date]
**Updated:** [Updated Date]

## Description

[Description content - properly formatted from ADF if applicable]
---

TASK 2: Download Attachments
- Use mcp__jira__jira_download_attachments with:
  - issue_key=$ARGUMENT
  - output_dir=docs/tickets/$ARGUMENT
- Save all attachments directly to docs/tickets/$ARGUMENT/

WAIT FOR BOTH TASKS TO COMPLETE
```
*Mark "Fetch JIRA ticket details and download attachments (parallel)" as completed*

## Output to User

Display the following message:

```
JIRA ticket $ARGUMENT has been retrieved and saved to: docs/tickets/$ARGUMENT/

## Ticket Summary

[Display the ticket summary including:
- Title
- Status
- Description (first 3-4 lines or key points)
- Number of attachments downloaded]

---

Would you like to create a technical specification for this ticket?

Run: /qk-plan $ARGUMENT
```
