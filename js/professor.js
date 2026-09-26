// ============================================================================
// professor.js
// Restricted course view, syllabus weighting, item breakdown, score entry,
// attendance, and multi-variable search for the Professor role.
// ============================================================================

import { db, todayISO, formatDate } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { showAlert } from "./app.js";

// Local UI state (which course/tab is active) — not persisted, resets on reload.
const state = {
  activeCourseId: null,
  activeTab: "syllabus",
  search: { categoryName: "", itemName: "", minPercent: "", maxPercent: "", sortBy: "date" },
};

/**
 * Each item's individual weight = its category's weight / number of items
 * currently in that category. If a category has zero items, its weight is
 * simply unallocated until an item is added.
 */
function itemWeight(item) {
  const siblings = db.getItemsByCategory(item.categoryId);
  const category = db.getCategory(item.categoryId);
  if (!category || siblings.length === 0) return 0;
  return category.weight / siblings.length;
}

export function renderProfessorView(container) {
  const professor = getCurrentUser();
  const courses = db.getCoursesByProfessor(professor.id); // STRICT scope restriction

  if (state.activeCourseId === null || !courses.some(c => c.id === state.activeCourseId)) {
    state.activeCourseId = courses.length ? courses[0].id : null;
  }

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <div class="eyebrow">Professor workspace</div>
        <h2>${escapeHtml(professor.name)}</h2>
        <p class="course-scope-note mb-0">
          <i class="bi bi-shield-check"></i> You can only see and manage courses assigned to you.
        </p>
      </div>
      <div style="min-width:280px;">
        <label class="form-label small mb-1" for="profCourseSelect">Course</label>
        <select class="form-select" id="profCourseSelect">
          ${courses.length === 0
            ? `<option value="">No courses assigned</option>`
            : courses.map(c => `<option value="${c.id}" ${c.id === state.activeCourseId ? "selected" : ""}>${escapeHtml(c.code)} — ${escapeHtml(c.title)}</option>`).join("")
          }
        </select>
      </div>
    </div>

    ${courses.length === 0 ? `
      <div class="panel text-center py-5 empty-state">
        <i class="bi bi-inboxes display-5"></i>
        <p class="mt-3 mb-0">No courses have been assigned to you yet. Ask an administrator to allocate one.</p>
      </div>
    ` : `
      <ul class="nav nav-tabs mb-3" id="profTabs">
        <li class="nav-item"><button class="nav-link ${state.activeTab === "syllabus" ? "active" : ""}" data-tab="syllabus"><i class="bi bi-clipboard-data me-1"></i>Syllabus</button></li>
        <li class="nav-item"><button class="nav-link ${state.activeTab === "assessment" ? "active" : ""}" data-tab="assessment"><i class="bi bi-list-check me-1"></i>Assessment &amp; Grades</button></li>
        <li class="nav-item"><button class="nav-link ${state.activeTab === "attendance" ? "active" : ""}" data-tab="attendance"><i class="bi bi-calendar-check me-1"></i>Attendance</button></li>
      </ul>
      <div id="profTabContent"></div>
    `}
  `;

  if (courses.length === 0) return;

  container.querySelector("#profCourseSelect").addEventListener("change", (e) => {
    state.activeCourseId = Number(e.target.value);
    renderProfessorView(container);
  });

  container.querySelectorAll("#profTabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      renderProfessorView(container);
    });
  });

  const tabContent = container.querySelector("#profTabContent");
  if (state.activeTab === "syllabus") renderSyllabusTab(tabContent);
  if (state.activeTab === "assessment") renderAssessmentTab(tabContent);
  if (state.activeTab === "attendance") renderAttendanceTab(tabContent);
}

/* ========================================================================
 * TAB 1 — Syllabus: categories + weight validation
 * ===================================================================== */
function renderSyllabusTab(root) {
  const courseId = state.activeCourseId;
  const categories = db.getCategoriesByCourse(courseId);
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const isBalanced = totalWeight === 100;

  root.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-5">
        <div class="panel panel-accent-gold">
          <h5 class="mb-3"><i class="bi bi-plus-circle me-1"></i>Add syllabus category</h5>
          <form id="categoryForm" novalidate>
            <div class="mb-3">
              <label class="form-label" for="categoryName">Category name</label>
              <input type="text" class="form-control" id="categoryName" placeholder="e.g. Quizzes" required>
              <div class="invalid-feedback">Category name is required.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="categoryWeight">Weight (%)</label>
              <input type="number" class="form-control" id="categoryWeight" min="1" max="100" placeholder="e.g. 30" required>
              <div class="invalid-feedback">Enter a weight between 1 and 100.</div>
            </div>
            <button type="submit" class="btn btn-primary w-100" ${isBalanced ? "disabled" : ""}>
              <i class="bi bi-check2-circle me-1"></i>Add category
            </button>
            ${isBalanced ? `<div class="required-note mt-2">Weights already total 100% — delete a category to add another.</div>` : ""}
          </form>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="panel panel-accent">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="mb-0"><i class="bi bi-pie-chart me-1"></i>Category weights</h5>
            <span class="badge ${isBalanced ? "text-bg-success" : "text-bg-warning"}">
              ${totalWeight}% of 100%
            </span>
          </div>
          <div class="weight-track mb-3">
            <div class="weight-fill ${isBalanced ? "ok" : (totalWeight > 100 ? "over" : "")}" style="width:${Math.min(totalWeight, 100)}%"></div>
          </div>
          ${!isBalanced ? `
            <div class="alert ${totalWeight > 100 ? "alert-danger" : "alert-warning"} py-2 small">
              <i class="bi bi-exclamation-triangle me-1"></i>
              ${totalWeight > 100
                ? `Category weights exceed 100% by ${totalWeight - 100} points. Remove or reduce a category.`
                : `Category weights must total exactly 100% before grades can be trusted. Currently short by ${100 - totalWeight} points.`}
            </div>
          ` : `
            <div class="alert alert-success py-2 small">
              <i class="bi bi-check-circle me-1"></i>Weights are balanced at exactly 100%.
            </div>
          `}

          ${categories.length === 0 ? `<p class="empty-state text-center py-3 mb-0">No categories yet.</p>` : `
            <ul class="list-group">
              ${categories.map((c, idx) => {
                const itemCount = db.getItemsByCategory(c.id).length;
                return `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <span class="category-chip cat-color-${idx % 5}"><span class="dot"></span>${escapeHtml(c.name)}</span>
                    <span class="text-muted small ms-2">${itemCount} item${itemCount === 1 ? "" : "s"}</span>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <span class="fw-semibold">${c.weight}%</span>
                    <button class="btn btn-sm btn-outline-danger delete-category" data-id="${c.id}" title="Delete category">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </li>`;
              }).join("")}
            </ul>
          `}
        </div>
      </div>
    </div>
  `;

  root.querySelector("#categoryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = root.querySelector("#categoryName");
    const weightInput = root.querySelector("#categoryWeight");
    const name = nameInput.value.trim();
    const weight = Number(weightInput.value);

    let valid = true;
    if (!name) { nameInput.classList.add("is-invalid"); valid = false; } else { nameInput.classList.remove("is-invalid"); }
    if (!weight || weight < 1 || weight > 100) { weightInput.classList.add("is-invalid"); valid = false; } else { weightInput.classList.remove("is-invalid"); }

    if (!valid) { showAlert("danger", "Please correct the highlighted fields."); return; }

    const prospectiveTotal = totalWeight + weight;
    if (prospectiveTotal > 100) {
      showAlert("danger", `Adding ${weight}% would bring the total to ${prospectiveTotal}%, exceeding 100%.`);
      weightInput.classList.add("is-invalid");
      return;
    }

    db.addCategory({ courseId, name, weight });
    showAlert("success", `Category "${escapeHtml(name)}" added.`);
    renderSyllabusTab(root);
  });

  root.querySelectorAll(".delete-category").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const cat = db.getCategory(id);
      if (!confirm(`Delete category "${cat.name}"? This will also delete all of its assessment items and scores.`)) return;
      db.deleteCategory(id);
      showAlert("success", "Category deleted.");
      renderSyllabusTab(root);
    });
  });
}

