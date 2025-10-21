/**
 * Tool: jira_get_issue
 * Get details of a specific JIRA issue
 */

const DEFAULT_FIELDS = [
  'summary',
  'status',
  'description',
  'assignee',
  'created',
  'updated',
  'issuetype',      // Needed for analytics: Story/Bug/Task
  'priority',       // Needed for analytics: High/Medium/Low
  'project',        // Needed for analytics: project key
  'customfield_10004',  // HMCTS story points
  'customfield_10016',  // Common Jira Cloud story points
];

// Fields that analytics always needs
const ANALYTICS_REQUIRED_FIELDS = [
  'issuetype',
  'priority',
  'project',
  'customfield_10004',  // HMCTS story points
  'customfield_10016',  // Common Jira Cloud story points
];

export async function getIssue(jiraClient, args) {
  let { issue_key, fields = DEFAULT_FIELDS, expand = '' } = args;

  // Always merge in analytics-required fields
  if (fields && Array.isArray(fields)) {
    const fieldsSet = new Set([...fields, ...ANALYTICS_REQUIRED_FIELDS]);
    fields = Array.from(fieldsSet);
  }

  if (!issue_key) {
    throw new Error('issue_key is required');
  }

  try {
    const issue = await jiraClient.getIssue(issue_key, {
      fields,
      expand
    });

    // Format the response
    return {
      success: true,
      issue: {
        key: issue.key,
        id: issue.id,
        self: issue.self,
        fields: formatFields(issue.fields),
        ...(issue.renderedFields && { renderedFields: issue.renderedFields }),
        ...(issue.changelog && { changelog: issue.changelog })
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      issue_key
    };
  }
}

/**
 * Format fields for better readability
 */
function formatFields(fields) {
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
      id: fields.status.id,
      ...(fields.status.statusCategory && {
        category: fields.status.statusCategory.name
      })
    };
  }

  // Description
  if (fields.description) {
    formatted.description = extractTextFromADF(fields.description);
  }

  // Assignee
  if (fields.assignee) {
    formatted.assignee = {
      displayName: fields.assignee.displayName,
      emailAddress: fields.assignee.emailAddress,
      accountId: fields.assignee.accountId
    };
  } else {
    formatted.assignee = null;
  }

  // Reporter
  if (fields.reporter) {
    formatted.reporter = {
      displayName: fields.reporter.displayName,
      emailAddress: fields.reporter.emailAddress,
      accountId: fields.reporter.accountId
    };
  }

  // Issue type
  if (fields.issuetype) {
    formatted.issueType = {
      name: fields.issuetype.name,
      id: fields.issuetype.id,
      subtask: fields.issuetype.subtask || false
    };
  }

  // Priority
  if (fields.priority) {
    formatted.priority = {
      name: fields.priority.name,
      id: fields.priority.id
    };
  }

  // Project
  if (fields.project) {
    formatted.project = {
      key: fields.project.key,
      name: fields.project.name,
      id: fields.project.id
    };
  }

  // Dates
  if (fields.created) formatted.created = fields.created;
  if (fields.updated) formatted.updated = fields.updated;
  if (fields.duedate) formatted.duedate = fields.duedate;

  // Labels
  if (fields.labels) {
    formatted.labels = fields.labels;
  }

  // Components
  if (fields.components) {
    formatted.components = fields.components.map(c => ({
      name: c.name,
      id: c.id
    }));
  }

  // Attachments
  if (fields.attachment) {
    formatted.attachments = fields.attachment.map(a => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      mimeType: a.mimeType,
      created: a.created,
      content: a.content
    }));
  }

  // Comments
  if (fields.comment && fields.comment.comments) {
    formatted.comments = fields.comment.comments.map(c => ({
      id: c.id,
      author: c.author.displayName,
      body: extractTextFromADF(c.body),
      created: c.created,
      updated: c.updated
    }));
  }

  // Include any other fields that were requested
  for (const [key, value] of Object.entries(fields)) {
    if (!formatted[key] && value !== null && value !== undefined) {
      formatted[key] = value;
    }
  }

  return formatted;
}

/**
 * Extract plain text from Atlassian Document Format (ADF)
 * ADF is a JSON structure used by JIRA Cloud for rich text
 */
function extractTextFromADF(adf) {
  if (!adf) return '';

  // If it's already a string, return it
  if (typeof adf === 'string') return adf;

  // If it's ADF JSON
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
  }).join('\n');
}
