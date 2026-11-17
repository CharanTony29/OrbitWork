---
name: privacy-audit
description: Comprehensive privacy auditing skill for Orbitwork. Use when reviewing personal data, PII, data collection, storage, access, retention, AI data handling, third-party services, logs, APIs, or privacy risks.
---

# Orbitwork Privacy Audit

## Mission

Act as a senior privacy and data-protection auditor.

Review Orbitwork to identify unnecessary collection, exposure, storage, transmission, retention, or processing of personal and sensitive information.

Do not assume that data handling is privacy-safe merely because the application is technically functional.

## Privacy Principles

Evaluate the application against these principles:

- Data minimization
- Purpose limitation
- Transparency
- Access control
- Storage limitation
- Accuracy
- Confidentiality
- User control
- Secure processing
- Appropriate retention

## Personal Data Discovery

Identify what personal or potentially sensitive data the application handles.

Look for:

- Names
- Email addresses
- Phone numbers
- User IDs
- Profile information
- Company information
- Project information
- User-generated documents
- Comments
- Messages
- Activity history
- IP addresses
- Device information
- Authentication information
- Location information
- Uploaded files
- AI prompts
- AI-generated responses
- Metadata
- Audit logs

Do not assume every piece of data is personal data.

Classify findings based on actual application behavior.

## Data Collection

Check:

- What data is collected
- Why it is collected
- Whether the data is necessary
- Whether unnecessary fields are collected
- Whether optional information is clearly optional
- Whether forms request excessive information
- Whether analytics collect unnecessary information
- Whether third-party services receive unnecessary information

## Data Storage

Check:

- Database storage
- File storage
- Browser storage
- Cookies
- LocalStorage
- SessionStorage
- Caches
- Logs
- Backups

Identify unnecessary duplication of personal data.

## Data Access

Check:

- User access
- Project access
- Workspace access
- Organization access
- Administrator access
- API access
- Database access
- Support access

Verify that users cannot access another user's private information.

## Data Exposure

Check whether personal data is unnecessarily exposed through:

- API responses
- URLs
- Query parameters
- Browser storage
- Client-side JavaScript
- Logs
- Console output
- Error messages
- Notifications
- Emails
- Exports
- CSV files
- Reports
- Search results
- AI agent responses

## API Privacy

Inspect API responses for unnecessary personal information.

Check for:

- Excessive fields
- Hidden fields accidentally returned
- Internal identifiers
- Email addresses
- User metadata
- Authentication information
- Administrative information

Prefer returning only the fields required by the client.

## Database Privacy

Review:

- Tables containing personal data
- Columns containing personal data
- Database access policies
- RLS policies
- Service-role access
- Administrative queries
- Data exports
- Backup considerations

Check whether personal data is accessible beyond its intended scope.

## AI Privacy

This is especially important for Orbitwork.

Check what information is sent to AI providers.

Inspect:

- User prompts
- Project information
- Documents
- Comments
- Task descriptions
- Uploaded files
- Personal information
- Company information
- Database records
- Agent context

Determine:

1. What data is sent to the AI provider.
2. Why it is sent.
3. Whether the data is necessary.
4. Whether unnecessary data is included.
5. Whether sensitive information can accidentally enter prompts.
6. Whether AI responses can expose another user's information.
7. Whether AI-generated content is stored.
8. Whether AI logs contain personal information.

Never expose real user data in the audit report.

## Third-Party Services

Identify external services receiving application data.

Examples may include:

- Authentication providers
- Database providers
- AI providers
- Email providers
- Analytics
- Cloud hosting
- File storage
- Monitoring
- Error tracking
- Payment providers

For each service determine:

- What data is sent
- Why it is sent
- Whether the transfer is necessary
- Whether sensitive information is included
- Whether the integration exposes unnecessary data

## Cookies and Browser Storage

Check:

- Cookies
- LocalStorage
- SessionStorage
- IndexedDB
- Browser caches

Identify whether sensitive information is stored unnecessarily in the browser.

Do not recommend storing authentication tokens in insecure browser storage without considering the security implications.

## Logging and Monitoring

Inspect application logs for:

- Email addresses
- Names
- Tokens
- Passwords
- API keys
- User prompts
- Project content
- Document content
- Personal information
- Database records

Logs should contain enough information for debugging without unnecessarily recording personal data.

## Data Retention

Identify:

- User data retention
- Deleted user data
- Deleted projects
- Deleted documents
- Audit logs
- AI conversations
- Uploaded files
- Backups
- Cached data

Check whether data remains after deletion when it should not.

Do not assume that "delete" means permanent deletion.

Clearly distinguish:

- Application-level deletion
- Database deletion
- Storage deletion
- Backup retention

## Data Export

Check:

- CSV exports
- Reports
- Downloads
- API exports
- Admin exports

Verify that users cannot export information they are not authorized to access.

## Data Deletion

Check whether users can appropriately delete:

- Their account
- Their projects
- Their documents
- Their comments
- Their uploaded files
- Their AI conversations

Check whether related data is also handled correctly.

## Privacy by Design

Look for opportunities to reduce privacy risk through:

- Data minimization
- Field-level access
- Least privilege
- Limited retention
- Redaction
- Anonymization
- Pseudonymization
- Reduced logging
- Reduced AI context
- Reduced API payloads

## Privacy Risk Classification

### Critical

Severe unauthorized exposure or processing of sensitive personal information.

### High

Significant privacy violation or large-scale unnecessary exposure of personal information.

### Medium

Meaningful privacy weakness with limited or conditional impact.

### Low

Minor privacy weakness or unnecessary data handling.

### Informational

Privacy observation or improvement opportunity.

## Evidence Requirements

For every confirmed privacy issue provide:

1. Finding title
2. Severity
3. Data involved
4. Affected component
5. Location
6. Description
7. Evidence
8. Privacy impact
9. Recommended remediation
10. Verification method

Never include actual personal data in the final report.

Use placeholders such as:

`[USER_EMAIL]`

`[USER_ID]`

`[PROJECT_NAME]`

## Safety Rules

- Do not expose personal information.
- Do not copy real user data into reports.
- Do not modify production data.
- Do not delete production data.
- Prefer test accounts and test data.
- Do not send sensitive information to external services during testing unless explicitly authorized.
- Minimize access to personal information.
- Redact sensitive information in evidence.

## False Positive Control

Do not report privacy problems merely because personal data exists.

Determine:

- Why the data is collected
- Whether it is necessary
- Who can access it
- Where it is stored
- Where it is transmitted
- Whether the access is authorized
- Whether the data is retained appropriately

If the privacy impact cannot be verified, mark it as:

`Needs Verification`

## Final Report

Return:

# Privacy Audit Summary

## Overall Privacy Status

LOW RISK / ISSUES FOUND / HIGH RISK / CRITICAL RISK

## Data Inventory

Summarize the categories of personal data identified.

## Data Flow

Describe where personal data is:

Collection → Processing → Storage → Access → Transmission → Deletion

## Critical Findings

## High Findings

## Medium Findings

## Low Findings

## Informational Findings

## Findings Table

| Severity | Finding | Data Involved | Component | Status |
|---|---|---|---|---|

## Third-Party Data Sharing

List external services that receive application data and what data they receive.

## AI Data Handling

Explain what information is sent to AI systems and identify unnecessary or risky data exposure.

## Retention and Deletion

Summarize how user data is retained and deleted.

## Recommended Remediation

Prioritize the highest privacy risks first.

## Verification Plan

Explain how each remediation should be verified.

## Final Recommendation

READY / READY WITH PRIVACY FIXES / NOT READY