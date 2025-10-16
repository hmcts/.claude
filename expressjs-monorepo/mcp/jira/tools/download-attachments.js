/**
 * Tool: jira_download_attachments
 * Download all attachments from a JIRA issue
 */

import fs from 'node:fs';
import path from 'node:path';

export async function downloadAttachments(jiraClient, args) {
  const { issue_key, target_dir } = args;

  if (!issue_key) {
    throw new Error('issue_key is required');
  }

  if (!target_dir) {
    throw new Error('target_dir is required');
  }

  try {
    // Get attachments for the issue
    const attachments = await jiraClient.getAttachments(issue_key);

    if (!attachments || attachments.length === 0) {
      return {
        success: true,
        message: `No attachments found for issue ${issue_key}`,
        issue_key,
        total: 0,
        downloaded: [],
        failed: []
      };
    }

    // Create target directory if it doesn't exist
    const absoluteTargetDir = path.resolve(target_dir);
    if (!fs.existsSync(absoluteTargetDir)) {
      fs.mkdirSync(absoluteTargetDir, { recursive: true });
    }

    // Download each attachment
    const downloaded = [];
    const failed = [];

    for (const attachment of attachments) {
      try {
        const filename = sanitizeFilename(attachment.filename);
        const filepath = path.join(absoluteTargetDir, filename);

        // Download the attachment
        const buffer = await jiraClient.downloadAttachment(attachment.content);

        // Write to file
        fs.writeFileSync(filepath, buffer);

        downloaded.push({
          id: attachment.id,
          filename: attachment.filename,
          savedAs: filename,
          path: filepath,
          size: attachment.size,
          mimeType: attachment.mimeType
        });
      } catch (error) {
        failed.push({
          filename: attachment.filename,
          error: error.message
        });
      }
    }

    return {
      success: true,
      issue_key,
      target_dir: absoluteTargetDir,
      total: attachments.length,
      downloaded,
      failed
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      issue_key,
      target_dir
    };
  }
}

/**
 * Sanitize filename to prevent directory traversal and invalid characters
 */
function sanitizeFilename(filename) {
  // Remove path components
  const basename = path.basename(filename);

  // Replace invalid characters
  const sanitized = basename.replace(/[<>:"|?*\x00-\x1f]/g, '_');

  // Ensure it's not empty
  return sanitized || 'attachment';
}
