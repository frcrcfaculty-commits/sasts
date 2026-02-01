const { getOne, getAll, runQuery } = require('../config/database');

class Student {
  static getAll(departmentId = null) {
    if (departmentId) {
      return getAll(`
        SELECT s.*, d.name as department_name
        FROM students s
        JOIN departments d ON s.department_id = d.id
        WHERE s.department_id = ?
        ORDER BY s.name
      `, [departmentId]);
    }
    return getAll(`
      SELECT s.*, d.name as department_name
      FROM students s
      JOIN departments d ON s.department_id = d.id
      ORDER BY s.name
    `);
  }

  static getById(id) {
    return getOne(`
      SELECT s.*, d.name as department_name
      FROM students s
      JOIN departments d ON s.department_id = d.id
      WHERE s.id = ?
    `, [id]);
  }

  static getByRollNumber(rollNumber, departmentId) {
    return getOne(`
      SELECT * FROM students WHERE roll_number = ? AND department_id = ?
    `, [rollNumber, departmentId]);
  }

  static getByEmail(email) {
    return getOne('SELECT * FROM students WHERE email = ?', [email]);
  }

  static search(query, departmentId = null) {
    const searchPattern = `%${query}%`;
    if (departmentId) {
      return getAll(`
        SELECT s.*, d.name as department_name
        FROM students s
        JOIN departments d ON s.department_id = d.id
        WHERE s.department_id = ? AND (s.name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)
        ORDER BY s.name
      `, [departmentId, searchPattern, searchPattern, searchPattern]);
    }
    return getAll(`
      SELECT s.*, d.name as department_name
      FROM students s
      JOIN departments d ON s.department_id = d.id
      WHERE s.name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?
      ORDER BY s.name
    `, [searchPattern, searchPattern, searchPattern]);
  }

  static create({ name, rollNumber, email, departmentId, semester }) {
    const result = runQuery(`
      INSERT INTO students (name, roll_number, email, department_id, semester)
      VALUES (?, ?, ?, ?, ?)
    `, [name, rollNumber, email, departmentId, semester]);
    return this.getById(result.lastInsertRowid);
  }

  static update(id, { name, rollNumber, email, departmentId, semester }) {
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (rollNumber !== undefined) { updates.push('roll_number = ?'); params.push(rollNumber); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (departmentId !== undefined) { updates.push('department_id = ?'); params.push(departmentId); }
    if (semester !== undefined) { updates.push('semester = ?'); params.push(semester); }

    if (updates.length === 0) return this.getById(id);

    params.push(id);
    runQuery(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  }

  static delete(id) {
    return runQuery('DELETE FROM students WHERE id = ?', [id]);
  }

  static findOrCreate({ name, rollNumber, email, departmentId, semester }) {
    let student = this.getByRollNumber(rollNumber, departmentId);
    if (!student) {
      student = this.create({ name, rollNumber, email, departmentId, semester });
    }
    return student;
  }
}

module.exports = Student;
