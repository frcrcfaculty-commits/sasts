const { getOne, getAll, runQuery } = require('../config/database');

class AISuggestion {
    static getById(id) {
        return getOne(`
      SELECT ai.*, s.name as student_name, s.roll_number, s.email as student_email,
             sm.semester, sm.academic_year, sm.year,
             u.name as applied_by_name
      FROM ai_suggestions ai
      JOIN students s ON ai.student_id = s.id
      JOIN semester_marks sm ON ai.marks_upload_id = sm.id
      LEFT JOIN users u ON ai.applied_by = u.id
      WHERE ai.id = ?
    `, [id]);
    }

    static getByMarksUpload(marksUploadId, isApplied = null) {
        let query = `
      SELECT ai.*, s.name as student_name, s.roll_number, s.email as student_email
      FROM ai_suggestions ai
      JOIN students s ON ai.student_id = s.id
      WHERE ai.marks_upload_id = ?
    `;
        const params = [marksUploadId];

        if (isApplied !== null) {
            query += ' AND ai.is_applied = ?';
            params.push(isApplied ? 1 : 0);
        }
        query += ' ORDER BY ai.confidence_score DESC';

        return getAll(query, params);
    }

    static getPending(departmentId = null) {
        let query = `
      SELECT ai.*, s.name as student_name, s.roll_number, s.email as student_email,
             sm.semester, sm.academic_year, d.name as department_name
      FROM ai_suggestions ai
      JOIN students s ON ai.student_id = s.id
      JOIN semester_marks sm ON ai.marks_upload_id = sm.id
      JOIN departments d ON sm.department_id = d.id
      WHERE ai.is_applied = 0
    `;
        const params = [];

        if (departmentId) {
            query += ' AND sm.department_id = ?';
            params.push(departmentId);
        }
        query += ' ORDER BY ai.confidence_score DESC';

        return getAll(query, params);
    }

    static create({ marksUploadId, studentId, suggestedCategory, confidenceScore, reason }) {
        const result = runQuery(`
      INSERT INTO ai_suggestions (marks_upload_id, student_id, suggested_category, confidence_score, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [marksUploadId, studentId, suggestedCategory, confidenceScore, reason]);
        return this.getById(result.lastInsertRowid);
    }

    static createBulk(suggestions) {
        const results = [];
        for (const s of suggestions) {
            const result = this.create(s);
            results.push(result);
        }
        return results;
    }

    static apply(id, appliedBy) {
        runQuery(`
      UPDATE ai_suggestions 
      SET is_applied = 1, applied_by = ?, applied_at = datetime('now')
      WHERE id = ?
    `, [appliedBy, id]);
        return this.getById(id);
    }

    static applyBulk(ids, appliedBy) {
        for (const id of ids) {
            this.apply(id, appliedBy);
        }
    }

    static dismiss(id) {
        return runQuery('DELETE FROM ai_suggestions WHERE id = ?', [id]);
    }

    static getStats(departmentId = null) {
        let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_applied = 1 THEN 1 ELSE 0 END) as applied,
        SUM(CASE WHEN is_applied = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN suggested_category = 'weak' THEN 1 ELSE 0 END) as weak_suggestions,
        SUM(CASE WHEN suggested_category = 'strong' THEN 1 ELSE 0 END) as strong_suggestions
      FROM ai_suggestions ai
      JOIN semester_marks sm ON ai.marks_upload_id = sm.id
    `;
        const params = [];

        if (departmentId) {
            query += ' WHERE sm.department_id = ?';
            params.push(departmentId);
        }

        return getOne(query, params) || { total: 0, applied: 0, pending: 0, weak_suggestions: 0, strong_suggestions: 0 };
    }
}

module.exports = AISuggestion;
