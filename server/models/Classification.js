const { getOne, getAll, runQuery } = require('../config/database');

class Classification {
    static getAll(facultyId = null, category = null) {
        let query = `
      SELECT sc.*, 
             s.name as student_name, s.roll_number, s.email as student_email, s.semester as student_semester,
             u.name as faculty_name, u.email as faculty_email,
             d.name as department_name
      FROM student_classifications sc
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON sc.faculty_id = u.id
      JOIN departments d ON s.department_id = d.id
    `;
        const conditions = [];
        const params = [];

        if (facultyId) {
            conditions.push('sc.faculty_id = ?');
            params.push(facultyId);
        }
        if (category) {
            conditions.push('sc.category = ?');
            params.push(category);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY sc.classified_date DESC';

        return getAll(query, params);
    }

    static getById(id) {
        return getOne(`
      SELECT sc.*, 
             s.name as student_name, s.roll_number, s.email as student_email, s.semester as student_semester,
             u.name as faculty_name, u.email as faculty_email,
             d.name as department_name
      FROM student_classifications sc
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON sc.faculty_id = u.id
      JOIN departments d ON s.department_id = d.id
      WHERE sc.id = ?
    `, [id]);
    }

    static getByDepartment(departmentId, category = null) {
        let query = `
      SELECT sc.*, 
             s.name as student_name, s.roll_number, s.email as student_email, s.semester as student_semester,
             u.name as faculty_name, u.email as faculty_email,
             d.name as department_name
      FROM student_classifications sc
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON sc.faculty_id = u.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.department_id = ?
    `;
        const params = [departmentId];

        if (category) {
            query += ' AND sc.category = ?';
            params.push(category);
        }
        query += ' ORDER BY sc.classified_date DESC';

        return getAll(query, params);
    }

    static checkDuplicate(studentId, facultyId, semester, academicYear) {
        return getOne(`
      SELECT * FROM student_classifications 
      WHERE student_id = ? AND faculty_id = ? AND semester = ? AND academic_year = ?
    `, [studentId, facultyId, semester, academicYear]);
    }

    static create({ studentId, facultyId, category, reason, academicYear, semester }) {
        const result = runQuery(`
      INSERT INTO student_classifications (student_id, faculty_id, category, reason, academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [studentId, facultyId, category, reason, academicYear, semester]);
        return this.getById(result.lastInsertRowid);
    }

    static update(id, { category, reason }) {
        const updates = [];
        const params = [];

        if (category !== undefined) { updates.push('category = ?'); params.push(category); }
        if (reason !== undefined) { updates.push('reason = ?'); params.push(reason); }

        if (updates.length === 0) return this.getById(id);

        params.push(id);
        runQuery(`UPDATE student_classifications SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.getById(id);
    }

    static delete(id) {
        // First delete related activities and reviews
        const activities = getAll('SELECT id FROM activities WHERE classification_id = ?', [id]);
        for (const activity of activities) {
            runQuery('DELETE FROM activity_reviews WHERE activity_id = ?', [activity.id]);
            runQuery('DELETE FROM review_reminders WHERE activity_id = ?', [activity.id]);
        }
        runQuery('DELETE FROM activities WHERE classification_id = ?', [id]);
        return runQuery('DELETE FROM student_classifications WHERE id = ?', [id]);
    }

    static getStats(facultyId = null, departmentId = null) {
        let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sc.category = 'weak' THEN 1 ELSE 0 END) as weak_count,
        SUM(CASE WHEN sc.category = 'strong' THEN 1 ELSE 0 END) as strong_count
      FROM student_classifications sc
      JOIN students s ON sc.student_id = s.id
    `;
        const conditions = [];
        const params = [];

        if (facultyId) {
            conditions.push('sc.faculty_id = ?');
            params.push(facultyId);
        }
        if (departmentId) {
            conditions.push('s.department_id = ?');
            params.push(departmentId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        return getOne(query, params) || { total: 0, weak_count: 0, strong_count: 0 };
    }
}

module.exports = Classification;
