const { getOne, getAll, runQuery } = require('../config/database');

class Department {
    static getAll() {
        return getAll('SELECT * FROM departments ORDER BY name');
    }

    static getById(id) {
        return getOne('SELECT * FROM departments WHERE id = ?', [id]);
    }

    static getByName(name) {
        return getOne('SELECT * FROM departments WHERE name = ?', [name]);
    }

    static create(name) {
        const result = runQuery('INSERT INTO departments (name) VALUES (?)', [name]);
        return this.getById(result.lastInsertRowid);
    }

    static update(id, name) {
        runQuery('UPDATE departments SET name = ? WHERE id = ?', [name, id]);
        return this.getById(id);
    }

    static delete(id) {
        return runQuery('DELETE FROM departments WHERE id = ?', [id]);
    }

    static getStats(id) {
        const facultyCount = getOne('SELECT COUNT(*) as count FROM users WHERE department_id = ? AND role = ?', [id, 'faculty']);
        const studentCount = getOne('SELECT COUNT(*) as count FROM students WHERE department_id = ?', [id]);
        const weakCount = getOne(`
      SELECT COUNT(*) as count FROM student_classifications sc 
      JOIN students s ON sc.student_id = s.id 
      WHERE s.department_id = ? AND sc.category = 'weak'
    `, [id]);
        const strongCount = getOne(`
      SELECT COUNT(*) as count FROM student_classifications sc 
      JOIN students s ON sc.student_id = s.id 
      WHERE s.department_id = ? AND sc.category = 'strong'
    `, [id]);

        return {
            faculty_count: facultyCount?.count || 0,
            student_count: studentCount?.count || 0,
            weak_count: weakCount?.count || 0,
            strong_count: strongCount?.count || 0
        };
    }
}

module.exports = Department;
