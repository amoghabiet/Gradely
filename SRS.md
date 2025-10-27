# Gradely - Software Requirements Specification (SRS)

## 1. Executive Summary

**Gradely** is an AI-powered, editor-first code learning and assessment platform designed to provide instant, intelligent feedback on code submissions. It combines a Monaco-based in-browser code editor with real-time AI code review, an integrated AI assistant powered by bigcode/starcoder2-3b, and an optional assessment module for educators to create, assign, and grade coding assignments.

**Target Users:**
- Students: Learn to code with instant AI feedback and suggestions
- Instructors/Teachers: Create and manage coding assignments, review submissions, and track student progress
- TAs: Assist in grading and providing feedback

**Core Value Proposition:**
- Accessible, instant AI feedback without setup or mandatory assignments
- Editor-first experience with live code awareness
- Optional assessment module for educators
- Real-time collaboration and learning

---

## 2. Product Overview

### 2.1 Vision
Democratize code learning by providing accessible, intelligent, and instant feedback to learners at any level, while enabling educators to efficiently manage and assess coding assignments.

### 2.2 Key Features

#### 2.2.1 Core Editor (MVP - Enabled)
- **Monaco-based Code Editor**
  - Multi-language support: JavaScript, TypeScript, Python, Java, C, C++, HTML, CSS
  - Syntax highlighting and auto-completion
  - Real-time linting and error detection
  - Configurable theme (light/dark)
  - Keyboard shortcuts and accessibility features

- **AI Code Review**
  - One-click analysis via `/api/review` endpoint
  - Structured issue detection (errors, warnings, suggestions)
  - Inline markers and line-by-line feedback
  - Summary and severity classification
  - Graceful error handling with fallback suggestions

- **AI Assistant Sidebar**
  - Powered by bigcode/starcoder2-3b via Hugging Face Open-Perplexity
  - Live code awareness (reads buffer in real-time)
  - Natural language queries: "What does this function do?", "Optimize this loop", "Explain the error on line 12"
  - Code suggestions with preview and apply functionality
  - Snippet insertion and copy-to-clipboard
  - Keyboard shortcuts (Cmd/Ctrl+I to toggle, Alt+] to cycle suggestions)
  - Send-to-Output action for streaming results

- **Output Window**
  - Resizable, collapsible panel at the bottom
  - Auto-scroll to newest output
  - Color-coded lines: errors (red), warnings (orange), success (green), info (gray)
  - Clear, Copy, Expand, Hide, and Focus controls
  - Keyboard shortcuts (Alt+O expand/collapse, Alt+Shift+O focus, Alt+K clear, Alt+H hide)
  - Jump-to-line integration with editor
  - Event bus for streaming logs from editor, AI, tests, and other modules
  - Accessible typography and high-contrast support

- **Snapshot History**
  - Auto-save code snapshots to localStorage
  - Manual snapshot creation with timestamps
  - Load/restore previous versions
  - Version comparison (future enhancement)

- **Code Execution & Testing** (Planned)
  - Client-side JS/TS execution via Web Workers
  - Python execution via Pyodide (WASM)
  - Test result streaming to Output Window
  - Error and success reporting

#### 2.2.2 AI Assistant Features
- **Context-Aware Suggestions**
  - Reads live editor buffer
  - Tracks real-time changes as user types
  - Provides language-specific recommendations
  - Supports refactoring, optimization, and explanation requests

- **Code Editing Capabilities**
  - Preview changes before applying
  - Apply suggestions directly to editor
  - Highlight affected lines
  - Undo/revert applied changes

- **Natural Language Interface**
  - Conversational chat bubbles
  - Support for direct questions and requests
  - Fallback to heuristic suggestions when model unavailable

#### 2.2.3 Optional Assessment Module (Enabled)
- **Instructor Features**
  - Create coding assignments with title, description, and due date
  - Define test cases and rubrics for auto-grading
  - Manage multiple assignments
  - View submission analytics and statistics
  - Override auto-grades and provide manual feedback
  - Notifications for new submissions and deadline reminders

- **Student Features**
  - View assigned assignments with descriptions and due dates
  - Submit code directly from the editor
  - Receive auto-graded results with feedback
  - View submission history and previous attempts
  - Receive notifications for grades and feedback

- **Auto-Grading System**
  - JavaScript/TypeScript test execution
  - Test case validation
  - Rubric-based scoring
  - Detailed feedback on failures
  - Extensible to other languages (Python, Java, etc.)

- **Role-Based Access Control**
  - Instructor: Create, edit, delete assignments; view all submissions; override grades
  - Student: View assigned assignments; submit code; view own submissions
  - TA: View submissions; provide feedback; assist in grading
  - Admin: Full access to all features and data

- **Notifications**
  - Assignment deadline reminders
  - Submission status updates
  - Grade notifications
  - Feedback alerts

