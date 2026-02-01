const { getOne, getAll, runQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static getAll(departmentId = null) {
        if (departmentId) {
            return getAll(`
        SELECT u.id, u.email, u.name, u.role, u.department_id, u.is_active, u.created_at,
               d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.department_id = ?
        ORDER BY u.name
      `, [departmentId]);
        }
        return getAll(`
      SELECT u.id, u.email, u.name, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.name
    `);
    }

    static getById(id) {
        return getOne(`
      SELECT u.id, u.email, u.name, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [id]);
    }

    static getByEmail(email) {
        return getOne('SELECT * FROM users WHERE email = ?', [email]);
    }

    static getFacultyByDepartment(departmentId) {
        return getAll(`
      SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at
      FROM users u
      WHERE u.department_id = ? AND u.role = 'faculty'
      ORDER BY u.name
    `, [departmentId]);
    }

    static getAdminsByDepartment(departmentId) {
        return getAll(`
      SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at
      FROM users u
      WHERE u.department_id = ? AND u.role = 'admin'
      ORDER BY u.name
    `, [departmentId]);
    }

    static create({ email, password, name, role, departmentId }) {
        const passwordHash = bcrypt.hashSync(password, 10);
        const result = runQuery(`
      INSERT INTO users (email, password_hash, name, role, department_id)
      VALUES (?, ?, ?, ?, ?)
    `, [email, passwordHash, name, role, departmentId]);

        // Handle BigInt conversion and get the new user
        const insertId = Number(result.lastInsertRowid);
        if (!insertId) {
            console.error('User.create failed - no lastInsertRowid returned', result);
            return null;
        }
        return this.getById(insertId);
    }

    static update(id, { name, email, departmentId, isActive }) {
        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email);
        }
        if (departmentId !== undefined) {
            updates.push('department_id = ?');
            params.push(departmentId);
        }
        if (isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) return this.getById(id);

        params.push(id);
        runQuery(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.getById(id);
    }

    static updatePassword(id, newPassword) {
        const passwordHash = bcrypt.hashSync(newPassword, 10);
        return runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    }

    static verifyPassword(user, password) {
        return bcrypt.compareSync(password, user.password_hash);
    }

    static deactivate(id) {
        return runQuery('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    }

    static activate(id) {
        return runQuery('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
    }

    static delete(id) {
        return runQuery('DELETE FROM users WHERE id = ?', [id]);
    }
}

module.exports = User;
