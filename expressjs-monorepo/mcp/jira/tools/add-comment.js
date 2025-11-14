/**
 * Tool: jira_add_comment
 * Add a comment to a JIRA issue
 */

export async function addComment(jiraClient, args) {
  const {
    issueKey,
    body
  } = args;

  if (!issueKey) {
    throw new Error('issueKey is required');
  }

  if (!body) {
    throw new Error('comment body is required');
  }

  try {
    // Call JIRA REST API to add comment
    const result = await jiraClient.request(
      'POST',
      `/issue/${issueKey}/comment`,
      {
        body
      }
    );

    return {
      success: true,
      commentId: result.id,
      issueKey,
      self: result.self,
      created: result.created,
      author: {
        displayName: result.author.displayName,
        accountId: result.author.accountId
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      issueKey
    };
  }
}