- **Analytics & Reporting**
  - Submission statistics (on-time, late, missing)
  - Grade distribution
  - Student performance trends
  - Assignment difficulty metrics

#### 2.2.4 Chatbot (Optional)
- **Conversational Interface**
  - Chat-based Q&A about code
  - Integration with Hugging Face Open-Perplexity Space
  - Folder code execution (JS/TS in Web Workers, Python via Pyodide)
  - In-chat API key management (secure, masked)

- **Code Execution**
  - Run code snippets from chat
  - Display results inline
  - Error handling and reporting

---

## 3. Functional Requirements

### 3.1 Editor Page (`/`)
- **Display:** Monaco editor with language selector, Analyze button, Save Snapshot, Clear, and Assistant toggle
- **Interactions:**
  - Select language from dropdown (JavaScript, TypeScript, Python, Java, C, C++, HTML, CSS)
  - Type or paste code
  - Click "Analyze Code" to trigger AI review
  - Click "Save Snapshot" to create a version
  - Click "Clear" to reset editor
  - Toggle AI Assistant sidebar (Cmd/Ctrl+I)
  - View Output Window at bottom (resizable, collapsible)

### 3.2 AI Review Flow
- **Endpoint:** `POST /api/review`
- **Input:** `{ code: string, language: string }`
- **Output:** `{ summary: string, issues: Array<{ line: number, severity: string, message: string }> }`
- **Behavior:**
  - Analyze code for errors, warnings, and suggestions
  - Return structured JSON with line numbers and severity
  - Display issues in Review Panel with inline markers
  - Graceful error handling with fallback suggestions

### 3.3 AI Assistant Flow
- **Endpoint:** `POST /api/assistant`
- **Input:** `{ prompt: string, code: string, language: string }`
- **Output:** `{ suggestions: Array<{ type: string, content: string, snippet?: string, apply?: { startLine, endLine, replacement } }> }`
- **Behavior:**
  - Send prompt and code context to bigcode/starcoder2-3b
  - Return structured suggestions (general improvements, snippets, or precise edits)
  - Support snippet insertion when exact diffs unavailable
  - Preview changes before applying
  - Highlight affected lines after apply
  - Stream responses to Output Window on user request

### 3.4 Assignments Page (`/assignments`)
- **Instructor View:**
  - List all created assignments
  - Create new assignment (title, description, due date, test cases)
  - Edit/delete assignments
  - View submissions and grades
  - Override grades and provide feedback

- **Student View:**
  - List assigned assignments
  - View assignment details
  - Submit code from editor
  - View submission history and grades

### 3.5 Assessment API Routes
- `POST /api/assessments/assignments` - Create assignment (instructor only)
- `GET /api/assessments/assignments` - List assignments (role-based)
- `POST /api/assessments/submissions` - Submit code (student)
- `GET /api/assessments/submissions` - List submissions (role-based)
- `POST /api/assessments/override` - Override grade (instructor/TA)
- `GET /api/assessments/notifications` - Get notifications (user-specific)
- `GET /api/assessments/analytics` - Get analytics (instructor/admin)

### 3.6 Chat Page (`/chat`)
- **Display:** Chatbot interface with conversation history
- **Interactions:**
  - Type natural language queries
  - Manage API keys in-chat (secure, masked)
  - Execute code snippets
  - View results inline

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Editor should load within 2 seconds
- AI review should complete within 10 seconds
- AI assistant should respond within 15 seconds
- Output window should auto-scroll without lag
- Support 1000+ lines of code without performance degradation

### 4.2 Accessibility
- WCAG 2.1 AA compliance
- High-contrast color options
- Keyboard navigation support
- Screen reader compatibility
- Large typeface options for output text
- Semantic HTML and ARIA labels

### 4.3 Security
- Row-Level Security (RLS) on all database tables
- Role-based access control enforced server-side
- API key masking in chat interface
- No sensitive data in localStorage (except code snapshots)
- HTTPS for all communications
- Input validation and sanitization

### 4.4 Scalability
- Support concurrent users
- Efficient database queries with indexing
- Caching for frequently accessed data
- Horizontal scaling via Vercel

### 4.5 Reliability
- Graceful error handling with user-friendly messages
- Fallback suggestions when AI models unavailable
- Automatic retry logic for failed requests
- Data persistence via Supabase

### 4.6 Usability
- Intuitive UI with clear visual hierarchy
- Consistent white/rounded minimalist design
- Keyboard shortcuts for power users
- Tooltips and help text
- Responsive design for mobile/tablet

---

## 5. Technical Architecture

