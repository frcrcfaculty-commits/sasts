const { getOne, getAll, runQuery } = require('../config/database');

class StudentSession {
    static getById(id) {
        return getOne(`
      SELECT sas.*, s.name as student_name, s.roll_number,
             ga.title as activity_title, ga.activity_type, ga.max_score as activity_max_score
      FROM student_activity_sessions sas
      JOIN students s ON sas.student_id = s.id
      JOIN generated_activities ga ON sas.activity_id = ga.id
      WHERE sas.id = ?
    `, [id]);
    }

    static getByStudentAndActivity(studentId, activityId) {
        return getAll(`
      SELECT sas.*, ga.title as activity_title, ga.activity_type
      FROM student_activity_sessions sas
      JOIN generated_activities ga ON sas.activity_id = ga.id
      WHERE sas.student_id = ? AND sas.activity_id = ?
      ORDER BY sas.started_at DESC
    `, [studentId, activityId]);
    }

    static getByStudent(studentId, completed = null) {
        let query = `
      SELECT sas.*, ga.title as activity_title, ga.activity_type, ga.max_score as activity_max_score,
             sy.course_name
      FROM student_activity_sessions sas
      JOIN generated_activities ga ON sas.activity_id = ga.id
      JOIN syllabi sy ON ga.syllabus_id = sy.id
      WHERE sas.student_id = ?
    `;
        const params = [studentId];

        if (completed !== null) {
            query += ' AND sas.completed = ?';
            params.push(completed ? 1 : 0);
        }
        query += ' ORDER BY sas.started_at DESC';

        return getAll(query, params);
    }

    static startSession(studentId, activityId) {
        const result = runQuery(`
      INSERT INTO student_activity_sessions (student_id, activity_id, started_at)
      VALUES (?, ?, datetime('now'))
    `, [studentId, activityId]);
        return this.getById(result.lastInsertRowid);
    }

    static endSession(id, { timeSpent, score, maxScore, answers, completed = true }) {
        runQuery(`
      UPDATE student_activity_sessions 
      SET ended_at = datetime('now'), time_spent = ?, score = ?, max_score = ?, answers = ?, completed = ?
      WHERE id = ?
    `, [timeSpent, score, maxScore, JSON.stringify(answers), completed ? 1 : 0, id]);
        return this.getById(id);
    }

    static getStudentStats(studentId) {
        return getOne(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
        SUM(time_spent) as total_time_spent,
        AVG(CASE WHEN completed = 1 AND max_score > 0 THEN (score * 100.0 / max_score) ELSE NULL END) as avg_score_percentage,
        MAX(score) as best_score,
        COUNT(DISTINCT activity_id) as unique_activities
      FROM student_activity_sessions
      WHERE student_id = ?
    `, [studentId]) || { total_sessions: 0, completed_sessions: 0, total_time_spent: 0 };
    }

    static getActivityStats(activityId) {
        return getOne(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT student_id) as unique_students,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completions,
        AVG(time_spent) as avg_time_spent,
        AVG(CASE WHEN completed = 1 AND max_score > 0 THEN (score * 100.0 / max_score) ELSE NULL END) as avg_score_percentage,
        MAX(score) as highest_score,
        MIN(CASE WHEN completed = 1 THEN score ELSE NULL END) as lowest_score
      FROM student_activity_sessions
      WHERE activity_id = ?
    `, [activityId]) || { total_attempts: 0, unique_students: 0, completions: 0 };
    }

    static getFacultyStats(facultyId) {
        return getOne(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(DISTINCT sas.student_id) as unique_students,
        SUM(CASE WHEN sas.completed = 1 THEN 1 ELSE 0 END) as completions,
        AVG(sas.time_spent) as avg_time_spent,
        AVG(CASE WHEN sas.completed = 1 AND sas.max_score > 0 THEN (sas.score * 100.0 / sas.max_score) ELSE NULL END) as avg_score_percentage
      FROM student_activity_sessions sas
      JOIN generated_activities ga ON sas.activity_id = ga.id
      WHERE ga.faculty_id = ?
    `, [facultyId]) || { total_sessions: 0, unique_students: 0, completions: 0 };
    }

    static getDepartmentStats(departmentId) {
        return getOne(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(DISTINCT sas.student_id) as unique_students,
        SUM(CASE WHEN sas.completed = 1 THEN 1 ELSE 0 END) as completions,
        AVG(sas.time_spent) as avg_time_spent,
        AVG(CASE WHEN sas.completed = 1 AND sas.max_score > 0 THEN (sas.score * 100.0 / sas.max_score) ELSE NULL END) as avg_score_percentage
      FROM student_activity_sessions sas
      JOIN generated_activities ga ON sas.activity_id = ga.id
      JOIN syllabi sy ON ga.syllabus_id = sy.id
      WHERE sy.department_id = ?
    `, [departmentId]) || { total_sessions: 0, unique_students: 0, completions: 0 };
    }

    static getLeaderboard(activityId, limit = 10) {
        return getAll(`
      SELECT sas.student_id, s.name as student_name, s.roll_number,
             MAX(sas.score) as best_score, MIN(sas.time_spent) as best_time
      FROM student_activity_sessions sas
      JOIN students s ON sas.student_id = s.id
      WHERE sas.activity_id = ? AND sas.completed = 1
      GROUP BY sas.student_id
      ORDER BY best_score DESC, best_time ASC
      LIMIT ?
    `, [activityId, limit]);
    }
}

module.exports = StudentSession;
