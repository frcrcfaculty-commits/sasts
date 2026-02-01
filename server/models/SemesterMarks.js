const { getOne, getAll, runQuery } = require('../config/database');

class SemesterMarks {
    static getById(id) {
        return getOne(`
      SELECT sm.*, d.name as department_name, u.name as uploaded_by_name
      FROM semester_marks sm
      JOIN departments d ON sm.department_id = d.id
      JOIN users u ON sm.uploaded_by = u.id
      WHERE sm.id = ?
    `, [id]);
    }

    static getAll(departmentId = null, year = null) {
        let query = `
      SELECT sm.*, d.name as department_name, u.name as uploaded_by_name
      FROM semester_marks sm
      JOIN departments d ON sm.department_id = d.id
      JOIN users u ON sm.uploaded_by = u.id
    `;
        const conditions = [];
        const params = [];

        if (departmentId) {
            conditions.push('sm.department_id = ?');
            params.push(departmentId);
        }
        if (year) {
            conditions.push('sm.year = ?');
            params.push(year);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY sm.created_at DESC';

        return getAll(query, params);
    }

    static create({ departmentId, uploadedBy, semester, academicYear, year, fileName, parsedData, uploadType = 'semester' }) {
        const result = runQuery(`
      INSERT INTO semester_marks (department_id, uploaded_by, semester, academic_year, year, file_name, parsed_data, upload_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [departmentId, uploadedBy, semester, academicYear, year, fileName, JSON.stringify(parsedData), uploadType]);
        return this.getById(result.lastInsertRowid);
    }

    static delete(id) {
        // Delete related student marks and AI suggestions first
        runQuery('DELETE FROM student_marks WHERE marks_upload_id = ?', [id]);
        runQuery('DELETE FROM ai_suggestions WHERE marks_upload_id = ?', [id]);
        return runQuery('DELETE FROM semester_marks WHERE id = ?', [id]);
    }

    // Save individual student marks
    static saveStudentMark({ marksUploadId, studentId, subject, marksObtained, maxMarks = 100, grade }) {
        const percentage = (marksObtained / maxMarks) * 100;
        const result = runQuery(`
      INSERT INTO student_marks (marks_upload_id, student_id, subject, marks_obtained, max_marks, percentage, grade)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [marksUploadId, studentId, subject, marksObtained, maxMarks, percentage, grade]);
        return result.lastInsertRowid;
    }

    static getStudentMarks(marksUploadId) {
        return getAll(`
      SELECT stm.*, s.name as student_name, s.roll_number
      FROM student_marks stm
      JOIN students s ON stm.student_id = s.id
      WHERE stm.marks_upload_id = ?
      ORDER BY stm.percentage DESC
    `, [marksUploadId]);
    }

    // Get top N and bottom N students from a marks upload
    static getTopAndBottomStudents(marksUploadId, count = 10) {
        const top = getAll(`
      SELECT stm.*, s.name as student_name, s.roll_number, s.id as student_id
      FROM student_marks stm
      JOIN students s ON stm.student_id = s.id
      WHERE stm.marks_upload_id = ?
      ORDER BY stm.percentage DESC
      LIMIT ?
    `, [marksUploadId, count]);

        const bottom = getAll(`
      SELECT stm.*, s.name as student_name, s.roll_number, s.id as student_id
      FROM student_marks stm
      JOIN students s ON stm.student_id = s.id
      WHERE stm.marks_upload_id = ?
      ORDER BY stm.percentage ASC
      LIMIT ?
    `, [marksUploadId, count]);

        return { top, bottom };
    }
}

module.exports = SemesterMarks;
