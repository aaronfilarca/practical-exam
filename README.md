# Comprehensive Academic Grade & CHED Compliance Lookup System

A fully client-side academic grading and CHED (Commission on Higher Education)
attendance-compliance system. No backend, no build step — plain HTML5,
Bootstrap 5, and modular vanilla JavaScript (ES modules), with all state
persisted in the browser's `localStorage`.

---

## 1. Running it

Because the app uses native ES modules (`<script type="module">`), most
browsers will refuse to load it from a `file://` URL. Serve the folder over
HTTP instead:

```bash
# from inside the ched-grade-system/ folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Any other static file server (`npx serve`, VS Code's "Live Server", etc.)
works too. No install step, no dependencies to build — everything else
(Bootstrap, Bootstrap Icons, Google Fonts) loads from a CDN.

On first load, the app detects that `localStorage` is empty and seeds it
automatically with a realistic demo dataset (see §4). Use the **Reset demo
data** button in the navbar at any time to wipe your changes and start over.

---

## 2. Project structure

```
ched-grade-system/
├── index.html          Application shell: navbar, quick-switch bar, view container
├── css/
│   └── styles.css       Custom styling layered on top of Bootstrap 5
├── js/
│   ├── storage.js       Schema, mock-data seeding, localStorage CRUD ("the database")
│   ├── auth.js          Role/session management, quick-switch demo login, nav guards
│   ├── admin.js         Admin role: courses, faculty allocation, CHED thresholds, enrollment
│   ├── professor.js     Professor role: syllabus, items, grading, attendance, search
│   ├── student.js       Student role: dashboard, grade breakdown, KPIs, warnings, calculator
│   └── app.js           Router, bootstrap, and the single global alert banner
└── README.md            You are here
```

Each feature module (`admin.js`, `professor.js`, `student.js`) only talks to
data through `storage.js`'s `db` object — none of them touch `localStorage`
directly. `app.js` is the only place that decides *which* view is mounted,
based on the active session's role.

---

## 3. Roles & demo accounts

There is no password login — this is a demo system. Use the **quick-switch
bar** in the navbar to instantly become any seeded user:

| Role      | Seeded accounts                                             |
|-----------|---------------------------------------------------------------|
| Admin     | Dr. Elena Reyes                                               |
| Professor | Prof. Marco Villanueva (CS101), Prof. Angela Cruz (IT205)      |
| Student   | Juan Dela Cruz, Maria Santos, Paolo Ramos, Kim Aquino          |

Switching accounts is instant and does not require a page reload.

---

## 4. Seeded demo data — what to look at

The mock data is arranged so every business rule is visible without any
manual setup:

- **CS101 – Data Structures and Algorithms** (Prof. Villanueva, absence
  threshold **3**): Quizzes 30% / Exams 40% / Courseworks 30%.
  - Juan Dela Cruz has an ungraded, past-due item ("Programming Project 2")
    → triggers the **missed activity** warning.
  - Paolo Ramos has 2 of 3 allowable absences → triggers the **"one absence
    away"** CHED warning.
- **IT205 – Software Engineering** (Prof. Cruz, absence threshold **4**):
  Quizzes 20% / Exams 50% / Courseworks 30%.
  - Kim Aquino has already reached 4 absences → **CHED breach**, automatic
    5.00 messaging is shown.
  - Kim also has an ungraded, past-due "UML Design Document" → missed
    activity warning.
- Several items are due within the next 3 days across both courses, to
  demonstrate the **due-soon** highlight.

---

## 5. Business rules & formulas

### 5.1 Syllabus weighting
- A course's categories (e.g. Quizzes, Exams, Courseworks) must have weights
  that sum to **exactly 100%**. The UI blocks adding a category that would
  push the total over 100%, and visibly flags any course that isn't yet
  balanced.
- Each item's individual weight is **its category's weight ÷ the number of
  items currently in that category**. Adding a 4th item to a 30%-weighted
  category re-splits everyone in it to 7.5% each, live.

### 5.2 Grade calculation
For a given student and course:

```
item contribution   = (score / max_points) * item_weight
accumulated grade    = sum of contributions for all SCORED items
achievable-to-date    = sum of item_weight for all items whose due date has
                        already passed (the ceiling if everything due so far
                        had been scored 100%)
