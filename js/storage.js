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
    { id: 1, role: "Admin", name: "Don Tomas", username: "admin" },
    { id: 2, role: "Professor", name: "Erinn Sanchez", username: "esanchez" },
    { id: 3, role: "Student", name: "Aaron Filarca", username: "afilarca" },
    { id: 4, role: "Student", name: "Nicole Monsanto", username: "nmonsanto" },
    { id: 5, role: "Student", name: "Marden Doria", username: "mdoria" },
    { id: 6, role: "Student", name: "Jan Gil Corbita", username: "jgcorbita" },
    // New Professor added
    { id: 7, role: "Professor", name: "Maria Santos", username: "msantos" }, 
  ];

  const courses = [
    { id: 1, code: "CPE106L-4", title: "Software Design Laboratory", professorId: 2, absenceThreshold: 3, units: 1 },
    // New Course added
    { id: 2, code: "CPE107L-4", title: "Computer Architecture Laboratory", professorId: 7, absenceThreshold: 3, units: 1 },
  ];

  const enrollments = [
    { id: 1, studentId: 3, courseId: 1 },
    { id: 2, studentId: 4, courseId: 1 },
    { id: 3, studentId: 5, courseId: 1 },
    { id: 4, studentId: 6, courseId: 1 },
    // Enroll some students in the new course
    { id: 5, studentId: 3, courseId: 2 },
    { id: 6, studentId: 4, courseId: 2 },
  ];

  const categories = [
    // Course 1 Categories
    { id: 1, courseId: 1, name: "Lab 1", weight: 5 },
    { id: 2, courseId: 1, name: "Lab 2", weight: 5 },
    { id: 3, courseId: 1, name: "Lab 3", weight: 5 },
    { id: 4, courseId: 1, name: "Lab 4", weight: 6 },
    { id: 5, courseId: 1, name: "Lab 5", weight: 6 },
    { id: 6, courseId: 1, name: "Lab 6", weight: 6 },
    { id: 7, courseId: 1, name: "Lab 7", weight: 7 },
    { id: 8, courseId: 1, name: "Practical Exam", weight: 30 },
    { id: 9, courseId: 1, name: "Project", weight: 30 },
    // Course 2 Categories
    { id: 10, courseId: 2, name: "Assembly Labs", weight: 40 },
    { id: 11, courseId: 2, name: "Midterm Exam", weight: 30 },
    { id: 12, courseId: 2, name: "Final CPU Design", weight: 30 },
  ];

  const items = [
    // Course 1 Items
    { id: 1, courseId: 1, categoryId: 1, title: "Lab 1: Software Relevant Tools, Standards, and Code Versioning using Github", dueDate: addDaysISO(-35), maxPoints: 100 },
    { id: 2, courseId: 1, categoryId: 2, title: "Lab 2: Strings, Lists, Tuples, and Dictionaries", dueDate: addDaysISO(-28), maxPoints: 100 },
    { id: 3, courseId: 1, categoryId: 3, title: "Lab 3: Object Oriented Design and Implementation", dueDate: addDaysISO(-21), maxPoints: 100 },
    { id: 4, courseId: 1, categoryId: 4, title: "Lab 4: Design Patterns and Unit Testing", dueDate: addDaysISO(-14), maxPoints: 100 },
    { id: 5, courseId: 1, categoryId: 5, title: "Lab 5: Data Modeling and Introduction to SQL", dueDate: addDaysISO(-7), maxPoints: 100 },
    { id: 6, courseId: 1, categoryId: 6, title: "Lab 6: openGauss", dueDate: addDaysISO(-3), maxPoints: 100 },
    { id: 7, courseId: 1, categoryId: 7, title: "Lab 7: Data Mining APIs and Interactive Data Visualization", dueDate: addDaysISO(-1), maxPoints: 100 },
    { id: 8, courseId: 1, categoryId: 8, title: "Practical Exam 1", dueDate: addDaysISO(-1), maxPoints: 100 },
    { id: 9, courseId: 1, categoryId: 9, title: "Software Project", dueDate: addDaysISO(14), maxPoints: 100 },
    // Course 2 Items
    { id: 10, courseId: 2, categoryId: 10, title: "Lab 1: Intro to MIPS Assembly", dueDate: addDaysISO(-20), maxPoints: 100 },
    { id: 11, courseId: 2, categoryId: 10, title: "Lab 2: Memory and Registers", dueDate: addDaysISO(-10), maxPoints: 100 },
    { id: 12, courseId: 2, categoryId: 11, title: "Midterm Architecture Exam", dueDate: addDaysISO(-2), maxPoints: 100 },
  ];

  const scores = [
    // Course 1 Scores
    { id: 1, itemId: 1, studentId: 3, score: 100 },
    { id: 2, itemId: 2, studentId: 3, score: 100 },
    { id: 3, itemId: 3, studentId: 3, score: 100 },
    { id: 4, itemId: 4, studentId: 3, score: 100 },
    { id: 5, itemId: 5, studentId: 3, score: 100 },
    { id: 6, itemId: 6, studentId: 3, score: 100 },
    { id: 7, itemId: 7, studentId: 3, score: 100 },
    { id: 8, itemId: 8, studentId: 3, score: 100 },

    { id: 9, itemId: 1, studentId: 4, score: 90 },
    { id: 10, itemId: 2, studentId: 4, score: 90 },
    { id: 11, itemId: 3, studentId: 4, score: 90 },
    { id: 12, itemId: 4, studentId: 4, score: 90 },
    { id: 13, itemId: 5, studentId: 4, score: 90 },
    { id: 14, itemId: 6, studentId: 4, score: 90 },
    { id: 15, itemId: 7, studentId: 4, score: 90 },
    { id: 16, itemId: 8, studentId: 4, score: 90 },
    { id: 17, itemId: 9, studentId: 4, score: 90 },

    { id: 18, itemId: 1, studentId: 5, score: 96 },
    { id: 19, itemId: 2, studentId: 5, score: 96 },
    { id: 20, itemId: 3, studentId: 5, score: 96 },
    { id: 21, itemId: 4, studentId: 5, score: 96 },
    { id: 22, itemId: 5, studentId: 5, score: 96 },
    { id: 23, itemId: 6, studentId: 5, score: 96 },
    { id: 24, itemId: 7, studentId: 5, score: 96 },
    { id: 25, itemId: 8, studentId: 5, score: 96 },
    { id: 26, itemId: 9, studentId: 5, score: 96 },

    { id: 27, itemId: 1, studentId: 6, score: 60 },
    { id: 28, itemId: 2, studentId: 6, score: 60 },
    { id: 29, itemId: 3, studentId: 6, score: 60 },
    { id: 30, itemId: 4, studentId: 6, score: 60 },
    { id: 31, itemId: 5, studentId: 6, score: 60 },
    { id: 32, itemId: 6, studentId: 6, score: 60 },
    { id: 33, itemId: 7, studentId: 6, score: 60 },
    { id: 34, itemId: 8, studentId: 6, score: 60 },
    { id: 35, itemId: 9, studentId: 6, score: 60 },
    
    // Course 2 Scores (Aaron and Nicole)
    { id: 36, itemId: 10, studentId: 3, score: 88 },
    { id: 37, itemId: 11, studentId: 3, score: 92 },
    { id: 38, itemId: 12, studentId: 3, score: 85 },
    
    { id: 39, itemId: 10, studentId: 4, score: 95 },
    { id: 40, itemId: 11, studentId: 4, score: 98 },
    { id: 41, itemId: 12, studentId: 4, score: 90 },
  ];

  const attendance = [
    // Course 1
    { id: 1, courseId: 1, studentId: 3, date: addDaysISO(-35), status: "Present" },
    { id: 2, courseId: 1, studentId: 4, date: addDaysISO(-35), status: "Present" },
    { id: 3, courseId: 1, studentId: 5, date: addDaysISO(-35), status: "Present" },
    { id: 4, courseId: 1, studentId: 6, date: addDaysISO(-35), status: "Present" },
    // Course 2
    { id: 5, courseId: 2, studentId: 3, date: addDaysISO(-20), status: "Present" },
    { id: 6, courseId: 2, studentId: 4, date: addDaysISO(-20), status: "Late" },
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

export function exportData() {
  return loadData();
}

export function importData(data) {
  const collections = ["users", "courses", "enrollments", "categories", "items", "scores", "attendance"];
  if (!data || typeof data !== "object" || collections.some(key => !Array.isArray(data[key]))) {
    throw new Error("The file does not contain a valid grade-system data export.");
  }

  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  return data;
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