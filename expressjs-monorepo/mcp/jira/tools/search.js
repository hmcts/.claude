/**
 * Tool: jira_search
 * Search JIRA issues using JQL
 */

const DEFAULT_FIELDS = ['summary', 'status', 'assignee', 'created'];

export async function search(jiraClient, args) {
  const {
    jql,
    fields = DEFAULT_FIELDS,
    maxResults = 50,
    startAt = 0
  } = args;

  if (!jql) {
    throw new Error('jql query is required');
  }

  try {
    const result = await jiraClient.searchIssues(jql, {
      fields,
      maxResults: Math.min(maxResults, 100),
      startAt
    });

    // Format the response
    return {
      success: true,
      total: result.total,
      startAt: result.startAt,
      maxResults: result.maxResults,
      issues: result.issues.map(issue => ({
        key: issue.key,
        id: issue.id,
        self: issue.self,
        fields: formatSearchFields(issue.fields)
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      jql
    };
  }
}

/**
 * Format fields for search results
 * Similar to get-issue but more compact
 */
function formatSearchFields(fields) {
  if (!fields) return {};

  const formatted = {};

  // Summary
  if (fields.summary) {
    formatted.summary = fields.summary;
  }

  // Status
  if (fields.status) {
    formatted.status = {
      name: fields.status.name,
      category: fields.status.statusCategory?.name
    };
  }

  // Assignee
  if (fields.assignee) {
    formatted.assignee = {
      displayName: fields.assignee.displayName,
      accountId: fields.assignee.accountId
    };
  } else {
    formatted.assignee = null;
  }

  // Reporter
  if (fields.reporter) {
    formatted.reporter = {
      displayName: fields.reporter.displayName,
      accountId: fields.reporter.accountId
    };
  }

  // Issue type
  if (fields.issuetype) {
    formatted.issueType = {
      name: fields.issuetype.name,
      subtask: fields.issuetype.subtask || false
    };
  }

  // Priority
  if (fields.priority) {
    formatted.priority = fields.priority.name;
  }

  // Project
  if (fields.project) {
    formatted.project = {
      key: fields.project.key,
      name: fields.project.name
    };
  }

  // Dates
  if (fields.created) formatted.created = fields.created;
  if (fields.updated) formatted.updated = fields.updated;
  if (fields.duedate) formatted.duedate = fields.duedate;

  // Labels
  if (fields.labels && fields.labels.length > 0) {
    formatted.labels = fields.labels;
  }

  // Description (if requested, but keep it short)
  if (fields.description) {
    const desc = extractTextFromADF(fields.description);
    formatted.description = desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
  }

  // Include any other requested fields
  for (const [key, value] of Object.entries(fields)) {
    if (!formatted[key] && value !== null && value !== undefined) {
      // Don't include complex nested objects
      if (typeof value !== 'object' || Array.isArray(value)) {
        formatted[key] = value;
      }
    }
  }

  return formatted;
}

/**
 * Extract plain text from Atlassian Document Format (ADF)
 */
function extractTextFromADF(adf) {
  if (!adf) return '';

  if (typeof adf === 'string') return adf;

  if (adf.type === 'doc' && adf.content) {
    return extractContentText(adf.content);
  }

  return JSON.stringify(adf);
}

function extractContentText(content) {
  if (!Array.isArray(content)) return '';

  return content.map(node => {
    if (node.type === 'text') {
      return node.text;
    }
    if (node.content) {
      return extractContentText(node.content);
    }
    return '';
  }).join(' ');
}
