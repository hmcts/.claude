/**
 * JIRA REST API Client
 * Zero-dependency implementation using only Node.js built-in https module
 */

import https from 'node:https';
import { URL } from 'node:url';

export class JiraClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;

    // Always use Bearer token authentication
    this.authHeader = `Bearer ${token}`;
  }

  /**
   * Make an HTTP request to JIRA API
   */
  async request(method, path, body = null, extraHeaders = {}) {
    const url = new URL(`${this.baseUrl}/rest/api/2${path}`);

    const options = {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // Handle different status codes
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed);
            } catch (error) {
              reject(new Error(`Failed to parse JSON response: ${error.message}`));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Authentication failed. Check your JIRA_PERSONAL_TOKEN credential.'));
          } else if (res.statusCode === 403) {
            reject(new Error('Forbidden. Your credentials do not have permission to access this resource.'));
          } else if (res.statusCode === 404) {
            reject(new Error(`Resource not found: ${path}`));
          } else {
            reject(new Error(`JIRA API error (${res.statusCode}): ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      // Send body if present
      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Download binary data from a URL
   */
  async downloadBinary(url) {
    const parsedUrl = new URL(url);

    const options = {
      method: 'GET',
      headers: {
        'Authorization': this.authHeader
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(parsedUrl, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Get a JIRA issue by key
   */
  async getIssue(issueKey, options = {}) {
    const { fields = [], expand = '' } = options;

    // Build query parameters
    const params = new URLSearchParams();
    if (fields.length > 0) {
      params.append('fields', fields.join(','));
    }
    if (expand) {
      params.append('expand', expand);
    }

    const queryString = params.toString();
    const path = `/issue/${issueKey}${queryString ? `?${queryString}` : ''}`;

    return await this.request('GET', path);
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(jql, options = {}) {
    const {
      fields = [],
      maxResults = 50,
      startAt = 0
    } = options;

    const body = {
      jql,
      maxResults: Math.min(maxResults, 100), // Cap at 100
      startAt,
      fields: fields.length > 0 ? fields : undefined
    };

    return await this.request('POST', '/search', body);
  }

  /**
   * Get attachments for an issue
   */
  async getAttachments(issueKey) {
    const issue = await this.getIssue(issueKey, {
      fields: ['attachment']
    });

    return issue.fields?.attachment || [];
  }

  /**
   * Download an attachment
   */
  async downloadAttachment(attachmentUrl) {
    return await this.downloadBinary(attachmentUrl);
  }
}
