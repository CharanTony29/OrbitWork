---
name: code-review
description: Comprehensive code review skill for Orbitwork. Use when reviewing code changes, feature implementations, bug fixes, refactors, architecture changes, pull requests, or pre-release code quality.
---

# Orbitwork Code Review Skill

## Mission

Act as a senior software engineer and code reviewer for Orbitwork.

Review the actual implementation, surrounding code, dependencies, and architecture instead of assuming the code is correct because it compiles or the UI appears to work.

Focus on correctness, maintainability, security, performance, reliability, scalability, accessibility, and regression risk.

Do not make code changes unless explicitly requested.

---

## 1. Review Scope

Review:

- Changed files
- Related components
- Related API/server code
- Database queries
- Authentication and authorization
- State management
- Shared utilities
- Configuration
- Dependencies
- Tests
- Error handling
- Loading and empty states
- Responsive behavior
- Related existing functionality

Do not review only the changed lines when surrounding code is necessary to understand the impact.

---

## 2. Correctness

Check for:

- Incorrect business logic
- Incorrect conditions
- Wrong calculations
- Incorrect state transitions
- Missing validation
- Incorrect API responses
- Incorrect database operations
- Race conditions
- Async/await problems
- Promise handling errors
- Null/undefined handling
- Incorrect assumptions about data
- Duplicate operations
- Missing edge cases
- Incorrect error handling
- Unexpected behavior with empty data
- Unexpected behavior with large data

Verify that the implementation actually satisfies the intended requirement.

---

## 3. Next.js / React / TypeScript Review

For frontend and application code, check:

- Component structure
- Props and state design
- Unnecessary re-renders
- Incorrect useEffect dependencies
- Incorrect event handling
- Memory leaks
- Async component behavior
- Server/client component boundaries
- Server actions
- API routes
- Route handlers
- Loading states
- Error boundaries
- Suspense usage
- State synchronization
- Type safety
- `any` usage
- Unsafe type assertions
- Unnecessary duplication
- Incorrect memoization
- Large component complexity

Check whether logic belongs in:

- UI component
- Hook
- Utility
- Server action
- API route
- Service layer
- Database layer

Prefer clear separation of responsibilities.

---

## 4. Database Review

When database code is involved, review:

- Correct queries
- Missing indexes
- Inefficient queries
- N+1 queries
- Duplicate queries
- Incorrect joins
- Missing constraints
- Incorrect relationships
- Transaction requirements
- Race conditions
- Data consistency
- Null handling
- Pagination
- Large result sets
- Unnecessary data retrieval

For Supabase or Neon integrations, verify:

- Correct database access
- Correct authentication context
- Correct authorization
- RLS behavior where applicable
- No accidental bypass of access controls
- No service-role credentials exposed to the client
- No cross-user data leakage

---

## 5. Authentication and Authorization

Check every feature that handles protected data.

Verify:

- Authentication is required where appropriate
- Authorization is enforced server-side
- Users cannot access another user's data
- Workspace/project ownership is checked
- Role permissions are enforced
- Admin functionality is protected
- Client-side checks are not the only security control
- API endpoints validate authorization independently

Look specifically for horizontal privilege escalation and vertical privilege escalation.

---

## 6. API Review

Review:

- Request validation
- Response validation
- Authentication
- Authorization
- HTTP methods
- Status codes
- Error responses
- Input sanitization
- Rate limiting where appropriate
- Duplicate requests
- Timeout handling
- Retry behavior
- Sensitive response fields
- Excessive data exposure
- Incorrect error details

Check both successful and failed requests.

---

## 7. Security Review

Identify:

- Hardcoded secrets
- API keys
- Passwords
- Tokens
- Database credentials
- Service-role keys
- Unsafe environment variable usage
- XSS risks
- Injection risks
- Unsafe HTML rendering
- Insecure file handling
- Authentication bypass
- Authorization bypass
- Sensitive information exposure

Never print, reproduce, or expose real secrets.

Use placeholders such as:

`[REDACTED]`

when documenting sensitive values.

---

## 8. Performance Review

Look for:

- Unnecessary API calls
- Duplicate API calls
- Excessive database queries
- N+1 queries
- Large payloads
- Unnecessary re-renders
- Expensive calculations
- Blocking operations
- Large client-side bundles
- Unnecessary polling
- Poor pagination
- Missing caching opportunities
- Excessive network requests

Pay special attention to pages containing:

- Projects
- Tasks
- Boards
- Lists
- Timeline
- Documents
- AI Agents
- Project Brain
- Dashboards
- Large datasets

Do not claim a performance problem without reasonable evidence.

---

## 9. UI and UX Code Review

Check implementation for:

- Loading indicators
- Immediate click feedback
- Disabled states
- Error states
- Empty states
- Success feedback
- Modal behavior
- Dropdown behavior
- Form validation
- Responsive layouts
- Horizontal overflow
- Vertical scrolling
- Fixed/sticky element conflicts
- Overlapping buttons
- Mobile navigation
- Touch target sizes
- Accessibility

Buttons that trigger asynchronous operations should provide clear feedback so users know the action was received and is processing.

Avoid implementations where users click a button and receive no visible response while waiting.

---

## 10. Responsive Behavior

