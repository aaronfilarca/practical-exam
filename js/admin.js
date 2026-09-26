// ============================================================================
// admin.js
// Course Management, Faculty Allocation, and CHED Policy (absence threshold)
// for the Admin role.
// ============================================================================

import { db } from "./storage.js";
import { showAlert } from "./app.js";

// Which course is currently selected in the enrollment-management panel.
// Local UI state only — not persisted, resets on reload.
let selectedEnrollmentCourseId = null;

export function renderAdminView(container) {
  const professors = db.getUsersByRole("Professor");
  const courses = db.getCourses();

  if (selectedEnrollmentCourseId === null || !courses.some(c => c.id === selectedEnrollmentCourseId)) {
    selectedEnrollmentCourseId = courses.length ? courses[0].id : null;
  }

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <div class="eyebrow">Administrator workspace</div>
        <h2>Course &amp; CHED Policy Management</h2>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-5">
        <div class="panel panel-accent-gold">
          <h5 class="mb-3"><i class="bi bi-plus-circle me-1"></i>Create a course</h5>
          <form id="courseForm" novalidate>
            <div class="mb-3">
              <label class="form-label" for="courseCode">Course code</label>
              <input type="text" class="form-control" id="courseCode" placeholder="e.g. CS101" required>
              <div class="invalid-feedback">Course code is required.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="courseTitle">Course title</label>
              <input type="text" class="form-control" id="courseTitle" placeholder="e.g. Data Structures and Algorithms" required>
              <div class="invalid-feedback">Course title is required.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="courseProfessor">Assigned professor</label>
              <select class="form-select" id="courseProfessor" required>
                <option value="" selected disabled>Select a professor&hellip;</option>
                ${professors.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
              </select>
              <div class="invalid-feedback">A professor must be assigned to the course.</div>
            </div>
            <div class="row g-2">
              <div class="col-7">
                <label class="form-label" for="courseThreshold">
                  CHED absence threshold
                  <span class="text-muted small">(before an automatic 5.00)</span>
                </label>
                <input type="number" class="form-control" id="courseThreshold" min="1" max="20" value="3" required>
                <div class="invalid-feedback">Enter a whole number of at least 1.</div>
              </div>
              <div class="col-5 mb-3">
                <label class="form-label" for="courseUnits">Units</label>
                <input type="number" class="form-control" id="courseUnits" min="1" max="12" value="3" required>
                <div class="invalid-feedback">Enter a whole number of at least 1.</div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary w-100">
              <i class="bi bi-check2-circle me-1"></i>Create course
            </button>
          </form>
        </div>
      </div>

      <div class="col-lg-7">
        <div class="panel panel-accent">
          <h5 class="mb-3"><i class="bi bi-mortarboard me-1"></i>Courses &amp; CHED policy</h5>
          <div class="table-responsive-app">
            <table class="table table-app align-middle mb-0" id="coursesTable">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Assigned professor</th>
                  <th>Absence threshold</th>
                  <th>Units</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="coursesTableBody"></tbody>
            </table>
          </div>
          ${courses.length === 0 ? `<p class="empty-state text-center py-3 mb-0">No courses yet. Create one on the left.</p>` : ""}
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-12">
        <div class="panel panel-accent">
          <div class="section-heading">
            <h5 class="mb-0"><i class="bi bi-people me-1"></i>Enrollment management</h5>
            <div style="min-width:280px;">
              <select class="form-select form-select-sm" id="enrollmentCourseSelect" ${courses.length === 0 ? "disabled" : ""}>
                ${courses.length === 0
                  ? `<option value="">No courses available</option>`
                  : courses.map(c => `<option value="${c.id}" ${c.id === selectedEnrollmentCourseId ? "selected" : ""}>${escapeHtml(c.code)} — ${escapeHtml(c.title)}</option>`).join("")
                }
              </select>
            </div>
          </div>
          <div id="enrollmentPanelBody">
            ${courses.length === 0 ? `<p class="empty-state text-center py-3 mb-0">Create a course first to manage its roster.</p>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;

  renderCoursesTable(container);
  wireCourseForm(container);

  if (courses.length > 0) {
    container.querySelector("#enrollmentCourseSelect").addEventListener("change", (e) => {
      selectedEnrollmentCourseId = Number(e.target.value);
      renderEnrollmentPanel(container);
    });
    renderEnrollmentPanel(container);
  }
}

function renderEnrollmentPanel(container) {
  const body = container.querySelector("#enrollmentPanelBody");
  const courseId = selectedEnrollmentCourseId;
  if (!courseId) return;

  const enrolledStudents = db.getStudentsForCourse(courseId);
  const allStudents = db.getUsersByRole("Student");
  const notEnrolled = allStudents.filter(s => !enrolledStudents.some(e => e.id === s.id));

  body.innerHTML = `
    <div class="row g-4">
      <div class="col-md-6">
        <h6 class="mb-2">Enrolled students (${enrolledStudents.length})</h6>
        ${enrolledStudents.length === 0 ? `<p class="empty-state small">No students enrolled yet.</p>` : `
          <ul class="list-group">
            ${enrolledStudents.map(s => `
              <li class="list-group-item d-flex justify-content-between align-items-center">
                ${escapeHtml(s.name)}
                <button class="btn btn-sm btn-outline-danger remove-enrollment" data-student-id="${s.id}" title="Remove from course">
                  <i class="bi bi-person-dash"></i>
                </button>
              </li>
            `).join("")}
          </ul>
        `}
      </div>
      <div class="col-md-6">
        <h6 class="mb-2">Enroll a student</h6>
        ${notEnrolled.length === 0 ? `
          <p class="empty-state small">All students are already enrolled in this course.</p>
        ` : `
          <div class="input-group">
            <select class="form-select" id="enrollStudentSelect">
              ${notEnrolled.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
            </select>
            <button class="btn btn-primary" id="enrollStudentBtn">
              <i class="bi bi-person-plus me-1"></i>Enroll
            </button>
          </div>
        `}
      </div>
    </div>
  `;

  body.querySelectorAll(".remove-enrollment").forEach(btn => {
    btn.addEventListener("click", () => {
      const studentId = Number(btn.dataset.studentId);
      const enrollment = db.getEnrollmentsByCourse(courseId).find(e => e.studentId === studentId);
      if (!enrollment) return;
      const student = db.getUser(studentId);
      if (!confirm(`Remove ${student.name} from this course? Their existing scores and attendance records will be kept but hidden.`)) return;
      db.removeEnrollment(enrollment.id);
      showAlert("success", `${escapeHtml(student.name)} removed from the course.`);
      renderEnrollmentPanel(container);
    });
  });

  const enrollBtn = body.querySelector("#enrollStudentBtn");
  if (enrollBtn) {
    enrollBtn.addEventListener("click", () => {
      const studentId = body.querySelector("#enrollStudentSelect").value;
      const student = db.getUser(Number(studentId));
      db.addEnrollment({ studentId, courseId });
      showAlert("success", `${escapeHtml(student.name)} enrolled successfully.`);
      renderEnrollmentPanel(container);
    });
  }
}

function renderCoursesTable(container) {
  const tbody = container.querySelector("#coursesTableBody");
  const courses = db.getCourses();

  tbody.innerHTML = courses.map(c => {
    const prof = db.getUser(c.professorId);
    return `
      <tr data-course-id="${c.id}">
        <td><span class="fw-semibold">${escapeHtml(c.code)}</span></td>
        <td>${escapeHtml(c.title)}</td>
        <td>
          <select class="form-select form-select-sm reassign-professor" data-course-id="${c.id}">
            ${db.getUsersByRole("Professor").map(p => `
              <option value="${p.id}" ${p.id === c.professorId ? "selected" : ""}>${escapeHtml(p.name)}</option>
            `).join("")}
          </select>
        </td>
        <td style="max-width:160px;">
          <div class="input-group input-group-sm">
            <input type="number" min="1" max="20" class="form-control threshold-input" data-course-id="${c.id}" value="${c.absenceThreshold}">
            <span class="input-group-text">absences</span>
          </div>
        </td>
        <td style="max-width:100px;">
          <input type="number" min="1" max="12" class="form-control form-control-sm units-input" data-course-id="${c.id}" value="${c.units ?? 3}">
        </td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-danger delete-course" data-course-id="${c.id}" title="Delete course">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".delete-course").forEach(btn => {
    btn.addEventListener("click", () => {
      const courseId = Number(btn.dataset.courseId);
      const course = db.getCourse(courseId);
      if (!confirm(`Delete course "${course.code} — ${course.title}"? This permanently removes its syllabus, assessment items, scores, attendance records, and enrollments. This cannot be undone.`)) return;
      db.deleteCourse(courseId);
      showAlert("success", `Course "${escapeHtml(course.code)}" deleted.`);
      renderAdminView(container);
    });
  });

  tbody.querySelectorAll(".reassign-professor").forEach(sel => {
    sel.addEventListener("change", () => {
      const courseId = Number(sel.dataset.courseId);
      db.updateCourse(courseId, { professorId: Number(sel.value) });
      showAlert("success", "Faculty allocation updated.");
      renderCoursesTable(container);
    });
  });

  tbody.querySelectorAll(".threshold-input").forEach(input => {
    input.addEventListener("change", () => {
      const courseId = Number(input.dataset.courseId);
      let value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1) {
        showAlert("danger", "Absence threshold must be a whole number of at least 1.");
        const course = db.getCourse(courseId);
        input.value = course.absenceThreshold;
        return;
      }
      db.updateCourse(courseId, { absenceThreshold: value });
      showAlert("success", "CHED absence threshold updated for this course.");
    });
  });

  tbody.querySelectorAll(".units-input").forEach(input => {
    input.addEventListener("change", () => {
      const courseId = Number(input.dataset.courseId);
      let value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1) {
        showAlert("danger", "Units must be a whole number of at least 1.");
        const course = db.getCourse(courseId);
        input.value = course.units ?? 3;
        return;
      }
      db.updateCourse(courseId, { units: value });
      showAlert("success", "Course units updated. This will affect each student's overall QWA.");
    });
  });
}

