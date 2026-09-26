// ============================================================================
// auth.js
// Role management, quick-switch demo login, session state, navigation guards.
// This is a DEMO auth layer: there are no passwords, only role + user selection,
// matching the brief's "quick-switch demo login" requirement.
// ============================================================================

import { db, readSession, writeSession } from "./storage.js";

export const ROLES = ["Admin", "Professor", "Student"];

/**
 * Returns the currently active session: { role, userId } or null.
 */
export function getSession() {
  return readSession();
}

/**
 * Logs in as a specific user. The role is derived from the user record so a
 * caller can never mismatch a user with the wrong role.
 */
export function loginAs(userId) {
  const user = db.getUser(Number(userId));
  if (!user) throw new Error("Unknown user id: " + userId);
  const session = { role: user.role, userId: user.id };
  writeSession(session);
  return session;
}

export function logout() {
  writeSession(null);
}

/**
 * Convenience accessor: full user record for the active session, or null.
 */
export function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return db.getUser(session.userId);
}

/**
 * Navigation guard. Call at the top of any route handler that requires a
 * specific role. Returns true if allowed, false (and redirects) otherwise.
 */
export function requireRole(role) {
  const session = getSession();
  if (!session || session.role !== role) {
    return false;
  }
  // Defensive check: the underlying user record must still exist.
  const user = db.getUser(session.userId);
  if (!user) {
    logout();
    return false;
  }
  return true;
}

/**
 * Populates the three quick-switch dropdowns in the navbar and wires the
 * reset-data button. Called once on app bootstrap and again after a reset.
 */
export function renderQuickSwitchBar({ onSwitch }) {
  const adminMenu = document.getElementById("adminSwitchMenu");
  const profMenu = document.getElementById("profSwitchMenu");
  const studentMenu = document.getElementById("studentSwitchMenu");

  const fill = (menuEl, users) => {
    menuEl.innerHTML = users.map(u => `
      <li><button class="dropdown-item quick-switch-option" type="button" data-user-id="${u.id}">
        ${escapeHtml(u.name)}
      </button></li>
    `).join("") || `<li><span class="dropdown-item-text text-muted small">No accounts</span></li>`;
  };

  fill(adminMenu, db.getUsersByRole("Admin"));
  fill(profMenu, db.getUsersByRole("Professor"));
  fill(studentMenu, db.getUsersByRole("Student"));

  document.querySelectorAll(".quick-switch-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const userId = Number(btn.dataset.userId);
      loginAs(userId);
      if (typeof onSwitch === "function") onSwitch();
    });
  });
}

/**
 * Updates the small "current session" badge in the navbar.
 */
export function renderCurrentUserBadge() {
  const badge = document.getElementById("currentUserBadge");
  const user = getCurrentUser();
  badge.classList.remove("role-admin", "role-professor", "role-student");

  if (!user) {
    badge.textContent = "No active session — pick a quick-switch account";
    return;
  }

  const icons = { Admin: "bi-shield-lock", Professor: "bi-person-workspace", Student: "bi-person-badge" };
  badge.innerHTML = `<i class="bi ${icons[user.role] || "bi-person"} me-1"></i>${escapeHtml(user.name)} &middot; ${user.role}`;
  badge.classList.add(`role-${user.role.toLowerCase()}`);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
