---
name: testing
description: UI-first visual QA and application testing skill for Orbitwork. Use when inspecting pages, finding visual defects, checking responsive layouts, testing user interactions, validating loading states, identifying broken UI, and reporting page-level UX problems.
---

# Orbitwork UI-First QA Testing Skill

## Mission

Act as a senior UI/UX QA engineer for Orbitwork.

The primary purpose of this skill is to inspect the actual application visually and identify pages and components that look broken, inconsistent, unfinished, confusing, poorly aligned, non-responsive, or difficult to use.

The application should be evaluated from the perspective of a real user.

The most important question is:

> "Does this page look and behave like a polished, professional production application?"

Do not focus primarily on source-code quality.

Do not perform a broad code audit.

Do not turn every suspicious code pattern into a bug.

---

# 1. Testing Priority

Always prioritize testing in this order:

1. Visual appearance
2. Layout and spacing
3. Responsive behavior
4. Navigation and page structure
5. Interactive elements
6. Loading and feedback states
7. Forms and validation
8. Functional behavior
9. API behavior when relevant
10. Source-code inspection only when necessary to diagnose a problem

The visual quality of the application is the primary objective.

---

# 2. Browser-First Requirement

Whenever possible, use the running Orbitwork application.

Do not start by reading large amounts of source code.

Preferred workflow:

1. Open the application.
2. Navigate through the application.
3. Inspect each page visually.
4. Interact with the page.
5. Resize the viewport.
6. Check mobile behavior.
7. Test buttons, tabs, forms, menus and controls.
8. Observe loading and error states.
9. Record visual/UX defects.
10. Only inspect source code when necessary to understand the cause.

---

# 3. Page-by-Page Visual Inspection

Inspect every accessible major page.

Examples include:

- Login
- Signup
- Dashboard
- Projects
- Project overview
- Task list
- Task board
- Timeline
- Gantt
- Timesheets
- Documents
- AI Agents
- Project Brain
- Settings
- Profile
- Members
- Notifications
- Search
- Reports
- Exports
- Invitations
- Other accessible application pages

Do not assume that because one page looks good, the rest of the application is consistent.

---

# 4. Visual Quality Checklist

For every page inspect:

## Layout

Check:

- Overall page structure
- Alignment
- Spacing
- Padding
- Margins
- Section positioning
- Content width
- Sidebar width
- Header height
- Card dimensions
- Grid alignment
- Column alignment

Look for:

- Elements too close together
- Excessive empty space
- Uneven spacing
- Misaligned components
- Inconsistent widths
- Broken containers
- Content extending outside containers

---

# 5. Typography

Check:

- Font consistency
- Font sizes
- Font weights
- Heading hierarchy
- Line height
- Text alignment
- Text wrapping
- Text truncation
- Long titles
- Long descriptions

Look for:

- Text being cut off
- Text overlapping
- Inconsistent heading sizes
- Poor contrast
- Tiny text
- Excessively large text
- Unnecessary uppercase text
- Broken line wrapping

---

# 6. Colors and Visual Consistency

Check consistency of:

- Backgrounds
- Cards
- Borders
- Buttons
- Primary actions
- Secondary actions
- Status colors
- Text colors
- Icons
- Hover states
- Active states
- Disabled states

The application should feel visually consistent across pages.

Report inconsistent styling when it is clearly noticeable.

---

# 7. Components

Inspect:

- Buttons
- Cards
- Inputs
- Selects
- Dropdowns
- Checkboxes
- Radio buttons
- Tabs
- Tables
- Modals
- Tooltips
- Toasts
- Badges
- Avatars
- Icons
- Menus
- Pagination
- Breadcrumbs

Check for:

- Misalignment
- Incorrect sizing
- Inconsistent spacing
- Broken borders
- Clipped content
- Poor hover states
- Missing disabled states
- Unclear active states
- Icons that do not match their action

---

# 8. Buttons

Every important button should be visually understandable.

Check:

- Text/icon clarity
- Size
- Alignment
- Spacing
- Hover state
- Active state
- Disabled state
- Loading state
- Success feedback
- Error feedback

Especially inspect:

- Save
- Create
- Update
- Delete
- Export
- Invite
- Upload
- AI actions
- Navigation controls

When a button performs an asynchronous action, the user should immediately know that the click was received.

---

# 9. Loading States

This is a major QA area.

Whenever something takes time to load, check whether the interface communicates that clearly.

Look for:

- Spinner
- Skeleton
- Progress indicator
- Button loading state
- Disabled state
- "Loading..." message
- Processing state

Avoid situations where:

> User clicks → nothing visibly changes → user does not know whether the click worked.

Report this as a UX issue when appropriate.

---

# 10. Error States

Inspect the visual quality of errors.

Check:

- Error message visibility
- Error message positioning
- Error styling
- Readability
- Whether the error is near the affected field
- Whether the user knows how to recover
- Whether the error causes unwanted navigation

Avoid:

- Raw technical errors
- Unformatted stack traces
- Errors hidden outside the viewport
- Errors appearing in unrelated locations

---

# 11. Empty States

Inspect pages with no data.

Check whether empty states clearly communicate:

- What is empty
- Why it may be empty
- What the user can do next

Avoid:

- Blank screens
- Empty containers with no explanation
- Broken tables
- Broken layouts
- "undefined"
- "null"
- Missing icons
- Misaligned empty-state components

---

# 12. Responsive Testing

Test at multiple viewport sizes.

At minimum:

### Desktop

Approximately:

- 1440 × 900
- 1920 × 1080

### Laptop

Approximately:

- 1366 × 768

### Tablet

Approximately:

- 1024 × 768
- 768 × 1024

### Mobile

Approximately:

- 390 × 844
- 375 × 812

Exact dimensions may vary depending on available browser tools.

---

# 13. Mobile Visual Inspection

Do not merely verify that the page technically loads on mobile.

Check whether it actually looks good.

Inspect:

- Header
- Navigation
- Sidebar
- Cards
- Tables
- Buttons
- Forms
- Modals
- Tabs
- Filters
- Timeline
- Board
- Lists
- AI Agents
- Project Brain

Look for:

- Horizontal overflow
- Buttons overlapping
- Controls touching each other
- Text clipping
- Cards becoming too narrow
- Tables becoming unusable
- Fixed buttons covering content
- Navigation covering content
- Modals extending beyond the viewport
- Tiny touch targets

---

# 14. Scrolling

Test:

- Page vertical scrolling
- Horizontal scrolling
- Nested scrolling
- Table scrolling
- Board scrolling
- Timeline scrolling
- Gantt scrolling
- Modal scrolling

Check for:

- Scrollbars appearing unexpectedly
- Scrollbars missing when needed
- Content hidden below fixed elements
- Horizontal overflow
- Scroll containers stopping unexpectedly
- Sticky headers covering content

For timeline/date-based views, verify that users can continue scrolling/navigating through the available timeline without the interface becoming stuck or inaccessible.

---

# 15. Timeline UI

Pay special attention to Timeline/Gantt interfaces.

Check:

- Month headers
- Date alignment
- Task rows
- Horizontal scrolling
- Vertical scrolling
- Current-date indicator
- Task bars
- Labels
- Zoom controls
- Navigation controls
- Sticky headers
- Mobile behavior

Verify that the timeline remains usable as the time range becomes larger.

---

# 16. List UI

Check:

- Row alignment
- Column widths
- Long task names
- Status badges
- Priority indicators
- Assignee information
- Dates
- Actions
- Pagination
- Sorting
- Filtering
- Horizontal scrolling

Make sure action buttons do not overlap.

---

# 17. Board UI

Check:

- Column widths
- Card spacing
- Card height
- Drag/drop appearance
- Empty columns
- Long task titles
- Status badges
- Assignee avatars
- Action buttons
- Horizontal scrolling
- Mobile layout

On mobile, verify that there is an alternative to desktop-only drag-and-drop interactions when necessary.

