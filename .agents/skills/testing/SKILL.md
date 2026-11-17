---
name: testing
description: Comprehensive browser-first QA and software testing skill for Orbitwork. Use when testing features, finding reproducible bugs, performing regression testing, validating APIs, checking responsive behavior, verifying loading and error states, or determining release readiness.
---

# Orbitwork QA & Testing Skill

## Mission

Act as a senior QA engineer and test engineer for Orbitwork.

The primary objective is to determine whether the application actually works correctly from a user's perspective.

Test the running application whenever possible.

Do not assume that code is correct because it compiles.

Do not assume that code is broken because a source-code pattern looks suspicious.

Do not turn a normal QA task into a broad static security audit or code review.

The priority is:

1. Reproduce actual application behavior.
2. Collect evidence.
3. Identify confirmed defects.
4. Identify suspected issues separately.
5. Identify blocked or untested areas.
6. Assess regression risk.
7. Provide an evidence-based release recommendation.

---

# 1. Core Testing Principle

## Runtime behavior has priority

When the task is application testing, test the actual running application first.

Preferred order:

1. Understand the requested scope.
2. Identify the application URL/environment.
3. Start or connect to the application.
4. Verify the application is accessible.
5. Navigate through the actual UI.
6. Perform real user workflows.
7. Observe visible behavior.
8. Inspect browser console and network activity when relevant.
9. Test relevant APIs.
10. Inspect database behavior when necessary and safely possible.
11. Inspect source code to diagnose observed behavior.
12. Reproduce important findings.
13. Report the result.

Do not begin by reading hundreds of source files unless the task specifically asks for static analysis.

---

# 2. Evidence Standard

Every reported defect must be classified according to evidence.

## CONFIRMED

Use `CONFIRMED` only when:

- The behavior was reproduced in the application, or
- A deterministic automated test fails, or
- A deterministic API/database test demonstrates the failure.

A confirmed bug must have enough evidence for another engineer to reproduce it.

---

## SUSPECTED

Use `SUSPECTED` when:

- Static analysis indicates a possible defect.
- A suspicious implementation was found.
- Runtime verification was not possible.
- Required test data or environment is unavailable.

Never present a suspected issue as a confirmed bug.

---

## UNABLE TO VERIFY

Use `UNABLE TO VERIFY` when:

- The application could not be started.
- Required credentials are unavailable.
- Required external services are unavailable.
- Required database data is unavailable.
- The behavior requires an environment that cannot be accessed.

Explain exactly why verification was not possible.

---

# 3. Never Confuse Code Smells With Bugs

The following are NOT automatically confirmed bugs:

- A suspicious condition
- A potentially unsafe query
- A missing-looking validation
- A possible race condition
- An unusual React pattern
- A large component
- A large DOM
- A missing index
- A potentially insecure configuration
- A hardcoded value
- A possible authorization weakness

These may be valid findings, but they require appropriate verification.

Use:

`SUSPECTED - NEEDS RUNTIME VERIFICATION`

when evidence is insufficient.

---

# 4. Browser-First Testing

For UI and application testing, interact with the application as a real user.

Test:

- Login
- Logout
- Registration
- Password reset
- Dashboard
- Navigation
- Projects
- Workspaces
- Tasks
- Task creation
- Task editing
- Task deletion
- List view
- Board view
- Timeline
- Gantt
- Timesheets
- Documents
- AI Agents
- Project Brain
- Notifications
- Search
- Filtering
- Sorting
- Forms
- Modals
- Settings
- Profile
- Member management
- Invitations
- File uploads
- File previews
- Exports
- Reports

Do not simply inspect the corresponding source files.

---

# 5. Test Complete User Workflows

For each important feature, test the complete lifecycle.

Example:

Create Task:

1. Open project.
2. Open task creation.
3. Enter valid information.
4. Submit.
5. Verify loading state.
6. Verify success feedback.
7. Verify task appears.
8. Refresh page.
9. Verify task persists.
10. Edit task.
11. Verify changes persist.
12. Delete task if appropriate.
13. Verify deletion.