### 5.1 Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js API Routes, Node.js
- **Database:** Supabase (PostgreSQL) with Row-Level Security
- **AI Models:** bigcode/starcoder2-3b (via Hugging Face Open-Perplexity)
- **Editor:** Monaco Editor
- **Code Execution:** Web Workers (JS/TS), Pyodide (Python)
- **Deployment:** Vercel

### 5.2 Database Schema
- `user_roles` - User role assignments (instructor, student, TA, admin)
- `assignments` - Assignment metadata (title, description, due date, created_by)
- `assignment_tests` - Test cases for auto-grading
- `assignment_submissions` - Student code submissions
- `submission_results` - Auto-grading results
- `notifications` - User notifications
- RLS policies enforce role-based access

### 5.3 API Routes
- `/api/review` - AI code review
- `/api/assistant` - AI assistant suggestions
- `/api/chat` - Chatbot interface
- `/api/assessments/*` - Assessment management
- `/api/assessments/analytics` - Analytics data
- `/api/assessments/notifications` - Notifications

### 5.4 Component Structure
- `components/gradely/code-editor.tsx` - Monaco editor wrapper
- `components/gradely/ai-assistant.tsx` - AI assistant sidebar
- `components/gradely/review-panel.tsx` - Code review results
- `components/gradely/output-window.tsx` - Output/logs display
- `components/gradely/header.tsx` - Navigation and controls
- `components/gradely/history-panel.tsx` - Snapshot history
- `components/gradely/chatbot.tsx` - Chat interface
- `components/assessments/instructor-panel.tsx` - Instructor assignment management
- `components/assessments/student-panel.tsx` - Student assignment view

### 5.5 Event Bus
- `lib/output-bus.ts` - Singleton event emitter for streaming logs
- Used by editor, AI assistant, tests, and other modules
- Enables real-time output display without tight coupling

---

## 6. User Flows

### 6.1 Student Learning Flow
1. Navigate to editor page (`/`)
2. Select language and write code
3. Click "Analyze Code" to get AI review
4. Read feedback and inline markers
5. Ask AI Assistant for help (e.g., "Optimize this loop")
6. Apply suggestions or manually edit
7. Save snapshots for version control
8. View execution results in Output Window

### 6.2 Instructor Assignment Flow
1. Navigate to assignments page (`/assignments`)
2. Click "Create Assignment"
3. Enter title, description, due date, and test cases
4. Publish assignment to students
5. Students submit code
6. View submissions and auto-graded results
7. Override grades if needed
8. Provide feedback
9. View analytics and student performance

### 6.3 Student Submission Flow
1. View assigned assignments (`/assignments`)
2. Click on assignment to view details
3. Write or paste code in editor
4. Click "Submit" to submit code
5. Receive auto-graded results
6. View feedback and test results
7. Optionally resubmit for improvement

---

## 7. Constraints & Assumptions

### 7.1 Constraints
- Client-side code execution limited to JS/TS and Python (via Pyodide)
- AI model responses depend on upstream service availability
- Database storage limited by Supabase plan
- Real-time collaboration not supported in MVP

### 7.2 Assumptions
- Users have modern browsers (Chrome, Firefox, Safari, Edge)
- Internet connectivity required for AI features
- Supabase integration is properly configured
- Hugging Face Open-Perplexity endpoint is accessible

---

## 8. Future Enhancements

### Phase 2
- Real-time collaboration (multiple users editing same code)
- Version comparison and diff view
- Code templates and starter projects
- Peer code review system
- Leaderboards and gamification
- Mobile app (React Native)

### Phase 3
- Support for more languages (Go, Rust, C#, etc.)
- Advanced auto-grading (custom validators, performance tests)
- Integration with GitHub/GitLab
- CI/CD pipeline integration
- Advanced analytics and reporting
- AI-powered tutoring system

### Phase 4
- Marketplace for assignments and templates
- Community features (forums, discussions)
- Certification programs
- Enterprise features (SSO, audit logs, advanced permissions)

---

## 9. Success Metrics

- **Adoption:** 1000+ active users within 6 months
- **Engagement:** 70%+ daily active users
- **Satisfaction:** 4.5+ star rating
- **Performance:** 95%+ uptime
- **AI Accuracy:** 90%+ helpful suggestions
- **Student Outcomes:** 20%+ improvement in code quality

---

## 10. Glossary

- **AI Review:** Automated code analysis for errors, warnings, and suggestions
- **AI Assistant:** Conversational AI that provides code suggestions and explanations
- **Snapshot:** Saved version of code at a point in time
- **Assignment:** Coding task created by instructor for students
- **Submission:** Student's code submission for an assignment
- **Auto-Grading:** Automated evaluation of code against test cases
- **RLS:** Row-Level Security (database-level access control)
- **Output Window:** Panel displaying execution results, logs, and AI outputs

---

## 11. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-24 | v0 | Initial SRS for Gradely MVP |

---

**End of SRS Document**