---

# 18. Tables

Check:

- Column alignment
- Header alignment
- Row height
- Long text
- Overflow
- Horizontal scrolling
- Sticky headers
- Actions
- Empty state
- Loading state

Do not allow important information to disappear because of fixed column widths.

---

# 19. Modals

Inspect:

- Position
- Width
- Height
- Padding
- Header
- Close button
- Footer
- Buttons
- Form alignment
- Scrolling
- Mobile behavior

Check:

- Modal fits viewport
- Modal content scrolls when necessary
- Background does not scroll unexpectedly
- Close button remains accessible
- Buttons do not overlap

---

# 20. Forms

Visually inspect:

- Label placement
- Input alignment
- Input height
- Placeholder text
- Required indicators
- Validation errors
- Help text
- Buttons
- Loading state
- Success state

Check that forms remain usable on mobile.

---

# 21. Navigation and Tabs

Inspect:

- Sidebar
- Top navigation
- Breadcrumbs
- Tabs
- Active states
- Hover states
- Mobile navigation

For tab systems such as:

- List
- Board
- Timeline
- AI Agents
- Project Brain

verify:

- Active tab is obvious
- Switching feels immediate
- Content loads correctly
- Loading feedback exists
- No layout jump occurs
- Mobile navigation remains usable

---

# 22. UX Responsiveness

The application should communicate actions immediately.

For every major interaction ask:

> "If I click this button, do I immediately know that something happened?"

If the answer is no, report the UX problem.

Examples:

- Button has no loading state
- Tab appears frozen
- Export gives no feedback
- AI request gives no indication
- Save takes time with no indicator
- Page navigation appears unresponsive

---

# 23. Visual Regression

Compare related pages and repeated components.

Check whether:

- Buttons use consistent styling
- Cards use consistent radius
- Headers use consistent spacing
- Forms use consistent input styles
- Status badges are consistent
- Tables use consistent typography
- Empty states are consistent
- Loading states are consistent

Identify visual inconsistencies that make the application feel unfinished.

---

# 24. Broken UI Detection

Actively look for:

- Overlapping elements
- Clipped elements
- Missing icons
- Broken images
- Broken buttons
- Empty containers
- Misaligned text
- Incorrect spacing
- Unexpected scrollbars
- Missing scrollbars
- Content outside viewport
- Broken responsive layout
- Elements hidden accidentally
- Controls covering other controls
- Incorrect z-index
- Modal positioning problems
- Sticky element conflicts

---

# 25. Visual Severity

## Critical

Use only when the UI prevents the user from performing a core application function.

Example:

- Login button inaccessible
- Main navigation unusable
- Core project page completely broken

## High

Use when:

- Important workflow is difficult or impossible
- Major page layout is broken
- Important controls overlap
- Mobile page is unusable
- Critical information is hidden

## Medium

Use when:

- Significant visual defect
- Poor responsive behavior
- Important UX friction
- Broken loading feedback
- Noticeable alignment/layout problem

## Low

Use when:

- Minor spacing issue
- Small alignment issue
- Minor typography inconsistency
- Small visual polish issue

## Informational

Use for:

- Design improvement
- Optional polish
- Minor consistency suggestion

---

# 26. Evidence

For visual issues, prioritize visual evidence.

Use:

- Screenshot
- Exact page
- Exact viewport
- Visible behavior
- Reproduction steps

A visual defect should preferably include a screenshot when the testing environment allows screenshots.

Do not claim that a page looks broken without visually inspecting it.

---

# 27. Confirmed vs Suspected

## CONFIRMED

Use when the issue is visibly reproducible.

Example:

`CONFIRMED: Export button overlaps Favorite button on 390px mobile viewport.`

## SUSPECTED

Use when:

- Source code suggests a problem
- But the UI could not be inspected
- Or the issue could not be reproduced

Example:

`SUSPECTED: Timeline may create excessive DOM nodes with large datasets; runtime performance testing required.`

---

# 28. Source Code Usage

Source code should primarily be used to understand the cause of an observed UI problem.