max final grade       = accumulated grade + (total_weight − scored_weight)
                        (the ceiling assuming 100% on everything still left)
```

### 5.3 Attendance & CHED compliance
- Attendance (`Present` / `Absent` / `Excused`) is tracked **per course, per
  date** and **never contributes to the grade calculation** — it is purely
  for CHED compliance.
- Each course has an admin-configured **allowable absence threshold**.
  - At `threshold − 1` absences → warning: "one absence away."
  - At `threshold` absences or more → critical alert: automatic failing mark
    (5.00) has been triggered for that course.

### 5.4 Pass & target strategy calculator (student view)
Given a set of *uncompleted* items the student selects, and a goal grade
`G` (either the fixed passing mark of 70.0%, or a custom target):

```
required_uniform_percent = (G − accumulated_grade) / selected_weight * 100
```

- If `accumulated_grade` already ≥ `G`, the goal is flagged as **already
  secured**.
- If the required percent exceeds 100%, the goal is flagged as
  **mathematically impossible** with the currently selected items.

### 5.5 Numerical & letter grade equivalent
Every percentage grade shown to a student (per-course KPI, the grade
breakdown panel, and the "My courses" dashboard cards) is also converted to
its numerical and letter grade equivalent, using the 70%-passing-rate scale:

| Percentage    | Numerical | Letter | Description           |
|---------------|-----------|--------|------------------------|
| 98–100        | 1.00      | A      | Excellent              |
| 95–97.99      | 1.25      | A-     | Highly Meritorious     |
| 91–94.99      | 1.50      | B+     | Meritorious            |
| 88–90.99      | 1.75      | B      | Very Good              |
| 85–87.99      | 2.00      | B      | Good                   |
| 81–84.99      | 2.25      | C+     | Satisfactory           |
| 77–80.99      | 2.50      | C      | Fair                   |
| 73–76.99      | 2.75      | D+     | Marginal               |
| 70–72.99      | 3.00      | D      | Lowest Passing Grade   |
| 0–69.99       | 5.00      | F      | Failure                |

If a course's CHED absence threshold has been breached, this always
overrides the percentage-based conversion: the course shows **5.00 (F) —
Failure due to Absences**, regardless of the student's academic score.

### 5.6 Overall QWA (Quality Weighted Average)
Each course now carries a **credit unit** value (set by the admin, default
3). The student dashboard's "Quality Weighted Average" panel combines every
enrolled course's numerical grade equivalent into a single unit-weighted
average:

```
QWA = Σ(numerical_grade_i × units_i) / Σ(units_i)
```

As with the CHED numerical scale, **lower is better** — 1.00 is the best
possible QWA, 3.00 is the passing boundary, and 5.00 is outright failure.

### 5.7 Multi-parameter search (professor view)
The assessment item list can be filtered simultaneously by category name,
item name, and a min/max item-weight percentage range, and sorted by due
date, average class score, category, or title.

---

## 6. Data model (as stored in `localStorage`)

Everything lives under a single key (`ched_gls_data_v1`) as one JSON object;
the active session lives separately under `ched_gls_session_v1`.

| Collection    | Shape                                                                 |
|---------------|------------------------------------------------------------------------|
| `users`       | `{ id, role, name, username }`                                        |
| `courses`     | `{ id, code, title, professorId, absenceThreshold, units }`             |
| `enrollments` | `{ id, studentId, courseId }`                                          |
| `categories`  | `{ id, courseId, name, weight }`                                       |
| `items`       | `{ id, courseId, categoryId, title, dueDate, maxPoints }`               |
| `scores`      | `{ id, itemId, studentId, score }`                                     |
| `attendance`  | `{ id, courseId, studentId, date, status }`                            |

---

## 7. Known limitations (by design, for a demo)

- No real authentication — anyone can switch to any role from the navbar.
- Single-browser persistence only; nothing syncs across devices or users.
- Removing a student from a course keeps their historical scores/attendance
  in storage (so re-enrolling restores their record) but hides them from
  view while unenrolled.
- Deleting a course cascades and permanently removes its categories, items,
  scores, and attendance — there is no undo beyond the full "Reset demo
  data" action.