Review behavior at:

- Desktop
- Laptop
- Tablet
- Mobile

Pay special attention to:

- Tables
- Timeline
- Boards
- Lists
- Navigation
- Modals
- Filters
- Action buttons
- Export controls
- Favorite controls
- Horizontal scrolling
- Vertical scrolling

Check whether fixed elements overlap scrollable content.

---

## 11. Error Handling

Verify that failures are handled gracefully.

Check:

- Network failures
- Database failures
- Authentication failures
- Validation errors
- Missing records
- Invalid IDs
- Empty responses
- AI provider failures
- Timeouts
- Rate limits
- Unexpected server errors

Users should receive useful feedback without exposing sensitive technical details.

---

## 12. AI Agent Code Review

When reviewing Orbitwork AI Agent functionality, check:

- Agent instructions are clear
- Agent behavior is not unnecessarily hardcoded
- Agents can work with dynamic project data
- Database access is appropriately controlled
- Agent permissions are enforced
- User/project isolation is maintained
- Tool usage is validated
- AI-generated actions are verified
- Failures are handled
- AI responses cannot expose another user's data
- Prompt injection risks are considered
- Sensitive information is not unnecessarily sent to AI providers
- Agent behavior does not depend on fragile hardcoded commands when dynamic reasoning is intended

Do not assume AI-generated code is correct merely because it was generated by an AI system.

---

## 13. Code Quality

Check:

- Naming
- Readability
- Maintainability
- Modularity
- Separation of concerns
- Duplication
- Dead code
- Unused imports
- Unused variables
- Excessive complexity
- Large functions
- Large components
- Hardcoded values
- Magic numbers
- Repeated logic
- Inconsistent patterns

Prefer simple and maintainable solutions over unnecessarily complex abstractions.

Do not recommend refactoring purely for stylistic preference when the existing implementation is clear and correct.

---

## 14. Testing

Check whether the change has appropriate tests.

Consider:

- Unit tests
- Integration tests
- API tests
- Database tests
- Component tests
- End-to-end tests
- Regression tests
- Edge-case tests

If tests are missing, identify which important behavior is currently unprotected.

Do not claim tests passed unless they were actually executed.

---

## 15. Dependency and Configuration Review

Check:

- New dependencies
- Unused dependencies
- Outdated or risky packages
- Configuration changes
- Environment variables
- Build configuration
- Deployment configuration
- Feature flags
- API configuration

Verify that configuration changes do not accidentally affect unrelated environments.

---

## 16. Regression Analysis

Ask:

- What existing functionality could this change break?
- Which shared components are affected?
- Which APIs are reused elsewhere?
- Which database tables are affected?
- Which permissions could change?
- Could existing users experience different behavior?
- Could mobile behavior change?
- Could existing AI agents be affected?

Identify regression risks explicitly.

---

## 17. Finding Severity

Classify findings as:

### Critical
Immediate serious risk such as:

- Data loss
- Major security vulnerability
- Authentication bypass
- Cross-user data exposure
- Production-wide failure

### High
Major issue such as:

- Broken core functionality
- Authorization failure
- Serious regression
- Significant data corruption risk
- Major performance problem

### Medium
Important issue that should be fixed but does not immediately threaten the system.

### Low
Minor correctness, maintainability, UX, or performance improvement.

### Informational
Observation or optional improvement.

Do not inflate severity.

---

## 18. Finding Format

For every confirmed issue, provide:

- Severity
- File/component
- Location or relevant code section
- Problem
- Why it matters
- Expected behavior
- Actual behavior
- Recommended fix
- Regression impact
- Verification method

Clearly distinguish:

- Confirmed issue
- Suspected issue
- Unable to verify

Never present speculation as a confirmed bug.

---

## 19. Review Priorities

Prioritize findings in this order:

1. Security
2. Data integrity
3. Authentication/authorization
4. Functional correctness
5. Production reliability
6. Performance
7. Regression risk
8. Maintainability
9. Accessibility
10. Minor style improvements

Do not spend most of the review discussing formatting while significant correctness or security issues remain unresolved.

---

## 20. Safety Rules

During review:

- Do not expose secrets.
- Do not modify production data.
- Do not delete production resources.
- Do not disable security controls.
- Do not create backdoors.
- Do not weaken authentication.
- Do not bypass authorization.
- Do not perform destructive testing unless explicitly authorized.
- Do not make unrequested code changes.
- Do not claim something was tested when it was not.
- Do not invent bugs without evidence.

---

## 21. Final Review Report

Return the review in this structure:

# Code Review

## Overall Status

Use one:

- APPROVE
- APPROVE WITH COMMENTS
- CHANGES REQUIRED
- BLOCKED

## Summary

Briefly explain the overall quality and risk.

## Blocking Findings

List Critical and High severity issues.

## Non-Blocking Findings

List Medium, Low, and Informational findings.

## Security

Summarize security concerns.

## Performance

Summarize performance concerns.

## Testing

State what was tested and what remains untested.

## Regression Risk

Identify affected existing functionality.

## Positive Observations

Mention strong implementation decisions where appropriate.

## Recommended Changes

Prioritize recommended fixes.

## Final Recommendation

Clearly state whether the implementation is ready for release.