/* ========================================================================
 * TAB 2 — Assessment items, grade entry, and multi-parameter search/sort
 * ===================================================================== */
function renderAssessmentTab(root) {
  const courseId = state.activeCourseId;
  const categories = db.getCategoriesByCourse(courseId);
  const students = db.getStudentsForCourse(courseId);

  root.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="panel panel-accent-gold">
          <h5 class="mb-3"><i class="bi bi-plus-circle me-1"></i>Add assessment item</h5>
          ${categories.length === 0 ? `
            <p class="empty-state small mb-0">Add at least one syllabus category first.</p>
          ` : `
          <form id="itemForm" novalidate>
            <div class="mb-3">
              <label class="form-label" for="itemTitle">Item title</label>
              <input type="text" class="form-control" id="itemTitle" placeholder="e.g. Quiz 4 - Graphs" required>
              <div class="invalid-feedback">Title is required.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="itemCategory">Category</label>
              <select class="form-select" id="itemCategory" required>
                ${categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.weight}%)</option>`).join("")}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label" for="itemDueDate">Due date</label>
              <input type="date" class="form-control" id="itemDueDate" required>
              <div class="invalid-feedback">Due date is required.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="itemMaxPoints">Max points</label>
              <input type="number" class="form-control" id="itemMaxPoints" min="1" step="0.5" placeholder="e.g. 20" required>
              <div class="invalid-feedback">Enter a positive number.</div>
            </div>
            <button type="submit" class="btn btn-primary w-100">
              <i class="bi bi-check2-circle me-1"></i>Add item
            </button>
            <div class="required-note mt-2">
              The category's weight is split evenly across all its items automatically.
            </div>
          </form>
          `}
        </div>
      </div>

      <div class="col-lg-8">
        <div class="panel panel-accent">
          <h5 class="mb-3"><i class="bi bi-search me-1"></i>Search &amp; filter items</h5>
          <div class="row g-2 filter-bar mb-3">
            <div class="col-6 col-md-3">
              <input type="text" class="form-control form-control-sm" id="filterCategoryName" placeholder="Category name">
            </div>
            <div class="col-6 col-md-3">
              <input type="text" class="form-control form-control-sm" id="filterItemName" placeholder="Item name">
            </div>
            <div class="col-6 col-md-2">
              <input type="number" class="form-control form-control-sm" id="filterMinPercent" placeholder="Min weight %">
            </div>
            <div class="col-6 col-md-2">
              <input type="number" class="form-control form-control-sm" id="filterMaxPercent" placeholder="Max weight %">
            </div>
            <div class="col-6 col-md-2">
              <select class="form-select form-select-sm" id="sortBy">
                <option value="date">Sort: Due date</option>
                <option value="score">Sort: Avg. score %</option>
                <option value="category">Sort: Category</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          </div>

          <div class="table-responsive-app">
            <table class="table table-app align-middle mb-0" id="itemsTable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Due date</th>
                  <th>Max pts</th>
                  <th>Item weight</th>
                  <th>Class avg.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="itemsTableBody"></tbody>
            </table>
          </div>
        </div>

        <div class="panel panel-accent" id="scoreEntryPanel" style="display:none;">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0"><i class="bi bi-pencil-square me-1"></i>Score entry — <span id="scoreEntryItemTitle"></span></h5>
            <button class="btn btn-sm btn-outline-secondary" id="closeScoreEntry"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="table-responsive-app">
            <table class="table table-app align-middle mb-0">
              <thead><tr><th>Student</th><th style="width:180px;">Score</th><th>Percent</th></tr></thead>
              <tbody id="scoreEntryBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  if (categories.length > 0) wireItemForm(root, courseId);
  wireFilterBar(root, courseId, students);
  renderItemsTable(root, courseId, students);
}

function wireItemForm(root, courseId) {
  root.querySelector("#itemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const titleInput = root.querySelector("#itemTitle");
    const categorySelect = root.querySelector("#itemCategory");
    const dueDateInput = root.querySelector("#itemDueDate");
    const maxPointsInput = root.querySelector("#itemMaxPoints");

    const title = titleInput.value.trim();
    const categoryId = categorySelect.value;
    const dueDate = dueDateInput.value;
    const maxPoints = Number(maxPointsInput.value);

    let valid = true;
    [
      [titleInput, !!title],
      [dueDateInput, !!dueDate],
      [maxPointsInput, maxPoints > 0],
    ].forEach(([el, ok]) => {
      el.classList.toggle("is-invalid", !ok);
      if (!ok) valid = false;
    });

    if (!valid) { showAlert("danger", "Please correct the highlighted fields."); return; }

    db.addItem({ courseId, categoryId, title, dueDate, maxPoints });
    showAlert("success", `Item "${escapeHtml(title)}" added.`);
    renderAssessmentTab(root.closest("#profTabContent"));
  });
}

function wireFilterBar(root, courseId, students) {
  const inputs = ["filterCategoryName", "filterItemName", "filterMinPercent", "filterMaxPercent", "sortBy"];
  inputs.forEach(id => {
    const el = root.querySelector("#" + id);
    el.addEventListener("input", () => {
      state.search.categoryName = root.querySelector("#filterCategoryName").value.trim().toLowerCase();
      state.search.itemName = root.querySelector("#filterItemName").value.trim().toLowerCase();
      state.search.minPercent = root.querySelector("#filterMinPercent").value;
      state.search.maxPercent = root.querySelector("#filterMaxPercent").value;
      state.search.sortBy = root.querySelector("#sortBy").value;
      renderItemsTable(root, courseId, students);
    });
  });
  // restore previous filter state (persists while switching tabs, resets on course change)
  root.querySelector("#filterCategoryName").value = state.search.categoryName;
  root.querySelector("#filterItemName").value = state.search.itemName;
  root.querySelector("#filterMinPercent").value = state.search.minPercent;
  root.querySelector("#filterMaxPercent").value = state.search.maxPercent;
  root.querySelector("#sortBy").value = state.search.sortBy;
}

function renderItemsTable(root, courseId, students) {
  let items = db.getItemsByCourse(courseId);

  // ---- multi-parameter filtering ----
  items = items.filter(item => {
    const category = db.getCategory(item.categoryId);
    const weight = itemWeight(item);

    if (state.search.categoryName && !category.name.toLowerCase().includes(state.search.categoryName)) return false;
    if (state.search.itemName && !item.title.toLowerCase().includes(state.search.itemName)) return false;
    if (state.search.minPercent !== "" && weight < Number(state.search.minPercent)) return false;
    if (state.search.maxPercent !== "" && weight > Number(state.search.maxPercent)) return false;
    return true;
  });

  // ---- sorting ----
  const classAverage = (item) => {
    const scores = db.getScoresByItem(item.id);
    if (scores.length === 0) return -1; // ungraded items sort last on "score"
    const avgPct = scores.reduce((s, r) => s + (r.score / item.maxPoints) * 100, 0) / scores.length;
    return avgPct;
  };

  items.sort((a, b) => {
    switch (state.search.sortBy) {
      case "score": return classAverage(b) - classAverage(a);
      case "category": return db.getCategory(a.categoryId).name.localeCompare(db.getCategory(b.categoryId).name);
      case "title": return a.title.localeCompare(b.title);
      case "date":
      default: return new Date(a.dueDate) - new Date(b.dueDate);
    }
  });

  const tbody = root.querySelector("#itemsTableBody");

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center empty-state py-4">No items match your filters.</td></tr>`;
    return;
  }

  const categories = db.getCategoriesByCourse(courseId);

  tbody.innerHTML = items.map(item => {
    const category = db.getCategory(item.categoryId);
    const catIdx = categories.findIndex(c => c.id === category.id);
    const weight = itemWeight(item);
    const avg = classAverage(item);
    return `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td><span class="category-chip cat-color-${catIdx % 5}"><span class="dot"></span>${escapeHtml(category.name)}</span></td>
        <td>${formatDate(item.dueDate)}</td>
        <td>${item.maxPoints}</td>
        <td>${weight.toFixed(2)}%</td>
        <td>${avg < 0 ? `<span class="text-muted">No scores</span>` : avg.toFixed(1) + "%"}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-primary enter-scores" data-id="${item.id}"><i class="bi bi-pencil-square"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-item" data-id="${item.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".delete-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const item = db.getItem(id);
      if (!confirm(`Delete item "${item.title}"? All recorded scores for it will be lost.`)) return;
      db.deleteItem(id);
      showAlert("success", "Item deleted.");
      renderAssessmentTab(root.closest("#profTabContent"));
    });
  });

  tbody.querySelectorAll(".enter-scores").forEach(btn => {
    btn.addEventListener("click", () => {
      openScoreEntry(root, Number(btn.dataset.id), students);
    });
  });
}

function openScoreEntry(root, itemId, students) {
  const item = db.getItem(itemId);
  const panel = root.querySelector("#scoreEntryPanel");
  panel.style.display = "block";
  root.querySelector("#scoreEntryItemTitle").textContent = `${item.title} (max ${item.maxPoints} pts)`;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const body = root.querySelector("#scoreEntryBody");
  body.innerHTML = students.map(s => {
    const record = db.getScore(itemId, s.id);
    const val = record && record.score !== null && record.score !== undefined ? record.score : "";
    return `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>
          <input type="number" class="form-control form-control-sm score-input" min="0" max="${item.maxPoints}" step="0.5"
                 data-student-id="${s.id}" value="${val}" placeholder="—">
        </td>
        <td class="score-percent text-muted">${val !== "" ? ((val / item.maxPoints) * 100).toFixed(1) + "%" : "—"}</td>
      </tr>
    `;
  }).join("");

  body.querySelectorAll(".score-input").forEach(input => {
    const commit = () => {
      const raw = input.value;
      const studentId = Number(input.dataset.studentId);
      const percentCell = input.closest("tr").querySelector(".score-percent");

      if (raw === "") {
        input.classList.remove("is-invalid");
        percentCell.textContent = "—";
        return;
      }

      const score = Number(raw);
      if (isNaN(score) || score < 0 || score > item.maxPoints) {
        input.classList.add("is-invalid");
        showAlert("danger", `Score must be between 0 and ${item.maxPoints}.`);
        return;
      }
      input.classList.remove("is-invalid");
      db.upsertScore({ itemId, studentId, score });
      percentCell.textContent = ((score / item.maxPoints) * 100).toFixed(1) + "%";
    };
    input.addEventListener("change", commit);
  });

  root.querySelector("#closeScoreEntry").onclick = () => {
    panel.style.display = "none";
    renderItemsTable(root, item.courseId, students);
  };
}

/* ========================================================================
 * TAB 3 — Attendance tracker (CHED compliance only, never affects grade calc)
 * ===================================================================== */
function renderAttendanceTab(root) {
  const courseId = state.activeCourseId;
  const course = db.getCourse(courseId);
  const students = db.getStudentsForCourse(courseId);
  const selectedDate = root._selectedDate || todayISO();

  root.innerHTML = `
    <div class="panel panel-accent">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 class="mb-0"><i class="bi bi-calendar-check me-1"></i>Attendance — ${escapeHtml(course.code)}</h5>
        <div class="d-flex align-items-center gap-2">
          <label class="small text-muted mb-0" for="attendanceDate">Session date</label>
          <input type="date" class="form-control form-control-sm" id="attendanceDate" value="${selectedDate}" style="width:auto;">
        </div>
      </div>
      <p class="course-scope-note">
        <i class="bi bi-info-circle"></i> Attendance is tracked for CHED compliance only and never factors into the final academic grade.
        Allowable absences for this course: <strong>${course.absenceThreshold}</strong>.
      </p>

      <div class="table-responsive-app">
        <table class="table table-app align-middle mb-0">
          <thead><tr><th>Student</th><th>Status for this date</th><th>Total absences (course)</th></tr></thead>
          <tbody id="attendanceBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const dateInput = root.querySelector("#attendanceDate");
  dateInput.addEventListener("change", () => {
    root._selectedDate = dateInput.value;
    renderAttendanceTab(root);
  });

  const body = root.querySelector("#attendanceBody");
  body.innerHTML = students.map(s => {
    const record = db.getAttendanceForDate(courseId, dateInput.value).find(a => a.studentId === s.id);
    const totalAbsences = db.getAttendanceByCourseAndStudent(courseId, s.id).filter(a => a.status === "Absent").length;
    const breach = totalAbsences >= course.absenceThreshold;
    return `
      <tr class="${breach ? "row-critical" : ""}">
        <td>${escapeHtml(s.name)}</td>
        <td>
          <div class="btn-group btn-group-sm attendance-toggle" data-student-id="${s.id}">
            <button class="btn btn-outline-success ${record?.status === "Present" ? "active" : ""}" data-status="Present">Present</button>
            <button class="btn btn-outline-danger ${record?.status === "Absent" ? "active" : ""}" data-status="Absent">Absent</button>
            <button class="btn btn-outline-warning ${record?.status === "Excused" ? "active" : ""}" data-status="Excused">Excused</button>
          </div>
        </td>
        <td>
          <span class="fw-semibold ${breach ? "text-danger" : ""}">${totalAbsences}</span> / ${course.absenceThreshold}
          ${breach ? `<span class="status-pill status-absent ms-2">CHED 5.00 triggered</span>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  body.querySelectorAll(".attendance-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".attendance-toggle");
      const studentId = Number(group.dataset.studentId);
      db.upsertAttendance({ courseId, studentId, date: dateInput.value, status: btn.dataset.status });
      showAlert("success", "Attendance recorded.");
      renderAttendanceTab(root);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
