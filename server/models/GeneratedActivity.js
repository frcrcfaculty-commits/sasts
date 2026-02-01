const { getOne, getAll, runQuery } = require('../config/database');

class GeneratedActivity {
    static getById(id) {
        return getOne(`
      SELECT ga.*, sy.course_name, sy.course_code, sm.module_name,
             u.name as faculty_name, d.name as department_name
      FROM generated_activities ga
      JOIN syllabi sy ON ga.syllabus_id = sy.id
      LEFT JOIN syllabus_modules sm ON ga.module_id = sm.id
      JOIN users u ON ga.faculty_id = u.id
      JOIN departments d ON sy.department_id = d.id
      WHERE ga.id = ?
    `, [id]);
    }

    static getAll(facultyId = null, syllabusId = null, isPublished = null) {
        let query = `
      SELECT ga.*, sy.course_name, sy.course_code, sm.module_name,
             u.name as faculty_name
      FROM generated_activities ga
      JOIN syllabi sy ON ga.syllabus_id = sy.id
      LEFT JOIN syllabus_modules sm ON ga.module_id = sm.id
      JOIN users u ON ga.faculty_id = u.id
    `;
        const conditions = [];
        const params = [];

        if (facultyId) {
            conditions.push('ga.faculty_id = ?');
            params.push(facultyId);
        }
        if (syllabusId) {
            conditions.push('ga.syllabus_id = ?');
            params.push(syllabusId);
        }
        if (isPublished !== null) {
            conditions.push('ga.is_published = ?');
            params.push(isPublished ? 1 : 0);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY ga.created_at DESC';

        return getAll(query, params);
    }

    static getByDepartment(departmentId, isPublished = null) {
        let query = `
      SELECT ga.*, sy.course_name, sy.course_code, sm.module_name,
             u.name as faculty_name
      FROM generated_activities ga
      JOIN syllabi sy ON ga.syllabus_id = sy.id
      LEFT JOIN syllabus_modules sm ON ga.module_id = sm.id
      JOIN users u ON ga.faculty_id = u.id
      WHERE sy.department_id = ?
    `;
        const params = [departmentId];

        if (isPublished !== null) {
            query += ' AND ga.is_published = ?';
            params.push(isPublished ? 1 : 0);
        }
        query += ' ORDER BY ga.created_at DESC';

        return getAll(query, params);
    }

    static create({ syllabusId, moduleId, facultyId, title, activityType, content, difficulty = 'medium', timeLimit, maxScore = 100 }) {
        const result = runQuery(`
      INSERT INTO generated_activities (syllabus_id, module_id, faculty_id, title, activity_type, content, difficulty, time_limit, max_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [syllabusId, moduleId, facultyId, title, activityType, JSON.stringify(content), difficulty, timeLimit, maxScore]);
        return this.getById(result.lastInsertRowid);
    }

    static update(id, { title, content, difficulty, timeLimit, maxScore }) {
        const updates = [];
        const params = [];

        if (title) { updates.push('title = ?'); params.push(title); }
        if (content) { updates.push('content = ?'); params.push(JSON.stringify(content)); }
        if (difficulty) { updates.push('difficulty = ?'); params.push(difficulty); }
        if (timeLimit !== undefined) { updates.push('time_limit = ?'); params.push(timeLimit); }
        if (maxScore !== undefined) { updates.push('max_score = ?'); params.push(maxScore); }

        if (updates.length === 0) return this.getById(id);

        params.push(id);
        runQuery(`UPDATE generated_activities SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.getById(id);
    }

    static publish(id) {
        runQuery(`
      UPDATE generated_activities 
      SET is_published = 1, published_at = datetime('now')
      WHERE id = ?
    `, [id]);
        return this.getById(id);
    }

    static unpublish(id) {
        runQuery('UPDATE generated_activities SET is_published = 0, published_at = NULL WHERE id = ?', [id]);
        return this.getById(id);
    }

    static delete(id) {
        runQuery('DELETE FROM activity_assignments WHERE activity_id = ?', [id]);
        runQuery('DELETE FROM student_activity_sessions WHERE activity_id = ?', [id]);
        return runQuery('DELETE FROM generated_activities WHERE id = ?', [id]);
    }

    // Assignment management
    static assignToStudent(activityId, studentId, dueDate = null) {
        const result = runQuery(`
      INSERT OR IGNORE INTO activity_assignments (activity_id, student_id, due_date)
      VALUES (?, ?, ?)
    `, [activityId, studentId, dueDate]);
        return result.changes > 0;
    }

    static assignToMultipleStudents(activityId, studentIds, dueDate = null) {
        for (const studentId of studentIds) {
            this.assignToStudent(activityId, studentId, dueDate);
        }
    }

    static getAssignedStudents(activityId) {
        return getAll(`
      SELECT aa.*, s.name as student_name, s.roll_number, s.email
      FROM activity_assignments aa
      JOIN students s ON aa.student_id = s.id
      WHERE aa.activity_id = ?
    `, [activityId]);
    }

    static getStudentActivities(studentId) {
        return getAll(`
      SELECT ga.*, aa.assigned_at, aa.due_date, sy.course_name,
             (SELECT COUNT(*) FROM student_activity_sessions sas 
              WHERE sas.activity_id = ga.id AND sas.student_id = ? AND sas.completed = 1) as is_completed
      FROM generated_activities ga
      JOIN activity_assignments aa ON ga.id = aa.activity_id
      JOIN syllabi sy ON ga.syllabus_id = sy.id
      WHERE aa.student_id = ? AND ga.is_published = 1
      ORDER BY aa.assigned_at DESC
    `, [studentId, studentId]);
    }

    static getStats(facultyId = null, departmentId = null) {
        let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END) as drafts,
        SUM(CASE WHEN activity_type = 'mcq' THEN 1 ELSE 0 END) as mcq_count,
        SUM(CASE WHEN activity_type = 'crossword' THEN 1 ELSE 0 END) as crossword_count,
        SUM(CASE WHEN activity_type = 'puzzle' THEN 1 ELSE 0 END) as puzzle_count
      FROM generated_activities ga
      JOIN syllabi sy ON ga.syllabus_id = sy.id
    `;
        const conditions = [];
        const params = [];

        if (facultyId) {
            conditions.push('ga.faculty_id = ?');
            params.push(facultyId);
        }
        if (departmentId) {
            conditions.push('sy.department_id = ?');
            params.push(departmentId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        return getOne(query, params) || { total: 0, published: 0, drafts: 0 };
    }
}

module.exports = GeneratedActivity;