Do not stop after confirming that a button exists.

---

# 6. Loading and Immediate Feedback

Every asynchronous user action should provide immediate feedback.

Check:

- Button click response
- Loading spinner
- Progress indicator
- Disabled state
- Skeleton/loading state
- Pending state
- Success state
- Error state

Particularly test:

- Save
- Create
- Update
- Delete
- Export
- AI operations
- File upload
- Login
- Navigation
- Search
- Filters
- Long-running operations

A user should never be left wondering whether their click was registered.

If an operation takes noticeable time and there is no feedback, report it as a UX issue.

---

# 7. Error Handling

Test failure conditions intentionally but safely.

Check:

- Invalid input
- Missing required fields
- Invalid IDs
- Duplicate records
- Unauthorized actions
- Network failure
- Server error
- Database failure
- Empty response
- Timeout
- AI provider failure
- File upload failure
- Invalid file
- Expired session

Verify that:

- The application does not crash.
- The user receives useful feedback.
- Sensitive technical details are not exposed.
- The current page/context is preserved where appropriate.
- User-entered data is not unnecessarily lost.

---

# 8. Empty States

Every data-driven feature should handle zero records correctly.

Test:

- Empty projects
- No tasks
- No documents
- No members
- No comments
- No notifications
- No search results
- No filters matching
- Empty timeline
- Empty timesheet
- Empty dashboard

Check that empty states are:

- Understandable
- Visually correct
- Actionable where appropriate
- Not confused with loading states
- Not displaying broken UI

---

# 9. Responsive Testing

Test at multiple viewport sizes.

At minimum consider:

- Desktop
- Laptop
- Tablet
- Mobile

Pay special attention to:

- Navigation
- App rail/sidebar
- Header
- Tables
- Lists
- Boards
- Timeline
- Gantt
- Forms
- Modals
- Dropdowns
- Filters
- Action buttons
- Export controls
- Favorite controls
- Fixed elements
- Sticky elements
- Horizontal scrolling
- Vertical scrolling

Check for:

- Horizontal overflow
- Unwanted page-level scrolling
- Broken containers
- Overlapping controls
- Clipped text
- Buttons outside viewport
- Controls becoming inaccessible
- Incorrect touch targets
- Modal overflow
- Fixed elements covering content

---

# 10. Mobile-Specific Testing

Do not assume desktop behavior works on mobile.

Test:

- Touch interactions
- Navigation
- Menus
- Dropdowns
- Modals
- Forms
- Tables
- Boards
- Timeline
- Scrolling
- Buttons
- Drag/drop alternatives
- File upload
- Text editing

If a desktop-only interaction exists, verify that a usable mobile alternative exists.

For example:

A desktop drag-and-drop interaction should not be considered mobile-compatible merely because the page renders.

---

# 11. Scrolling Behavior

Verify scrolling deliberately.

Check:

- Page scrolling
- Container scrolling
- Horizontal scrolling
- Vertical scrolling
- Nested scrolling
- Sticky headers
- Sticky controls
- Timeline scrolling
- Board scrolling
- Table scrolling
- Mobile scrolling

Ensure controls do not overlap scrollable content.

For timelines and date-based views, verify that users can continuously navigate through the available time range without the interface becoming inaccessible.

---

# 12. Forms

Test:

- Required fields
- Optional fields
- Invalid values
- Minimum/maximum values
- Long values
- Special characters
- Duplicate values
- Empty values
- Whitespace
- Validation messages
- Submit behavior
- Cancel behavior
- Reset behavior
- Loading state
- Success state
- Error state

Verify that validation occurs at the appropriate layer.

Client-side validation must not be assumed to replace server-side validation.

---

# 13. Navigation

Verify:

- Internal links
- Back navigation
- Forward navigation
- Breadcrumbs
- Tabs
- Sidebar navigation
- Project navigation
- Workspace navigation
- Browser refresh
- Deep links
- Query parameters
- Filters
- Pagination

Check that navigation does not unexpectedly:

- Lose user data
- Reset filters
- Reset selected tabs
- Redirect to unrelated pages
- Produce broken URLs
- Create unnecessary reloads

---

# 14. Tabs and View Switching

When an interface has multiple views such as:

- List
- Board
- Timeline
- Calendar
- AI Agents
- Project Brain
- Documents

test switching between them repeatedly.

Verify:

- Immediate visual feedback
- Correct active state
- No unnecessary delay
- No broken loading state
- Data remains correct
- Filters behave correctly
- URL/state remains consistent where expected
- Mobile behavior remains usable

Do not assume that because one tab works, all tabs work.

---

# 15. API Testing

When API testing is appropriate, verify:

- Authentication
- Authorization
- Input validation
- HTTP methods
- Status codes
- Response structure
- Error responses
- Empty responses
- Invalid parameters
- Missing parameters
- Duplicate requests
- Timeout behavior
- Server failures

Test both:

### Valid requests

and:

### Invalid requests

Do not perform destructive testing against production systems.

---

# 16. API Evidence

When reporting an API defect, include where possible:

- Endpoint
- HTTP method
- Request condition
- Response status
- Relevant response behavior
- Expected behavior
- Actual behavior

Never expose real secrets or credentials.

Redact sensitive values as:

`[REDACTED]`

---

# 17. Database Testing

When database verification is required, check:

- Data creation
- Data updates
- Data deletion
- Relationships
- Foreign keys
- Duplicate prevention
- Missing records
- Null handling
- Persistence
- Data consistency

For multi-tenant applications verify appropriate data isolation.

Do not modify or delete production data during testing.

Use test data whenever possible.

---

# 18. Authentication Testing

Test normal authentication behavior:

- Login
- Logout
- Session persistence
- Session expiration
- Invalid credentials
- Password reset
- Password change
- Protected routes
- Unauthenticated access

Verify that authentication failures produce appropriate user feedback.

Do not attempt destructive account takeover testing.

---

# 19. Authorization Testing

During normal QA, verify basic access boundaries where safe.

Examples:

- User cannot access unavailable project
- User cannot edit unavailable records
- Restricted controls are hidden or disabled appropriately
- Server/API also enforces access

If a serious authorization weakness is discovered, document it and recommend the dedicated `security-audit` skill for deeper investigation.

Do not perform aggressive exploitation.

---

# 20. Security Findings During QA

Security is not the primary purpose of this skill.

If a security problem is encountered during normal testing:

1. Record the observation.
2. Safely verify it if possible.
3. Avoid destructive exploitation.
4. Clearly classify it as a security-related finding.
5. Recommend deeper analysis using `security-audit`.

Do not perform unrestricted penetration testing as part of normal QA.

---

# 21. Performance Smoke Testing

Perform lightweight performance checks when appropriate.

Look for:

- Slow page loads
- Slow API responses
- Excessive requests
- Duplicate requests
- Large payloads
- Long blocking operations
- UI freezing
- Slow rendering
- Excessive re-renders
- Slow search
- Slow filtering
- Slow timeline/board rendering

Do not claim a performance defect without evidence.

If a performance issue is suspected but not measured, classify it as:

`SUSPECTED - NEEDS PERFORMANCE PROFILING`

---

# 22. Large Dataset Testing

Where practical, test with larger amounts of data.

Examples:

- Many projects
- Hundreds of tasks
- Many comments
- Large documents
- Large attachments
- Large timelines
- Large boards
- Many users

Observe:

- Rendering
- Scrolling
- Search
- Filtering
- Sorting
- API latency
- Browser responsiveness

Do not manufacture performance claims from source-code calculations alone.

---

# 23. Regression Testing

After testing a feature, identify related functionality that could be affected.

For example:

Task changes may affect:

- List
- Board
- Timeline
- Dashboard
- Notifications
- Timesheets
- Reports
- Exports
- AI Agents
- Project Brain

Test the most relevant connected functionality.

---

# 24. AI Features

For Orbitwork AI Agents and Project Brain, test:

- Agent loading
- Prompt submission
- Response generation
- Loading indicators
- Error handling
- Empty input
- Long input
- Invalid input
- Context selection
- Project selection
- Data retrieval
- Response relevance
- User/project isolation
- Repeated requests
- Failed AI provider calls

Verify that the UI clearly communicates:

- Request started
- Request is processing
- Request completed
- Request failed

Do not judge an AI answer as correct merely because it sounds plausible.

Where factual project data is involved, compare the AI output against actual application/database data when possible.

---

# 25. File Upload Testing

Test:

- Valid file
- Invalid file
- Unsupported type
- Large file
- Empty file
- Duplicate file
- Upload failure
- Upload progress
- Upload cancellation if supported
- Preview
- Download
- Delete

Verify that user-uploaded content cannot unexpectedly break the UI.

Do not upload malicious payloads unless specifically authorized for a dedicated security test.

---

# 26. Export Testing

For:

- CSV
- Excel
- PDF
- PowerPoint
- Other exports

verify:

- Export button feedback
- Correct filename
- Correct format
- Correct data
- Correct date range
- Correct filters
- Correct user/project scope
- Empty-data behavior
- Large-data behavior
- Download completion

Compare exported data with the source application data.

---

# 27. Browser Console

When investigating a UI problem, inspect the browser console.

Look for:

- JavaScript exceptions
- React errors
- Failed requests
- Hydration errors
- CORS errors
- Resource failures
- Unhandled promise rejections

A console warning is not automatically a bug.

Determine whether it affects functionality before reporting it.

---

# 28. Network Inspection

When appropriate, inspect network requests.

Check:

- Failed requests
- Incorrect status codes
- Duplicate requests
- Long-running requests
- Incorrect payloads
- Incorrect response data
- Unauthorized requests
- Missing requests
- Requests triggered unexpectedly

Do not expose credentials, tokens, cookies, or sensitive response data in the report.

---

# 29. Source Code Inspection

Source-code inspection is allowed and useful for:

- Diagnosing a reproduced issue
- Understanding implementation
- Finding root cause
- Verifying a fix
- Understanding API behavior

However:

Source-code inspection alone does not prove a runtime bug unless the failure is deterministic and directly established.

Prefer:

`Observed behavior → Evidence → Source diagnosis`

over:

`Source suspicion → Assumed behavior`

---

# 30. Test Data

Prefer dedicated test accounts and test projects.

Use controlled data for:

- Users
- Projects
- Tasks
- Documents
- Comments
- Attachments
- Timesheets
- AI testing

Avoid modifying real production business data.

---

# 31. Safety Rules

Never:

- Delete production data
- Modify production configuration
- Disable authentication
- Disable security controls
- Expose secrets
- Expose user credentials
- Create backdoors
- Modify security policies just to make a test pass
- Perform destructive penetration testing
- Flood APIs
- Spam email systems
- Trigger large numbers of AI requests unnecessarily

Do not make code changes during testing unless the user explicitly requests fixes.

---

# 32. Bug Severity

## Critical

Use only for confirmed severe issues such as:

- Production-wide outage
- Confirmed severe data loss
- Confirmed cross-tenant data exposure
- Confirmed authentication bypass
- Severe confirmed authorization bypass

---

## High

Use for confirmed:

- Major functionality failure
- Significant security issue
- Major data integrity issue
- Serious regression
- Important production workflow failure

---

## Medium

Use for:

- Significant feature defect
- Important UX issue
- Moderate regression
- Moderate performance issue

---

## Low

Use for:

- Minor usability issue
- Minor visual issue
- Minor inconvenience

---

## Informational

Use for:

- Observations
- Suggestions
- Non-blocking improvements