function wireCourseForm(container) {
  const form = container.querySelector("#courseForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const code = container.querySelector("#courseCode").value.trim();
    const title = container.querySelector("#courseTitle").value.trim();
    const professorId = container.querySelector("#courseProfessor").value;
    const threshold = container.querySelector("#courseThreshold").value;
    const units = container.querySelector("#courseUnits").value;

    let valid = true;
    if (!code) { markInvalid(container, "#courseCode"); valid = false; } else { markValid(container, "#courseCode"); }
    if (!title) { markInvalid(container, "#courseTitle"); valid = false; } else { markValid(container, "#courseTitle"); }
    if (!professorId) { markInvalid(container, "#courseProfessor"); valid = false; } else { markValid(container, "#courseProfessor"); }
    if (!threshold || Number(threshold) < 1 || !Number.isInteger(Number(threshold))) {
      markInvalid(container, "#courseThreshold"); valid = false;
    } else { markValid(container, "#courseThreshold"); }
    if (!units || Number(units) < 1 || !Number.isInteger(Number(units))) {
      markInvalid(container, "#courseUnits"); valid = false;
    } else { markValid(container, "#courseUnits"); }

    if (!valid) {
      showAlert("danger", "Please correct the highlighted fields before creating the course.");
      return;
    }

    db.addCourse({ code, title, professorId, absenceThreshold: threshold, units });
    showAlert("success", `Course "${escapeHtml(code)}" created and assigned successfully.`);
    renderAdminView(container);
  });
}

function markInvalid(container, selector) {
  const el = container.querySelector(selector);
  el.classList.add("is-invalid");
  el.classList.remove("is-valid");
}
function markValid(container, selector) {
  const el = container.querySelector(selector);
  el.classList.remove("is-invalid");
  el.classList.add("is-valid");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
