// ============================================================================
// storage.js
// Schema initialization, mock data seeding, and localStorage CRUD abstractions.
// This is the ONLY module that talks to localStorage directly.
// ============================================================================

const DATA_KEY = "ched_gls_data_v1";
const SESSION_KEY = "ched_gls_session_v1";

/* ----------------------------------------------------------------------- *
 *  Date helpers (kept here so seed data and app logic agree on "today")
 * ----------------------------------------------------------------------- */
export function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(dateISO, fromISO = todayISO()) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(dateISO + "T00:00:00");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ----------------------------------------------------------------------- *
 *  ID generation
 * ----------------------------------------------------------------------- */
function nextId(list) {
  return list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

/* ----------------------------------------------------------------------- *
 *  Seed data
 * ----------------------------------------------------------------------- */
function buildSeedData() {
  const users = [
    { id: 1, role: "Admin", name: "Dr. Elena Reyes", username: "admin" },

    { id: 2, role: "Professor", name: "Prof. Marco Villanueva", username: "mvillanueva" },
    { id: 3, role: "Professor", name: "Prof. Angela Cruz", username: "acruz" },

    { id: 4, role: "Student", name: "Juan Dela Cruz", username: "jdelacruz" },
    { id: 5, role: "Student", name: "Maria Santos", username: "msantos" },
    { id: 6, role: "Student", name: "Paolo Ramos", username: "pramos" },
    { id: 7, role: "Student", name: "Kim Aquino", username: "kaquino" },
  ];

  const courses = [
    { id: 1, code: "CS101", title: "Data Structures and Algorithms", professorId: 2, absenceThreshold: 3, units: 3 },
    { id: 2, code: "IT205", title: "Software Engineering", professorId: 3, absenceThreshold: 4, units: 3 },
  ];

  const enrollments = [
    { id: 1, studentId: 4, courseId: 1 },
    { id: 2, studentId: 5, courseId: 1 },
    { id: 3, studentId: 6, courseId: 1 },
    { id: 4, studentId: 4, courseId: 2 },
    { id: 5, studentId: 7, courseId: 2 },
    { id: 6, studentId: 5, courseId: 2 },
  ];

  const categories = [
    { id: 1, courseId: 1, name: "Quizzes", weight: 30 },
    { id: 2, courseId: 1, name: "Exams", weight: 40 },
    { id: 3, courseId: 1, name: "Courseworks", weight: 30 },

    { id: 4, courseId: 2, name: "Quizzes", weight: 20 },
    { id: 5, courseId: 2, name: "Exams", weight: 50 },
    { id: 6, courseId: 2, name: "Courseworks", weight: 30 },
  ];

  const items = [
    // ---- CS101 : Quizzes (cat 1) ----
    { id: 1, courseId: 1, categoryId: 1, title: "Quiz 1 - Arrays & Lists", dueDate: addDaysISO(-20), maxPoints: 20 },
    { id: 2, courseId: 1, categoryId: 1, title: "Quiz 2 - Stacks & Queues", dueDate: addDaysISO(-10), maxPoints: 20 },
    { id: 3, courseId: 1, categoryId: 1, title: "Quiz 3 - Trees", dueDate: addDaysISO(2), maxPoints: 20 },

    // ---- CS101 : Exams (cat 2) ----
    { id: 4, courseId: 1, categoryId: 2, title: "Midterm Examination", dueDate: addDaysISO(-8), maxPoints: 100 },
    { id: 5, courseId: 1, categoryId: 2, title: "Final Examination", dueDate: addDaysISO(21), maxPoints: 100 },

    // ---- CS101 : Courseworks (cat 3) ----
    { id: 6, courseId: 1, categoryId: 3, title: "Programming Project 1", dueDate: addDaysISO(-15), maxPoints: 50 },
    { id: 7, courseId: 1, categoryId: 3, title: "Programming Project 2", dueDate: addDaysISO(-1), maxPoints: 50 },
    { id: 8, courseId: 1, categoryId: 3, title: "Lab Portfolio", dueDate: addDaysISO(9), maxPoints: 50 },

    // ---- IT205 : Quizzes (cat 4) ----
    { id: 9, courseId: 2, categoryId: 4, title: "Quiz 1 - SDLC Models", dueDate: addDaysISO(-12), maxPoints: 20 },
    { id: 10, courseId: 2, categoryId: 4, title: "Quiz 2 - Requirements", dueDate: addDaysISO(1), maxPoints: 20 },

    // ---- IT205 : Exams (cat 5) ----
    { id: 11, courseId: 2, categoryId: 5, title: "Midterm Examination", dueDate: addDaysISO(-6), maxPoints: 100 },
    { id: 12, courseId: 2, categoryId: 5, title: "Final Examination", dueDate: addDaysISO(24), maxPoints: 100 },

    // ---- IT205 : Courseworks (cat 6) ----
    { id: 13, courseId: 2, categoryId: 6, title: "UML Design Document", dueDate: addDaysISO(-4), maxPoints: 40 },
    { id: 14, courseId: 2, categoryId: 6, title: "Sprint Demo 1", dueDate: addDaysISO(3), maxPoints: 40 },
  ];

  // Scores: intentionally partial, so the student view has a mix of graded,
  // ungraded-but-past-due (missed), and upcoming items to demonstrate warnings.
  const scores = [
    // Juan Dela Cruz (id 4) in CS101 (course 1)
    { id: 1, itemId: 1, studentId: 4, score: 18 },
    { id: 2, itemId: 2, studentId: 4, score: 14 },
    { id: 3, itemId: 4, studentId: 4, score: 78 },
    { id: 4, itemId: 6, studentId: 4, score: 44 },
    // item 7 (Programming Project 2, due yesterday) intentionally NOT scored -> missed activity

    // Maria Santos (id 5) in CS101
    { id: 5, itemId: 1, studentId: 5, score: 20 },
    { id: 6, itemId: 2, studentId: 5, score: 19 },
    { id: 7, itemId: 4, studentId: 5, score: 91 },
    { id: 8, itemId: 6, studentId: 5, score: 48 },
    { id: 9, itemId: 7, studentId: 5, score: 45 },

    // Paolo Ramos (id 6) in CS101 - weaker performance, near CHED risk
    { id: 10, itemId: 1, studentId: 6, score: 10 },
    { id: 11, itemId: 2, studentId: 6, score: 9 },
    { id: 12, itemId: 4, studentId: 6, score: 55 },
    { id: 13, itemId: 6, studentId: 6, score: 28 },

    // Juan Dela Cruz (id 4) in IT205 (course 2)
    { id: 14, itemId: 9, studentId: 4, score: 17 },
    { id: 15, itemId: 11, studentId: 4, score: 82 },
    { id: 16, itemId: 13, studentId: 4, score: 34 },

    // Kim Aquino (id 7) in IT205
    { id: 17, itemId: 9, studentId: 7, score: 19 },
    { id: 18, itemId: 11, studentId: 7, score: 88 },
    // item 13 (UML Design Document, due 4 days ago) intentionally NOT scored -> missed activity

    // Maria Santos (id 5) in IT205
    { id: 19, itemId: 9, studentId: 5, score: 15 },
    { id: 20, itemId: 11, studentId: 5, score: 70 },
    { id: 21, itemId: 13, studentId: 5, score: 30 },
  ];

  // Attendance logs. Paolo Ramos is deliberately close to the CHED threshold (3)
  // in CS101, and Kim Aquino has already breached the threshold (4) in IT205.
  const attendance = [
    { id: 1, courseId: 1, studentId: 4, date: addDaysISO(-20), status: "Present" },
    { id: 2, courseId: 1, studentId: 4, date: addDaysISO(-13), status: "Excused" },
    { id: 3, courseId: 1, studentId: 4, date: addDaysISO(-6), status: "Present" },

    { id: 4, courseId: 1, studentId: 5, date: addDaysISO(-20), status: "Present" },
    { id: 5, courseId: 1, studentId: 5, date: addDaysISO(-13), status: "Present" },

    { id: 6, courseId: 1, studentId: 6, date: addDaysISO(-20), status: "Absent" },
    { id: 7, courseId: 1, studentId: 6, date: addDaysISO(-13), status: "Absent" },
    { id: 8, courseId: 1, studentId: 6, date: addDaysISO(-6), status: "Present" },
    // Paolo has 2 absences of 3 allowed -> "one away" warning territory

    { id: 9, courseId: 2, studentId: 4, date: addDaysISO(-12), status: "Present" },
    { id: 10, courseId: 2, studentId: 4, date: addDaysISO(-5), status: "Present" },

    { id: 11, courseId: 2, studentId: 7, date: addDaysISO(-12), status: "Absent" },
    { id: 12, courseId: 2, studentId: 7, date: addDaysISO(-9), status: "Absent" },
    { id: 13, courseId: 2, studentId: 7, date: addDaysISO(-5), status: "Absent" },
    { id: 14, courseId: 2, studentId: 7, date: addDaysISO(-2), status: "Absent" },
    // Kim has 4 absences of 4 allowed -> automatic 5.00 triggered

    { id: 15, courseId: 2, studentId: 5, date: addDaysISO(-12), status: "Present" },
    { id: 16, courseId: 2, studentId: 5, date: addDaysISO(-5), status: "Excused" },
  ];

  return { users, courses, enrollments, categories, items, scores, attendance };
}

/* ----------------------------------------------------------------------- *
 *  Core read / write
 * ----------------------------------------------------------------------- */
export function loadData() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    const seeded = buildSeedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Corrupt data in localStorage, reseeding.", e);
    const seeded = buildSeedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function resetData() {
  const seeded = buildSeedData();
  localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
  localStorage.removeItem(SESSION_KEY);
  return seeded;
}

export function initStorage() {
  // Ensures data exists; safe to call multiple times.
  return loadData();
}

/* ----------------------------------------------------------------------- *
 *  Session persistence (kept in storage.js since it's still localStorage,
 *  auth.js owns the *business logic* around it)
 * ----------------------------------------------------------------------- */
export function readSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function writeSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

/* ----------------------------------------------------------------------- *
 *  Generic collection helpers (small CRUD abstraction used by feature modules)
 * ----------------------------------------------------------------------- */
export const db = {
  // USERS
  getUsers() { return loadData().users; },
  getUser(id) { return loadData().users.find(u => u.id === id) || null; },
  getUsersByRole(role) { return loadData().users.filter(u => u.role === role); },

  // COURSES
  getCourses() { return loadData().courses; },
  getCourse(id) { return loadData().courses.find(c => c.id === id) || null; },
  getCoursesByProfessor(professorId) {
    return loadData().courses.filter(c => c.professorId === professorId);
  },
  addCourse({ code, title, professorId, absenceThreshold, units }) {
    const data = loadData();
    const course = {
      id: nextId(data.courses),
      code: code.trim(),
      title: title.trim(),
      professorId: professorId ? Number(professorId) : null,
      absenceThreshold: Number(absenceThreshold),
      units: Number(units),
    };
    data.courses.push(course);
    saveData(data);
    return course;
  },
  updateCourse(id, patch) {
    const data = loadData();
    const course = data.courses.find(c => c.id === id);
    if (!course) return null;
    Object.assign(course, patch);
    saveData(data);
    return course;
  },
  deleteCourse(id) {
    const data = loadData();
    const itemIds = data.items.filter(i => i.courseId === id).map(i => i.id);
    data.courses = data.courses.filter(c => c.id !== id);
    data.enrollments = data.enrollments.filter(e => e.courseId !== id);
    data.categories = data.categories.filter(c => c.courseId !== id);
    data.items = data.items.filter(i => i.courseId !== id);
    data.scores = data.scores.filter(s => !itemIds.includes(s.itemId));
    data.attendance = data.attendance.filter(a => a.courseId !== id);
    saveData(data);
  },

  // ENROLLMENTS
  getEnrollmentsByStudent(studentId) {
    return loadData().enrollments.filter(e => e.studentId === studentId);
  },
  getEnrollmentsByCourse(courseId) {
    return loadData().enrollments.filter(e => e.courseId === courseId);
  },
  getStudentsForCourse(courseId) {
    const data = loadData();
    const ids = data.enrollments.filter(e => e.courseId === courseId).map(e => e.studentId);
    return data.users.filter(u => ids.includes(u.id));
  },
  addEnrollment({ studentId, courseId }) {
    const data = loadData();
    const sid = Number(studentId), cid = Number(courseId);
    const existing = data.enrollments.find(e => e.studentId === sid && e.courseId === cid);
    if (existing) return existing;
    const enrollment = { id: nextId(data.enrollments), studentId: sid, courseId: cid };
    data.enrollments.push(enrollment);
    saveData(data);
    return enrollment;
  },
  removeEnrollment(id) {
    const data = loadData();
    data.enrollments = data.enrollments.filter(e => e.id !== id);
    saveData(data);
  },

  // CATEGORIES
  getCategoriesByCourse(courseId) {
    return loadData().categories.filter(c => c.courseId === courseId);
  },
  getCategory(id) { return loadData().categories.find(c => c.id === id) || null; },
  addCategory({ courseId, name, weight }) {
    const data = loadData();
    const category = {
      id: nextId(data.categories),
      courseId: Number(courseId),
      name: name.trim(),
      weight: Number(weight),
    };
    data.categories.push(category);
    saveData(data);
    return category;
  },
  deleteCategory(id) {
    const data = loadData();
    data.categories = data.categories.filter(c => c.id !== id);
    data.items = data.items.filter(i => i.categoryId !== id);
    saveData(data);
  },

  // ITEMS
  getItemsByCourse(courseId) {
    return loadData().items.filter(i => i.courseId === courseId);
  },
  getItemsByCategory(categoryId) {
    return loadData().items.filter(i => i.categoryId === categoryId);
  },
  getItem(id) { return loadData().items.find(i => i.id === id) || null; },
  addItem({ courseId, categoryId, title, dueDate, maxPoints }) {
    const data = loadData();
    const item = {
      id: nextId(data.items),
      courseId: Number(courseId),
      categoryId: Number(categoryId),
      title: title.trim(),
      dueDate,
      maxPoints: Number(maxPoints),
    };
    data.items.push(item);
    saveData(data);
    return item;
  },
  deleteItem(id) {
    const data = loadData();
    data.items = data.items.filter(i => i.id !== id);
    data.scores = data.scores.filter(s => s.itemId !== id);
    saveData(data);
  },

  // SCORES
  getScoresByItem(itemId) {
    return loadData().scores.filter(s => s.itemId === itemId);
  },
  getScoresByStudent(studentId) {
    return loadData().scores.filter(s => s.studentId === studentId);
  },
  getScore(itemId, studentId) {
    return loadData().scores.find(s => s.itemId === itemId && s.studentId === studentId) || null;
  },
  upsertScore({ itemId, studentId, score }) {
    const data = loadData();
    let record = data.scores.find(s => s.itemId === itemId && s.studentId === studentId);
    if (record) {
      record.score = score;
    } else {
      record = { id: nextId(data.scores), itemId: Number(itemId), studentId: Number(studentId), score };
      data.scores.push(record);
    }
    saveData(data);
    return record;
  },

  // ATTENDANCE
  getAttendanceByCourse(courseId) {
    return loadData().attendance.filter(a => a.courseId === courseId);
  },
  getAttendanceByCourseAndStudent(courseId, studentId) {
    return loadData().attendance.filter(a => a.courseId === courseId && a.studentId === studentId);
  },
  getAttendanceForDate(courseId, date) {
    return loadData().attendance.filter(a => a.courseId === courseId && a.date === date);
  },
  upsertAttendance({ courseId, studentId, date, status }) {
    const data = loadData();
    let record = data.attendance.find(a => a.courseId === courseId && a.studentId === studentId && a.date === date);
    if (record) {
      record.status = status;
    } else {
      record = { id: nextId(data.attendance), courseId: Number(courseId), studentId: Number(studentId), date, status };
      data.attendance.push(record);
    }
    saveData(data);
    return record;
  },
};
