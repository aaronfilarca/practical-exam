// ============================================================================
// student.js
// Grade breakdown table, KPI metrics, early warnings, and passing/target
// calculator for the Student role.
// ============================================================================

import { db, todayISO, daysBetween, formatDate } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { showAlert } from "./app.js";

const PASSING_GRADE = 70.0;
const DUE_SOON_DAYS = 3;

// ----------------------------------------------------------------------
// CHED-style numerical/letter grade scale (70% passing rate table).
// Ranges are inclusive of their lower bound; the last row catches everything
// below the lowest passing percentage.
// ----------------------------------------------------------------------
const GRADE_SCALE = [
  { min: 98,  numerical: 1.00, letter: "A",  description: "Excellent" },
  { min: 95,  numerical: 1.25, letter: "A-", description: "Highly Meritorious" },
  { min: 91,  numerical: 1.50, letter: "B+", description: "Meritorious" },
  { min: 88,  numerical: 1.75, letter: "B",  description: "Very Good" },
  { min: 85,  numerical: 2.00, letter: "B",  description: "Good" },
  { min: 81,  numerical: 2.25, letter: "C+", description: "Satisfactory" },
  { min: 77,  numerical: 2.50, letter: "C",  description: "Fair" },
  { min: 73,  numerical: 2.75, letter: "D+", description: "Marginal" },
  { min: 70,  numerical: 3.00, letter: "D",  description: "Lowest Passing Grade" },
  { min: -Infinity, numerical: 5.00, letter: "F", description: "Failure" },
];

/** Converts a percentage (0-100) into { numerical, letter, description }. */
function percentToGrade(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const row = GRADE_SCALE.find(r => clamped >= r.min);
  return { numerical: row.numerical, letter: row.letter, description: row.description };
}

/** Buckets a QWA (weighted-average numerical grade) into its band label. */
function qwaDescription(qwa) {
  const bands = [
    { max: 1.00, label: "Excellent" },
    { max: 1.25, label: "Highly Meritorious" },
    { max: 1.50, label: "Meritorious" },
    { max: 1.75, label: "Very Good" },
    { max: 2.00, label: "Good" },
    { max: 2.25, label: "Satisfactory" },
    { max: 2.50, label: "Fair" },
    { max: 2.75, label: "Marginal" },
    { max: 3.00, label: "Passing" },
  ];
  const band = bands.find(b => qwa <= b.max);
  return band ? band.label : "Failing";
}

/**
 * A course's final grade equivalent, accounting for the CHED absence rule:
 * a breached absence threshold always overrides the computed percentage
 * with an automatic 5.00 / "Failure due to Absences".
 */
function getCourseFinalGrade(studentId, courseId, summary) {
  const course = db.getCourse(courseId);
  const absences = db.getAttendanceByCourseAndStudent(courseId, studentId).filter(a => a.status === "Absent").length;
  if (absences >= course.absenceThreshold) {
    return { numerical: 5.00, letter: "F", description: "Failure due to Absences", isAbsenceFailure: true };
  }
  return { ...percentToGrade(summary.accumulatedGrade), isAbsenceFailure: false };
}

/**
 * Overall Quality Weighted Average (QWA) across every course the student is
 * enrolled in, weighted by each course's credit units. Lower is better
 * (1.00 = Excellent, 5.00 = Failure), matching the CHED numerical scale.
 */
function computeOverallQWA(studentId, courses) {
  let weightedSum = 0;
  let totalUnits = 0;

  const perCourse = courses.map(course => {
    const summary = computeGradeSummary(studentId, course.id);
    const grade = getCourseFinalGrade(studentId, course.id, summary);
    const units = course.units ?? 3;
    weightedSum += grade.numerical * units;
    totalUnits += units;
    return { course, summary, grade, units };
  });

  const qwa = totalUnits > 0 ? weightedSum / totalUnits : null;
  return { perCourse, qwa, totalUnits };
}

const state = {
  activeCourseId: null,
  targetGrade: "",
  selectedItemIds: new Set(),
};

