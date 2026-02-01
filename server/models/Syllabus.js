const { getOne, getAll, runQuery } = require('../config/database');

class Syllabus {
    static getById(id) {
        return getOne(`
      SELECT sy.*, u.name as faculty_name, d.name as department_name
      FROM syllabi sy
      JOIN users u ON sy.faculty_id = u.id
      JOIN departments d ON sy.department_id = d.id
      WHERE sy.id = ?
    `, [id]);
    }

    static getAll(facultyId = null, departmentId = null) {
        let query = `
      SELECT sy.*, u.name as faculty_name, d.name as department_name
      FROM syllabi sy
      JOIN users u ON sy.faculty_id = u.id
      JOIN departments d ON sy.department_id = d.id
    `;
        const conditions = [];
        const params = [];

        if (facultyId) {
            conditions.push('sy.faculty_id = ?');
            params.push(facultyId);
        }
        if (departmentId) {
            conditions.push('sy.department_id = ?');
            params.push(departmentId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY sy.created_at DESC';

        return getAll(query, params);
    }

    static create({ facultyId, departmentId, courseName, courseCode, fileName, parsedModules }) {
        const result = runQuery(`
      INSERT INTO syllabi (faculty_id, department_id, course_name, course_code, file_name, parsed_modules)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [facultyId, departmentId, courseName, courseCode, fileName, JSON.stringify(parsedModules)]);
        return this.getById(result.lastInsertRowid);
    }

    static update(id, { courseName, courseCode, parsedModules }) {
        const updates = [];
        const params = [];

        if (courseName) { updates.push('course_name = ?'); params.push(courseName); }
        if (courseCode) { updates.push('course_code = ?'); params.push(courseCode); }
        if (parsedModules) { updates.push('parsed_modules = ?'); params.push(JSON.stringify(parsedModules)); }

        if (updates.length === 0) return this.getById(id);

        params.push(id);
        runQuery(`UPDATE syllabi SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.getById(id);
    }

    static delete(id) {
        // Delete related modules and generated activities
        runQuery('DELETE FROM syllabus_modules WHERE syllabus_id = ?', [id]);
        runQuery('DELETE FROM generated_activities WHERE syllabus_id = ?', [id]);
        return runQuery('DELETE FROM syllabi WHERE id = ?', [id]);
    }

    // Module management
    static addModule({ syllabusId, moduleNumber, moduleName, topics, hours }) {
        const result = runQuery(`
      INSERT INTO syllabus_modules (syllabus_id, module_number, module_name, topics, hours)
      VALUES (?, ?, ?, ?, ?)
    `, [syllabusId, moduleNumber, moduleName, topics, hours]);
        return getOne('SELECT * FROM syllabus_modules WHERE id = ?', [result.lastInsertRowid]);
    }

    static getModules(syllabusId) {
        return getAll(`
      SELECT * FROM syllabus_modules 
      WHERE syllabus_id = ? 
      ORDER BY module_number
    `, [syllabusId]);
    }

    static getModule(moduleId) {
        return getOne('SELECT * FROM syllabus_modules WHERE id = ?', [moduleId]);
    }

    static deleteModule(moduleId) {
        runQuery('DELETE FROM generated_activities WHERE module_id = ?', [moduleId]);
        return runQuery('DELETE FROM syllabus_modules WHERE id = ?', [moduleId]);
    }
}

module.exports = Syllabus;
