const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/sasts.db');
let db = null;

// Initialize database
const initDatabase = async () => {
  const SQL = await initSqlJs();

  // Try to load existing database
  try {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
      console.log('✅ Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('✅ Created new database');
    }
  } catch (err) {
    db = new SQL.Database();
    console.log('✅ Created new database (fresh start)');
  }

  // Create tables
  createTables();
  seedData();
  saveDatabase();

  return db;
};

// Save database to disk
const saveDatabase = () => {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Failed to save database:', err);
  }
};

// Create tables
const createTables = () => {
  db.run('PRAGMA foreign_keys = ON');

  // ==================== CORE TABLES ====================

  // Departments table
  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table (Faculty, Admin, SuperAdmin)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('faculty', 'admin', 'superadmin')),
      department_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  // Students table (basic student info)
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      email TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      year INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(roll_number, department_id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  // ==================== NEW: STUDENT AUTHENTICATION ====================

  // Student login accounts
  db.run(`
    CREATE TABLE IF NOT EXISTS students_auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      total_time_spent INTEGER DEFAULT 0,
      visit_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // ==================== CLASSIFICATION & ACTIVITIES ====================

  // Student Classifications table
  db.run(`
    CREATE TABLE IF NOT EXISTS student_classifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('weak', 'strong')),
      reason TEXT NOT NULL,
      classified_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai_suggested')),
      UNIQUE(student_id, faculty_id, semester, academic_year),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (faculty_id) REFERENCES users(id)
    )
  `);

  // Activities table (legacy - for tracking support activities)
  db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classification_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL CHECK(activity_type IN ('notes', 'lecture', 'interactive', 'nptel_course', 'assignment', 'tutorial', 'extra_course')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      scheduled_date DATE,
      completion_status TEXT DEFAULT 'pending' CHECK(completion_status IN ('pending', 'completed', 'cancelled')),
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classification_id) REFERENCES student_classifications(id)
    )
  `);

  // Activity Reviews table
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      feedback_text TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_anonymous INTEGER DEFAULT 1,
      review_token TEXT UNIQUE,
      FOREIGN KEY (activity_id) REFERENCES activities(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // Review Reminders table
  db.run(`
    CREATE TABLE IF NOT EXISTS review_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      reminder_count INTEGER DEFAULT 0,
      last_sent_at DATETIME,
      response_received INTEGER DEFAULT 0,
      review_token TEXT NOT NULL,
      token_expires_at DATETIME,
      FOREIGN KEY (activity_id) REFERENCES activities(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // ==================== NEW: MARKS MANAGEMENT ====================

  // Semester marks uploads
  db.run(`
    CREATE TABLE IF NOT EXISTS semester_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      year INTEGER NOT NULL CHECK(year IN (1, 2, 3, 4)),
      file_name TEXT,
      parsed_data TEXT,
      upload_type TEXT DEFAULT 'semester' CHECK(upload_type IN ('semester', 'isc')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // Individual student marks (parsed from uploads)
  db.run(`
    CREATE TABLE IF NOT EXISTS student_marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marks_upload_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject TEXT,
      marks_obtained REAL,
      max_marks REAL DEFAULT 100,
      percentage REAL,
      grade TEXT,
      FOREIGN KEY (marks_upload_id) REFERENCES semester_marks(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // AI suggestions for strong/weak students
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marks_upload_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      suggested_category TEXT NOT NULL CHECK(suggested_category IN ('weak', 'strong')),
      confidence_score REAL,
      reason TEXT,
      is_applied INTEGER DEFAULT 0,
      applied_by INTEGER,
      applied_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (marks_upload_id) REFERENCES semester_marks(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (applied_by) REFERENCES users(id)
    )
  `);

  // ==================== NEW: SYLLABUS & AI ACTIVITIES ====================

  // Syllabi uploads
  db.run(`
    CREATE TABLE IF NOT EXISTS syllabi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      course_name TEXT NOT NULL,
      course_code TEXT,
      file_name TEXT,
      parsed_modules TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_id) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  // Syllabus modules (parsed from syllabi)
  db.run(`
    CREATE TABLE IF NOT EXISTS syllabus_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      syllabus_id INTEGER NOT NULL,
      module_number INTEGER NOT NULL,
      module_name TEXT NOT NULL,
      topics TEXT,
      hours INTEGER,
      FOREIGN KEY (syllabus_id) REFERENCES syllabi(id)
    )
  `);

  // AI-generated activities (quizzes, crosswords, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS generated_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      syllabus_id INTEGER NOT NULL,
      module_id INTEGER,
      faculty_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      activity_type TEXT NOT NULL CHECK(activity_type IN ('mcq', 'crossword', 'puzzle', 'team_game', 'flashcards', 'fill_blanks')),
      content TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
      time_limit INTEGER,
      max_score INTEGER DEFAULT 100,
      is_published INTEGER DEFAULT 0,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (syllabus_id) REFERENCES syllabi(id),
      FOREIGN KEY (module_id) REFERENCES syllabus_modules(id),
      FOREIGN KEY (faculty_id) REFERENCES users(id)
    )
  `);

  // Activity assignments (which students should do which activities)
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      due_date DATETIME,
      UNIQUE(activity_id, student_id),
      FOREIGN KEY (activity_id) REFERENCES generated_activities(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // Student activity sessions (tracking engagement)
  db.run(`
    CREATE TABLE IF NOT EXISTS student_activity_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      time_spent INTEGER DEFAULT 0,
      score INTEGER,
      max_score INTEGER,
      answers TEXT,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (activity_id) REFERENCES generated_activities(id)
    )
  `);

  // ==================== NEW: NOTIFICATIONS ====================

  // Notifications for all user types
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL CHECK(recipient_type IN ('student', 'faculty', 'admin', 'superadmin')),
      recipient_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      notification_type TEXT DEFAULT 'info' CHECK(notification_type IN ('info', 'activity', 'reminder', 'alert')),
      is_read INTEGER DEFAULT 0,
      email_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database tables created (v2 schema)');
};

// Seed initial data
const seedData = () => {
  const departments = [
    'Computer Engineering',
    'Information Technology',
    'Electronics & Telecommunication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical Engineering'
  ];

  const insertDept = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');
  for (const dept of departments) {
    insertDept.run([dept]);
  }
  insertDept.free();

  // Check if superadmin exists
  const result = db.exec("SELECT * FROM users WHERE role = 'superadmin'");

  if (!result.length || !result[0].values.length) {
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync('Principal@2026', 10);

    db.run(`
      INSERT INTO users (email, password_hash, name, role, department_id)
      VALUES (?, ?, ?, ?, NULL)
    `, ['principal@fcrit.ac.in', passwordHash, 'Principal', 'superadmin']);

    console.log('✅ Super Admin created (principal@fcrit.ac.in / Principal@2026)');
  }

  console.log('✅ Seed data inserted');
};

// Helper functions for models
const getDb = () => db;

const runQuery = (sql, params = []) => {
  try {
    db.run(sql, params);
    saveDatabase();
    return { changes: db.getRowsModified(), lastInsertRowid: getLastInsertId() };
  } catch (err) {
    console.error('Query error:', err);
    throw err;
  }
};

const getLastInsertId = () => {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0]?.[0] || 0;
};

const getOne = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const row = {};
      cols.forEach((col, i) => row[col] = values[i]);
      return row;
    }
    stmt.free();
    return null;
  } catch (err) {
    console.error('getOne error:', err);
    return null;
  }
};

const getAll = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    const cols = stmt.getColumnNames();
    while (stmt.step()) {
      const values = stmt.get();
      const row = {};
      cols.forEach((col, i) => row[col] = values[i]);
      results.push(row);
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('getAll error:', err);
    return [];
  }
};

module.exports = { initDatabase, getDb, runQuery, getOne, getAll, saveDatabase };
