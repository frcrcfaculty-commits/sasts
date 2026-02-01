const { getOne, getAll, runQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

class StudentAuth {
    static getById(id) {
        return getOne(`
      SELECT sa.*, s.name, s.roll_number, s.department_id, s.semester, s.year,
             d.name as department_name
      FROM students_auth sa
      JOIN students s ON sa.student_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE sa.id = ?
    `, [id]);
    }

    static getByStudentId(studentId) {
        return getOne(`
      SELECT sa.*, s.name, s.roll_number, s.department_id, s.semester, s.year,
             d.name as department_name
      FROM students_auth sa
      JOIN students s ON sa.student_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE sa.student_id = ?
    `, [studentId]);
    }

    static getByEmail(email) {
        return getOne(`
      SELECT sa.*, s.name, s.roll_number, s.department_id, s.semester, s.year,
             d.name as department_name
      FROM students_auth sa
      JOIN students s ON sa.student_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE sa.email = ?
    `, [email]);
    }

    static create({ studentId, email, password }) {
        const passwordHash = bcrypt.hashSync(password, 10);
        const result = runQuery(`
      INSERT INTO students_auth (student_id, email, password_hash)
      VALUES (?, ?, ?)
    `, [studentId, email, passwordHash]);
        return this.getById(result.lastInsertRowid);
    }

    static verifyPassword(studentAuth, password) {
        return bcrypt.compareSync(password, studentAuth.password_hash);
    }

    static updatePassword(id, newPassword) {
        const passwordHash = bcrypt.hashSync(newPassword, 10);
        return runQuery('UPDATE students_auth SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    }

    static updateLoginStats(id) {
        return runQuery(`
      UPDATE students_auth 
      SET last_login = datetime('now'), visit_count = visit_count + 1 
      WHERE id = ?
    `, [id]);
    }

    static addTimeSpent(id, seconds) {
        return runQuery(`
      UPDATE students_auth 
      SET total_time_spent = total_time_spent + ? 
      WHERE id = ?
    `, [seconds, id]);
    }

    static deactivate(id) {
        return runQuery('UPDATE students_auth SET is_active = 0 WHERE id = ?', [id]);
    }

    static activate(id) {
        return runQuery('UPDATE students_auth SET is_active = 1 WHERE id = ?', [id]);
    }

    static getAll(departmentId = null) {
        let query = `
      SELECT sa.*, s.name, s.roll_number, s.semester, s.year,
             d.name as department_name
      FROM students_auth sa
      JOIN students s ON sa.student_id = s.id
      JOIN departments d ON s.department_id = d.id
    `;
        const params = [];

        if (departmentId) {
            query += ' WHERE s.department_id = ?';
            params.push(departmentId);
        }
        query += ' ORDER BY s.name';

        return getAll(query, params);
    }
}

module.exports = StudentAuth;