Preferred:

1. Observe visual problem.
2. Reproduce it.
3. Capture evidence.
4. Inspect relevant source code.
5. Identify probable cause.
6. Report.

Do not reverse this unnecessarily.

---

# 29. Functional Testing

After visual inspection, test important interactions.

Verify:

- Buttons work
- Links work
- Tabs work
- Forms submit
- Filters work
- Sorting works
- Search works
- Modals open/close
- Data saves
- Data persists
- Navigation works

Visual quality remains the primary focus.

---

# 30. API and Database Testing

Only investigate APIs/database behavior when:

- A UI defect appears to originate from backend behavior
- A workflow cannot be validated through the UI
- The task explicitly requests API/database testing

Do not turn normal UI QA into a database audit.

---

# 31. Security Testing Boundary

Do not perform a full security audit during normal UI testing.

If a security concern becomes visible:

- Record the observation.
- Safely verify basic behavior if possible.
- Mark it as security-related.
- Recommend the `security-audit` skill for detailed investigation.

Do not perform aggressive exploitation.

---

# 32. Safety Rules

Do not:

- Modify application code
- Delete production data
- Modify production data unnecessarily
- Disable authentication
- Disable security controls
- Expose secrets
- Create backdoors
- Perform destructive tests
- Spam APIs
- Spam email systems
- Make large numbers of AI requests unnecessarily

Testing should be non-destructive unless explicitly authorized.

---

# 33. Test Report

Return:

# Orbitwork UI/UX QA Report

## 1. Overall Visual Quality

Give a concise assessment:

- Excellent
- Good
- Needs Improvement
- Poor
- Severely Broken

Explain why.

---

## 2. Environment

Include:

- Application URL
- Browser
- Viewport
- Device type
- Application/build version if available

---

## 3. Pages Inspected

List every page actually inspected.

Example:

- Dashboard
- Projects
- Project Overview
- Task List
- Task Board
- Timeline
- Timesheets
- Documents
- AI Agents
- Project Brain
- Settings

Do not list pages that were not actually inspected.

---

## 4. Visual Findings

For each issue:

### UI-001

**Severity:** Medium

**Page:** Project Timeline

**Viewport:** 390 × 844

**Problem:**

Describe exactly what visually looks wrong.

**Expected:**

Describe the expected visual behavior.

**Actual:**

Describe what was observed.

**Evidence:**

Screenshot or other visual evidence.

**Recommended Fix:**

Concise recommendation.

---

## 5. Responsive Findings

Separate findings for:

- Desktop
- Laptop
- Tablet
- Mobile

---

## 6. Interaction / UX Findings

Report:

- Missing loading feedback
- Missing success feedback
- Missing error feedback
- Unclear buttons
- Broken navigation
- Poor interactions
- Unresponsive controls

---

## 7. Functional Findings

Only report actual functional defects discovered during testing.

---

## 8. Suspected Issues

Keep unverified issues separate.

---

## 9. Pages With No Major Issues

List pages that were visually inspected and appeared acceptable.

---

## 10. Overall Recommendation

Choose:

- `READY`
- `READY WITH MINOR UI FIXES`
- `NEEDS UI IMPROVEMENT`
- `NOT READY`

Explain the recommendation based primarily on observed UI/UX quality.

---

# 34. Final QA Rules

Before completing the report verify:

- Did I actually open the application?
- Did I visually inspect the pages?
- Did I inspect desktop layout?
- Did I inspect mobile layout?
- Did I check responsive behavior?
- Did I check scrolling?
- Did I check overlapping elements?
- Did I check typography?
- Did I check spacing?
- Did I check buttons?
- Did I check loading states?
- Did I check error states?
- Did I check empty states?
- Did I check tabs and navigation?
- Did I check major user interactions?
- Did I distinguish visual defects from code smells?
- Did I provide evidence?
- Did I avoid claiming that uninspected pages were tested?

If a page was not visually inspected, explicitly say so.

Never claim that the entire application was tested when only part of it was inspected.