function itemWeight(item) {
  const siblings = db.getItemsByCategory(item.categoryId);
  const category = db.getCategory(item.categoryId);
  if (!category || siblings.length === 0) return 0;
  return category.weight / siblings.length;
}

/**
 * Builds the full grade picture for a student in a course:
 * - rows: one per assessment item, with score/weight/contribution
 * - accumulatedGrade: percentage actually earned so far
 * - achievableToDate: ceiling for every item that is graded or already due
 * - maxFinalGrade: ceiling if every remaining (unscored) item scores 100%
 */
function computeGradeSummary(studentId, courseId) {
  const items = db.getItemsByCourse(courseId);
  const today = todayISO();

  let accumulatedGrade = 0;
  let scoredWeight = 0;
  let achievableToDate = 0;

  const rows = items.map(item => {
    const category = db.getCategory(item.categoryId);
    const weight = itemWeight(item);
    const record = db.getScore(item.id, studentId);
    const hasScore = !!record && record.score !== null && record.score !== undefined;
    const percentOfMax = hasScore ? (record.score / item.maxPoints) * 100 : null;
    const contribution = hasScore ? (percentOfMax / 100) * weight : 0;
    const isPastDue = daysBetween(item.dueDate, today) < 0;
    const isDueSoon = !hasScore && daysBetween(item.dueDate, today) >= 0 && daysBetween(item.dueDate, today) <= DUE_SOON_DAYS;
    const isMissed = !hasScore && isPastDue;

    if (hasScore) {
      accumulatedGrade += contribution;
      scoredWeight += weight;
    }
    return {
      item, category, weight, hasScore,
      score: hasScore ? record.score : null,
      percentOfMax, contribution, isPastDue, isDueSoon, isMissed,
    };
  });

  // Include all graded items plus any ungraded items that are already due.
  achievableToDate = rows
    .filter(r => r.isPastDue || r.hasScore)
    .reduce((sum, r) => sum + r.weight, 0);

  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  const unscoredWeight = totalWeight - scoredWeight;
  const maxFinalGrade = accumulatedGrade + unscoredWeight;

  return { rows, accumulatedGrade, achievableToDate, maxFinalGrade, totalWeight, scoredWeight };
}

