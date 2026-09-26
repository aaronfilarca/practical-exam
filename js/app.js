// ============================================================================
// app.js
// Main router and application bootstrap. Wires together storage, auth, and
// the three role-specific view modules.
// ============================================================================

import { initStorage, resetData } from "./storage.js";
import { getSession, renderQuickSwitchBar, renderCurrentUserBadge } from "./auth.js";
import { renderAdminView } from "./admin.js";
import { renderProfessorView } from "./professor.js";
import { renderStudentView } from "./student.js";

const appContent = document.getElementById("app-content");
const alertZone = document.getElementById("globalAlertZone");

/**
 * Renders a dismissible Bootstrap alert into the global alert zone.
 * Exported so feature modules can surface success/validation feedback
 * without each one re-implementing alert markup.
 */
let currentAlertTimeout = null;

export function showAlert(type, message, timeout = 4000) {
  const icons = {
    success: "bi-check-circle",
    danger: "bi-exclamation-octagon",
    warning: "bi-exclamation-triangle",
    info: "bi-info-circle",
  };

  // Only one alert is ever shown at a time: clear whatever is there
  // (and its pending auto-dismiss) before showing the new one.
  clearTimeout(currentAlertTimeout);
  alertZone.innerHTML = "";

  const el = document.createElement("div");
  el.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
  el.role = "alert";
  el.innerHTML = `
    <i class="bi ${icons[type] || "bi-info-circle"} me-2"></i>${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  alertZone.appendChild(el);

  if (timeout) {
    currentAlertTimeout = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 200);
    }, timeout);
  }
}

/**
 * Central router: decides what to render in #app-content based on the
 * active session's role. Re-run whenever the session changes.
 */
function route() {
  const session = getSession();
  renderCurrentUserBadge();

  if (!session) {
    appContent.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-mortarboard display-3 text-muted"></i>
        <h3 class="mt-3">Welcome</h3>
        <p class="text-muted">Use the quick-switch bar above to sign in as an Admin, Professor, or Student and explore the system.</p>
      </div>
    `;
    return;
  }

  switch (session.role) {
    case "Admin":
      renderAdminView(appContent);
      break;
    case "Professor":
      renderProfessorView(appContent);
      break;
    case "Student":
      renderStudentView(appContent);
      break;
    default:
      appContent.innerHTML = `<div class="alert alert-danger">Unknown role: ${session.role}</div>`;
  }
}

function bootstrap() {
  initStorage();
  renderQuickSwitchBar({ onSwitch: route });
  route();

  document.getElementById("resetDataBtn").addEventListener("click", () => {
    if (!confirm("Reset ALL demo data (courses, grades, attendance, sessions) back to the original seeded state?")) return;
    resetData();
    renderQuickSwitchBar({ onSwitch: route });
    route();
    showAlert("info", "Demo data has been reset to its original seeded state.");
  });
}

document.addEventListener("DOMContentLoaded", bootstrap);
