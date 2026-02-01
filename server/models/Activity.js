const { getOne, getAll, runQuery } = require('../config/database');

class Activity {
    static getAll(classificationId = null, facultyId = null) {
        let query = `
      SELECT a.*, 
             sc.category, sc.student_id, sc.faculty_id,
             s.name as student_name, s.roll_number, s.email as student_email,
             u.name as faculty_name
      FROM activities a
      JOIN student_classifications sc ON a.classification_id = sc.id
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON sc.faculty_id = u.id
    `;
        const conditions = [];
        const params = [];

        if (classificationId) {
            conditions.push('a.classification_id = ?');
            params.push(classificationId);
        }
        if (facultyId) {
            conditions.push('sc.faculty_id = ?');
            params.push(facultyId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY a.created_at DESC';

        return getAll(query, params);
    }

    static getById(id) {
        return getOne(`
      SELECT a.*, 
             sc.category, sc.student_id, sc.faculty_id,
             s.name as student_name, s.roll_number, s.email as student_email,
             u.name as faculty_name
      FROM activities a
      JOIN student_classifications sc ON a.classification_id = sc.id
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON sc.faculty_id = u.id
      WHERE a.id = ?
    `, [id]);
    }

    static getByDepartment(departmentId, status = null) {
        let query = `
      SELECT a.*, 
             sc.category, sc.student_id, sc.faculty_id,
             s.name as student_name, s.roll_number, s.email as student_email,
             u.name as faculty_name, d.name as department_name
      FROM activities a
      JOIN student_classifications sc ON a.classification_id = sc.id
      JOIN students s ON sc.student_id = s.id
      JOIN users u ON sc.faculty_id = u.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.department_id = ?
    `;
        const params = [departmentId];

        if (status) {
            query += ' AND a.completion_status = ?';
            params.push(status);
        }
        query += ' ORDER BY a.created_at DESC';

        return getAll(query, params);
    }

    static create({ classificationId, activityType, title, description, scheduledDate }) {
        const result = runQuery(`
      INSERT INTO activities (classification_id, activity_type, title, description, scheduled_date)
      VALUES (?, ?, ?, ?, ?)
    `, [classificationId, activityType, title, description, scheduledDate || null]);
        return this.getById(result.lastInsertRowid);
    }

    static update(id, { activityType, title, description, scheduledDate, completionStatus }) {
        const updates = [];
        const params = [];

        if (activityType !== undefined) { updates.push('activity_type = ?'); params.push(activityType); }
        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (scheduledDate !== undefined) { updates.push('scheduled_date = ?'); params.push(scheduledDate); }
        if (completionStatus !== undefined) {
            updates.push('completion_status = ?');
            params.push(completionStatus);
            if (completionStatus === 'completed') {
                updates.push('completed_at = datetime(\'now\')');
            }
        }

        if (updates.length === 0) return this.getById(id);

        params.push(id);
        runQuery(`UPDATE activities SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.getById(id);
    }

    static markCompleted(id) {
        return this.update(id, { completionStatus: 'completed' });
    }

    static delete(id) {
        runQuery('DELETE FROM activity_reviews WHERE activity_id = ?', [id]);
        runQuery('DELETE FROM review_reminders WHERE activity_id = ?', [id]);
        return runQuery('DELETE FROM activities WHERE id = ?', [id]);
    }

    static getStats(facultyId = null, departmentId = null) {
        let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN a.completion_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN a.completion_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN sc.category = 'weak' THEN 1 ELSE 0 END) as weak_activities,
        SUM(CASE WHEN sc.category = 'strong' THEN 1 ELSE 0 END) as strong_activities
      FROM activities a
      JOIN student_classifications sc ON a.classification_id = sc.id
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

        return getOne(query, params) || { total: 0, completed: 0, pending: 0, weak_activities: 0, strong_activities: 0 };
    }

    static getTypeBreakdown(facultyId = null, departmentId = null) {
        let query = `
      SELECT a.activity_type, COUNT(*) as count
      FROM activities a
      JOIN student_classifications sc ON a.classification_id = sc.id
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
        query += ' GROUP BY a.activity_type';

        return getAll(query, params);
    }
}

module.exports = Activity;