export function renderStudentView(container) {
  const student = getCurrentUser();
  const enrollments = db.getEnrollmentsByStudent(student.id);
  const courses = enrollments.map(e => db.getCourse(e.courseId)).filter(Boolean);

  if (state.activeCourseId === null || !courses.some(c => c.id === state.activeCourseId)) {
    state.activeCourseId = courses.length ? courses[0].id : null;
    state.selectedItemIds = new Set();
  }

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <div class="eyebrow">Student workspace</div>
        <h2>${escapeHtml(student.name)}</h2>
      </div>
    </div>

    ${courses.length === 0 ? `
      <div class="panel text-center py-5 empty-state">
        <i class="bi bi-inboxes display-5"></i>
        <p class="mt-3 mb-0">You are not currently enrolled in any course.</p>
      </div>
    ` : `
      ${renderQwaSummary(student.id, courses)}

      <h5 class="mb-2"><i class="bi bi-grid-1x2 me-1"></i>My courses</h5>
      <div class="row g-3 mb-1" id="courseDashboard"></div>

      <div class="section-heading mt-4">
        <h4 class="mb-0">Course details</h4>
        <div style="min-width:280px;">
          <label class="form-label small mb-1" for="studentCourseSelect">Viewing course</label>
          <select class="form-select" id="studentCourseSelect">
            ${courses.map(c => `<option value="${c.id}" ${c.id === state.activeCourseId ? "selected" : ""}>${escapeHtml(c.code)} — ${escapeHtml(c.title)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div id="studentContent"></div>
    `}
  `;

  if (courses.length === 0) return;

  const selectCourse = (courseId) => {
    state.activeCourseId = courseId;
    state.selectedItemIds = new Set();
    renderStudentView(container);
  };

  container.querySelector("#studentCourseSelect").addEventListener("change", (e) => {
    selectCourse(Number(e.target.value));
  });

  renderCourseDashboard(container.querySelector("#courseDashboard"), student.id, courses, state.activeCourseId, selectCourse);
  renderStudentContent(container.querySelector("#studentContent"), student.id, state.activeCourseId);
}

/**
 * Overall QWA (Quality Weighted Average) across every enrolled course,
 * weighted by each course's credit units, with the CHED absence override
 * already baked into each course's grade before it's averaged.
 */
function renderQwaSummary(studentId, courses) {
  const { qwa, totalUnits } = computeOverallQWA(studentId, courses);
  if (qwa === null) return "";

  const passing = qwa <= 3.00;
  const toneClass = passing ? "kpi-success" : "kpi-danger";

  return `
    <div class="panel panel-accent-gold mb-3">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <div class="eyebrow mb-1">Overall standing across ${courses.length} course${courses.length > 1 ? "s" : ""} &middot; ${totalUnits} unit${totalUnits === 1 ? "" : "s"}</div>
          <h4 class="mb-0">Quality Weighted Average (QWA)</h4>
        </div>
        <div class="kpi-card ${toneClass}" style="min-width:180px;">
          <div class="kpi-label">${qwaDescription(qwa)}</div>
          <div class="kpi-value">${qwa.toFixed(2)}</div>
        </div>
      </div>
      <p class="required-note mt-2 mb-0">
        Computed as the unit-weighted average of each course's numerical grade equivalent (1.00 = Excellent, 3.00 = Lowest Passing Grade, 5.00 = Failure).
      </p>
    </div>
  `;
}

/**
 * "My courses" overview: one card per enrolled course showing the current
 * accumulated grade and CHED status at a glance. Clicking a card selects
 * that course in the detailed view below.
 */
function renderCourseDashboard(host, studentId, courses, activeCourseId, onSelect) {
  host.innerHTML = courses.map(c => {
    const summary = computeGradeSummary(studentId, c.id);
    const grade = getCourseFinalGrade(studentId, c.id, summary);
    const isActive = c.id === activeCourseId;

    return `
      <div class="col-6 col-lg-3">
        <div class="kpi-card course-dashboard-card ${isActive ? "active-course-card" : ""}" data-course-id="${c.id}" role="button" tabindex="0">
          <div class="kpi-label">${escapeHtml(c.code)} &middot; ${c.units ?? 3} unit${(c.units ?? 3) === 1 ? "" : "s"}</div>
          <div class="fw-semibold mb-2 text-truncate" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</div>
          <div class="d-flex justify-content-between align-items-end">
            <span class="kpi-value" style="font-size:1.4rem;">${summary.accumulatedGrade.toFixed(1)}%</span>
            <span class="grade-chip ${grade.isAbsenceFailure || grade.numerical >= 5 ? "grade-chip-fail" : (grade.numerical <= 3 ? "grade-chip-pass" : "")}">
              ${grade.numerical.toFixed(2)} &middot; ${escapeHtml(grade.letter)}
            </span>
          </div>
          ${grade.isAbsenceFailure ? `<span class="status-pill status-absent mt-2 d-inline-block">CHED 5.00 triggered</span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  host.querySelectorAll(".course-dashboard-card").forEach(card => {
    const activate = () => onSelect(Number(card.dataset.courseId));
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
  });
}

function renderStudentContent(root, studentId, courseId) {
  const course = db.getCourse(courseId);
  const summary = computeGradeSummary(studentId, courseId);
  const grade = getCourseFinalGrade(studentId, courseId, summary);
  const categories = db.getCategoriesByCourse(courseId);

  root.innerHTML = `
    ${renderKpiRow(summary, grade)}
    ${renderWarnings(studentId, courseId, summary)}

    <div class="panel panel-accent">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 class="mb-0"><i class="bi bi-table me-1"></i>Grade breakdown — ${escapeHtml(course.code)}</h5>
        <span class="grade-chip ${grade.isAbsenceFailure || grade.numerical >= 5 ? "grade-chip-fail" : (grade.numerical <= 3 ? "grade-chip-pass" : "")}">
          Current grade: ${grade.numerical.toFixed(2)} (${escapeHtml(grade.letter)}) &middot; ${escapeHtml(grade.description)}
        </span>
      </div>
      <div class="table-responsive-app">
        <table class="table table-app align-middle mb-0">
          <thead>
            <tr>
              <th>Category</th>
              <th>Assessment</th>
              <th>Due date</th>
              <th>Score</th>
              <th>Max pts</th>
              <th>Item weight</th>
              <th>Contribution to final</th>
            </tr>
          </thead>
          <tbody>
            ${summary.rows.map(r => {
              const catIdx = categories.findIndex(c => c.id === r.category.id);
              const rowClass = r.isMissed ? "row-critical" : (r.isDueSoon ? "row-flagged" : "");
              return `
                <tr class="${rowClass}">
                  <td><span class="category-chip cat-color-${catIdx % 5}"><span class="dot"></span>${escapeHtml(r.category.name)}</span></td>
                  <td>
                    ${escapeHtml(r.item.title)}
                    ${r.isMissed ? `<span class="status-pill status-overdue ms-1">Missed</span>` : ""}
                    ${r.isDueSoon ? `<span class="status-pill status-upcoming ms-1">Due soon</span>` : ""}
                  </td>
                  <td>${formatDate(r.item.dueDate)}</td>
                  <td>${r.hasScore ? r.score : `<span class="text-muted">—</span>`}</td>
                  <td>${r.item.maxPoints}</td>
                  <td>${r.weight.toFixed(2)}%</td>
                  <td>${r.hasScore ? r.contribution.toFixed(2) + "%" : `<span class="text-muted">—</span>`}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${renderCalculator(studentId, courseId, summary)}
  `;

  wireCalculator(root, studentId, courseId, summary, () => renderStudentContent(root, studentId, courseId));
}

function renderKpiRow(summary, grade) {
  return `
    <div class="row g-3 mb-1">
      <div class="col-6 col-lg-3">
        <div class="kpi-card">
          <div class="kpi-label">Total accumulated grade</div>
          <div class="kpi-value">${summary.accumulatedGrade.toFixed(2)}%</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="kpi-card">
          <div class="kpi-label">Total achievable grade to date</div>
          <div class="kpi-value">${summary.achievableToDate.toFixed(2)}%</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="kpi-card kpi-success">
          <div class="kpi-label">Max final grade still obtainable</div>
          <div class="kpi-value">${summary.maxFinalGrade.toFixed(2)}%</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="kpi-card ${grade.isAbsenceFailure ? "kpi-danger" : (grade.numerical <= 3.00 ? "kpi-success" : "kpi-danger")}">
          <div class="kpi-label">Numerical &amp; letter grade</div>
          <div class="kpi-value">${grade.numerical.toFixed(2)} <span class="fs-6 fw-semibold">(${escapeHtml(grade.letter)})</span></div>
          <div class="small text-muted">${escapeHtml(grade.description)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderWarnings(studentId, courseId, summary) {
  const course = db.getCourse(courseId);
  const warnings = [];

  // Due-date alerts (within 3 days)
  const dueSoon = summary.rows.filter(r => r.isDueSoon);
  if (dueSoon.length > 0) {
    warnings.push({
      level: "info",
      icon: "bi-alarm",
      text: `${dueSoon.length} assessment${dueSoon.length > 1 ? "s are" : " is"} due within ${DUE_SOON_DAYS} days: ${dueSoon.map(r => escapeHtml(r.item.title)).join(", ")}.`,
    });
  }

  // Missed activity warnings
  const missed = summary.rows.filter(r => r.isMissed);
  if (missed.length > 0) {
    warnings.push({
      level: "danger",
      icon: "bi-x-octagon",
      text: `${missed.length} past-due assessment${missed.length > 1 ? "s have" : " has"} no recorded submission: ${missed.map(r => escapeHtml(r.item.title)).join(", ")}.`,
    });
  }

  // CHED absence alert
  const absences = db.getAttendanceByCourseAndStudent(courseId, studentId).filter(a => a.status === "Absent").length;
  if (absences >= course.absenceThreshold) {
    warnings.push({
      level: "danger",
      icon: "bi-exclamation-octagon-fill",
      text: `CHED compliance breach: ${absences} of ${course.absenceThreshold} allowable absences reached. An automatic grade of 5.00 has been triggered for this course.`,
    });
  } else if (absences === course.absenceThreshold - 1) {
    warnings.push({
      level: "warning",
      icon: "bi-exclamation-triangle-fill",
      text: `CHED absence warning: you have ${absences} of ${course.absenceThreshold} allowable absences. One more absence will trigger an automatic 5.00.`,
    });
  }

  // Target feasibility (only if a target has been set)
  if (state.targetGrade !== "" && !isNaN(Number(state.targetGrade))) {
    const target = Number(state.targetGrade);
    const bestCase = summary.maxFinalGrade;
    if (target > bestCase) {
      warnings.push({
        level: "danger",
        icon: "bi-graph-down",
        text: `Your target of ${target.toFixed(2)}% is no longer mathematically achievable — the highest final grade you can still obtain is ${bestCase.toFixed(2)}%, even with a perfect score on everything remaining.`,
      });
    }
  }

  if (warnings.length === 0) {
    return `
      <div class="alert alert-success py-2 small mb-3">
        <i class="bi bi-check-circle me-1"></i>No active warnings for this course right now.
      </div>
    `;
  }

  const alertClass = { info: "alert-info", warning: "alert-warning", danger: "alert-danger" };
  return `
    <div class="mb-3">
      ${warnings.map(w => `
        <div class="alert ${alertClass[w.level]} py-2 small d-flex align-items-start gap-2 mb-2">
          <i class="bi ${w.icon} mt-1"></i>
          <div>${w.text}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCalculator(studentId, courseId, summary) {
  const uncompleted = summary.rows.filter(r => !r.hasScore);

  return `
    <div class="panel panel-accent-gold">
      <h5 class="mb-3"><i class="bi bi-calculator me-1"></i>Pass &amp; target strategy calculator</h5>
      ${uncompleted.length === 0 ? `
        <p class="empty-state mb-0">All assessments in this course already have recorded scores — there is nothing left to plan for.</p>
      ` : `
        <div class="row g-4">
          <div class="col-lg-5">
            <label class="form-label" for="targetGradeInput">Your custom target final grade (%)</label>
            <input type="number" class="form-control mb-3" id="targetGradeInput" min="0" max="100" step="0.1"
                   placeholder="e.g. 85" value="${escapeHtml(state.targetGrade)}">

            <label class="form-label">Select the uncompleted items to plan for</label>
            <div class="border rounded p-2" style="max-height:260px; overflow:auto;">
              ${uncompleted.map(r => `
                <div class="form-check calc-item-row">
                  <input class="form-check-input calc-item-checkbox" type="checkbox" value="${r.item.id}" id="calcItem${r.item.id}"
                         ${state.selectedItemIds.has(r.item.id) ? "checked" : ""}>
                  <label class="form-check-label" for="calcItem${r.item.id}">
                    ${escapeHtml(r.item.title)} <span class="text-muted small">(${r.weight.toFixed(2)}% weight, due ${formatDate(r.item.dueDate)})</span>
                  </label>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="col-lg-7">
            <div id="calcResults"></div>
          </div>
        </div>
      `}
    </div>
  `;
}

function wireCalculator(root, studentId, courseId, summary, onTargetCommitted) {
  const targetInput = root.querySelector("#targetGradeInput");
  if (!targetInput) return; // nothing uncompleted

  const checkboxes = root.querySelectorAll(".calc-item-checkbox");
  const resultsBox = root.querySelector("#calcResults");

  const recompute = () => {
    const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => Number(cb.value));
    state.selectedItemIds = new Set(selectedIds);

    const selectedRows = summary.rows.filter(r => selectedIds.includes(r.item.id));
    const selectedWeight = selectedRows.reduce((sum, r) => sum + r.weight, 0);
    const accumulated = summary.accumulatedGrade;

    resultsBox.innerHTML = renderCalcResults(accumulated, selectedWeight, selectedRows.length);
  };

  checkboxes.forEach(cb => cb.addEventListener("change", recompute));

  // Live-update the numbers as the student types, but only trigger a full
  // re-render (which refreshes the target-feasibility warning banner) once
  // they pause, so the input never loses focus mid-keystroke.
  let debounceHandle = null;
  targetInput.addEventListener("input", () => {
    state.targetGrade = targetInput.value;
    recompute();
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => {
      const caret = targetInput.selectionStart;
      onTargetCommitted();
      const freshInput = root.parentElement ? root.querySelector("#targetGradeInput") : null;
      if (freshInput) {
        freshInput.focus();
        try { freshInput.setSelectionRange(caret, caret); } catch (_) { /* ignore */ }
      }
    }, 600);
  });

  recompute();
}

function renderCalcResults(accumulated, selectedWeight, selectedCount) {
  if (selectedCount === 0) {
    return `<p class="empty-state">Select at least one uncompleted item to calculate required scores.</p>`;
  }
  if (selectedWeight === 0) {
    return `<div class="alert alert-warning py-2 small">Selected items currently carry no weight (their category may have no allocation).</div>`;
  }

  const passingReq = requiredUniformPercent(PASSING_GRADE, accumulated, selectedWeight);
  const target = Number(state.targetGrade);
  const hasTarget = state.targetGrade !== "" && !isNaN(target);
  const targetReq = hasTarget ? requiredUniformPercent(target, accumulated, selectedWeight) : null;

  const renderBlock = (label, req, goal) => {
    if (req === null) return "";
    let body;
    if (req.alreadyMet) {
      body = `<div class="alert alert-success py-2 small mb-0"><i class="bi bi-check-circle me-1"></i>Already secured — you've locked in enough from prior scores to reach ${goal.toFixed(2)}% even at 0% on the selected items.</div>`;
    } else if (req.impossible) {
      body = `<div class="alert alert-danger py-2 small mb-0"><i class="bi bi-x-octagon me-1"></i>Not mathematically possible: you would need ${req.percent.toFixed(1)}% on the selected items, which exceeds 100%.</div>`;
    } else {
      body = `
        <div class="kpi-card kpi-success d-inline-block px-4">
          <div class="kpi-label">Required uniform score</div>
          <div class="kpi-value">${req.percent.toFixed(1)}%</div>
        </div>
        <p class="required-note mt-2 mb-0">on each selected item, uniformly, to reach a final grade of ${goal.toFixed(2)}%.</p>
      `;
    }
    return `<div class="mb-4"><h6 class="mb-2">${label}</h6>${body}</div>`;
  };

  return `
    ${renderBlock(`Baseline passing mark (&gt;${PASSING_GRADE}%)`, passingReq, PASSING_GRADE)}
    ${hasTarget
      ? renderBlock(`Your custom target (${target.toFixed(2)}%)`, targetReq, target)
      : `<p class="required-note">Enter a target grade above to also see what's required to hit your own goal.</p>`}
  `;
}

/**
 * Solves for the uniform percentage p (0-100) needed on the selected items
 * (total weight = selectedWeight) so that:
 *   accumulated + (p/100) * selectedWeight  >=  goal
 * Returns { percent, alreadyMet, impossible }.
 */
function requiredUniformPercent(goal, accumulated, selectedWeight) {
  if (accumulated >= goal) {
    return { percent: 0, alreadyMet: true, impossible: false };
  }
  const percent = ((goal - accumulated) / selectedWeight) * 100;
  if (percent > 100) {
    return { percent, alreadyMet: false, impossible: true };
  }
  return { percent, alreadyMet: false, impossible: false };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