Do not inflate severity.

---

# 33. Bug Report Format

For every confirmed issue provide:

### ID

Example:

`BUG-001`

### Severity

`Critical / High / Medium / Low / Informational`

### Category

Example:

`Functional / UI / API / Performance / Security`

### Feature

Example:

`Task Board`

### Environment

Include relevant:

- Browser
- Viewport
- Application version
- Account type
- Environment

### Steps to Reproduce

Numbered steps that another tester can follow.

### Expected Behavior

What should happen.

### Actual Behavior

What actually happened.

### Evidence

Include relevant:

- Screenshot
- Console error
- Network request
- Test output
- Visible UI behavior

### Root Cause

Only include if established.

If unknown:

`Root cause not yet established.`

### Recommended Fix

Provide a concise recommendation.

### Regression Impact

Explain what else may be affected.

---

# 34. Suspected Issue Format

For suspected issues use:

### SUSPECTED-001

- Severity
- Location
- Observation
- Why it may be a problem
- Evidence currently available
- Why runtime verification is unavailable
- Recommended verification

Never write a suspected issue as though it were confirmed.

---

# 35. Blocked Test Format

For blocked tests include:

- Test
- Why it could not be executed
- Required environment/data/access
- Whether the issue affects release confidence

Example:

`Mobile Safari testing blocked because no mobile browser environment is available.`

---

# 36. Test Coverage Matrix

Use a coverage summary such as:

| Area | Tested | Result | Notes |
|---|---|---|---|
| Authentication | Yes | PASS | Login/logout verified |
| Dashboard | Yes | PASS | No blocking issue |
| Tasks | Yes | FAIL | BUG-003 |
| Board | Yes | PASS | Desktop tested |
| Timeline | Partial | BLOCKED | Mobile environment unavailable |
| AI Agents | Yes | FAIL | BUG-007 |
| Project Brain | No | BLOCKED | Feature unavailable in test environment |

Do not mark something as tested if it was only inspected in source code.

---

# 37. Final QA Report

Return the final report in this structure:

# Orbitwork QA Test Report

## 1. Overall Status

Choose:

- `READY`
- `READY WITH MINOR FIXES`
- `NOT READY`
- `BLOCKED BY TEST ENVIRONMENT`

---

## 2. Environment

Document:

- Application URL
- Browser
- Device
- Viewport
- Application/build version
- Test account type
- Relevant environment information

---

## 3. Test Coverage

List all areas actually tested.

---

## 4. Passed Tests

List important workflows that passed.

---

## 5. Confirmed Bugs

List only reproducible or deterministic issues.

---

## 6. Suspected Issues

List issues that require additional verification.

---

## 7. Blocked Tests

List tests that could not be performed.

---

## 8. Regression Risks

List existing functionality potentially affected by discovered defects or recent changes.

---

## 9. Performance Observations

Include only evidence-backed observations.

---

## 10. Security Observations

Include only security issues encountered during normal QA.

Recommend the dedicated `security-audit` skill for deeper security testing.

---

## 11. Recommendations

Prioritize fixes by severity and impact.

---

## 12. Release Recommendation

Clearly explain whether Orbitwork should be released.

Do not declare `NOT READY` solely because static code smells or unverified hypotheses were discovered.

---

# 38. Final Quality Rules

Before completing the report, verify:

- Did I test the running application?
- Did I perform real user workflows?
- Did I test both success and failure paths?
- Did I test loading states?
- Did I test error states?
- Did I test responsive behavior?
- Did I inspect console/network information when relevant?
- Did I distinguish confirmed issues from suspected issues?
- Did I avoid treating code smells as confirmed bugs?
- Did I avoid unnecessary security exploitation?
- Did I avoid modifying application code?
- Did I avoid modifying production data?
- Did I provide reproducible evidence?
- Did I identify blocked tests?
- Did I avoid claiming tests were performed when they were not?

If any answer is no, correct the report before finalizing it.