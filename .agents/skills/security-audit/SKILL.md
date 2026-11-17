---
name: security-audit
description: Comprehensive security auditing skill for Orbitwork. Use when auditing application security, authentication, authorization, APIs, databases, RLS, secrets, vulnerabilities, access control, or OWASP risks.
---

# Orbitwork Security Audit

## Mission

Act as a senior application security engineer.

Perform a comprehensive security assessment of the Orbitwork application.

Do not assume that code is secure simply because it works.

Verify security controls through actual code inspection and testing where possible.

## Authentication

Check:

- Login and logout
- Session management
- Session expiration
- Password reset
- Authentication bypass
- Account enumeration
- Unauthorized access
- Session/token handling
- Authentication state management

## Authorization

Check:

- Role permissions
- Resource ownership
- Horizontal privilege escalation
- Vertical privilege escalation
- Admin-only functionality
- API authorization
- Server-side authorization
- Client-side-only security controls
- Project/workspace access
- User-to-user data isolation

Never consider hiding a frontend button to be sufficient authorization.

## API Security

Check:

- Missing authentication
- Missing authorization
- Input validation
- Parameter tampering
- Excessive data exposure
- Mass assignment
- Improper error responses
- Rate limiting
- CORS configuration
- HTTP method restrictions
- Sensitive information in responses
- Unauthorized API access

## Database Security

Check:

- Row Level Security
- Missing RLS policies
- Overly permissive RLS policies
- Unauthorized database access
- Service-role key exposure
- Unsafe queries
- SQL injection
- Sensitive data exposure
- Excessive data retrieval
- Incorrect user/project data isolation

## Secrets

Search for:

- API keys
- Database credentials
- Service-role keys
- JWT secrets
- Authentication secrets
- Tokens
- Passwords
- Private keys
- Hard-coded credentials

Check:

- `.env` files
- Source code
- Git history when appropriate
- Client-side bundles
- Logs
- Console output
- Error messages
- Configuration files

Never print actual secrets in the final report.

Redact sensitive values.

## Injection

Check for:

- SQL injection
- Command injection
- XSS
- HTML injection
- Template injection
- Path traversal
- Unsafe URL handling
- Unsafe file processing

## XSS

Check:

- `dangerouslySetInnerHTML`
- Unsanitized HTML
- User-controlled URLs
- Rich text rendering
- Markdown rendering
- Stored XSS
- Reflected XSS
- DOM-based XSS

## File Upload Security

Check:

- File type validation
- File size limits
- Filename handling
- Path traversal
- Executable file uploads
- Malicious file content
- Storage permissions
- Public/private storage configuration
- Unauthorized file access

## Dependency Security

Inspect:

- `package.json`
- `package-lock.json`
- npm dependencies
- Outdated packages
- Known vulnerabilities

Use available package auditing tools when appropriate.

## Sensitive Information Exposure

Check whether sensitive information appears in:

- API responses
- Browser storage
- URLs
- Logs
- Console output
- Error messages
- Client-side JavaScript
- HTML
- Database responses

## Security Headers

Check appropriate use of:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy

Do not recommend headers blindly. Check application compatibility first.

## Deployment Security

Check:

- Production environment variables
- Debug mode
- Development endpoints
- Test endpoints
- Admin endpoints
- Public source maps
- CORS
- Cloudflare configuration
- API exposure
- Database connection security

## OWASP Top 10

Use OWASP Top 10 as the baseline security framework.

At minimum evaluate:

1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable and Outdated Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Mishandling of Exceptional Conditions

## Severity

### Critical

Severe compromise, authentication bypass, major data exposure, remote code execution, or equivalent impact.

### High

Significant exploitable vulnerability with meaningful security impact.

### Medium

Security weakness with limited or conditional exploitability.

### Low

Minor security weakness or hardening recommendation.

### Informational

Security observation that is not a confirmed vulnerability.

## Evidence Requirements

For every confirmed vulnerability provide:

1. Finding title
2. Severity
3. Affected component
4. Location
5. Description
6. Attack scenario
7. Evidence
8. Impact
9. Recommended remediation
10. Verification method

Never expose:

- Passwords
- API keys
- Tokens
- Private keys
- Database credentials
- Session cookies
- Personal user data

Redact sensitive values.

## False Positive Control

Do not report a vulnerability simply because a potentially dangerous function exists.

Verify:

- Whether user-controlled input can reach it
- Whether authentication is required
- Whether authorization is enforced
- Whether sanitization exists
- Whether the vulnerable path is reachable
- Whether the issue is exploitable

If verification is impossible, classify it as:

`Needs Verification`

Do not present theoretical risks as confirmed vulnerabilities.

## Safety Rules

- Prefer read-only inspection.
- Do not attack external systems.
- Do not perform destructive actions.
- Do not delete production data.
- Do not modify production configuration.
- Do not disable security controls.
- Do not create persistent backdoors.
- Do not expose discovered secrets.
- Use test environments for active security testing whenever possible.
- Clearly distinguish confirmed vulnerabilities from theoretical risks.

## Final Report

Return the following structure:

# Security Audit Summary

## Overall Security Status

SECURE / ISSUES FOUND / HIGH RISK / CRITICAL RISK

## Executive Summary

Summarize the overall security posture.

## Critical Findings

List confirmed critical vulnerabilities.

## High Findings

List confirmed high vulnerabilities.

## Medium Findings

List confirmed medium vulnerabilities.

## Low Findings

List confirmed low vulnerabilities.

## Informational Findings

List observations and hardening recommendations.

## Findings Table

| Severity | Finding | Component | Status |
|---|---|---|---|

## Positive Security Controls

List important security controls that are correctly implemented.

## Recommended Remediation

Prioritize:

1. Critical
2. High
3. Medium
4. Low

## Verification Plan

Explain how each remediation should be verified.

## Final Recommendation

READY / READY WITH SECURITY FIXES / NOT READY