const express = require('express');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const User = require('../models/User');
const Department = require('../models/Department');
const Classification = require('../models/Classification');
const Activity = require('../models/Activity');
const Review = require('../models/Review');
const Reminder = require('../models/Reminder');

const router = express.Router();

// All superadmin routes require superadmin role
router.use(auth);
router.use(requireRole(['superadmin']));

// Department Management
router.get('/departments', (req, res) => {
    try {
        const departments = Department.getAll();

        // Add stats for each department
        const departmentsWithStats = departments.map(dept => ({
            ...dept,
            stats: Department.getStats(dept.id)
        }));

        res.json({ departments: departmentsWithStats });
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

router.post('/departments', (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim().length < 3) {
            return res.status(400).json({ error: true, message: 'Department name must be at least 3 characters', code: 'INVALID_NAME' });
        }

        // Check if exists
        const existing = Department.getByName(name.trim());
        if (existing) {
            return res.status(400).json({ error: true, message: 'Department already exists', code: 'ALREADY_EXISTS' });
        }

        const department = Department.create(name.trim());
        res.status(201).json({ message: 'Department created', department });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

router.put('/departments/:id', (req, res) => {
    try {
        const { name } = req.body;
        const deptId = parseInt(req.params.id);

        if (!name || name.trim().length < 3) {
            return res.status(400).json({ error: true, message: 'Department name must be at least 3 characters', code: 'INVALID_NAME' });
        }

        const existing = Department.getByName(name.trim());
        if (existing && existing.id !== deptId) {
            return res.status(400).json({ error: true, message: 'Department name already in use', code: 'NAME_EXISTS' });
        }

        const department = Department.update(deptId, name.trim());
        res.json({ message: 'Department updated', department });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Admin Management
router.get('/admins', (req, res) => {
    try {
        const users = User.getAll();
        const admins = users.filter(u => u.role === 'admin');
        res.json({ admins });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

router.post('/admins', (req, res) => {
    try {
        const { email, password, name, departmentId } = req.body;

        if (!email || !password || !name || !departmentId) {
            return res.status(400).json({ error: true, message: 'All fields are required', code: 'MISSING_FIELDS' });
        }

        // Check email exists
        const existing = User.getByEmail(email);
        if (existing) {
            return res.status(400).json({ error: true, message: 'Email already registered', code: 'EMAIL_EXISTS' });
        }

        // Check department exists
        const dept = Department.getById(parseInt(departmentId));
        if (!dept) {
            return res.status(400).json({ error: true, message: 'Invalid department', code: 'INVALID_DEPARTMENT' });
        }

        // Check max 2 admins per department
        const existingAdmins = User.getAdminsByDepartment(parseInt(departmentId));
        if (existingAdmins.length >= 2) {
            return res.status(400).json({ error: true, message: 'Maximum 2 admins per department', code: 'MAX_ADMINS' });
        }

        const user = User.create({
            email,
            password,
            name,
            role: 'admin',
            departmentId: parseInt(departmentId)
        });

        res.status(201).json({ message: 'Admin created', user });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// College-wide Statistics
router.get('/stats', (req, res) => {
    try {
        const departments = Department.getAll();

        // Aggregate stats
        let totalFaculty = 0;
        let totalStudents = 0;
        let totalWeak = 0;
        let totalStrong = 0;

        const departmentStats = departments.map(dept => {
            const stats = Department.getStats(dept.id);
            totalFaculty += stats.faculty_count || 0;
            totalStudents += stats.student_count || 0;
            totalWeak += stats.weak_count || 0;
            totalStrong += stats.strong_count || 0;

            return { ...dept, stats };
        });

        const activityStats = Activity.getStats();
        const reviewStats = Reminder.getStats();

        res.json({
            summary: {
                totalDepartments: departments.length,
                totalFaculty,
                totalStudents,
                totalWeak,
                totalStrong
            },
            departments: departmentStats,
            activities: activityStats,
            reviews: reviewStats
        });
    } catch (error) {
        console.error('Get college stats error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get all users across college
router.get('/users', (req, res) => {
    try {
        const { role, departmentId } = req.query;
        let users = User.getAll(departmentId ? parseInt(departmentId) : null);

        if (role) {
            users = users.filter(u => u.role === role);
        }

        res.json({ users });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Bulk marks upload for all/selected departments
router.post('/marks/bulk-upload', async (req, res) => {
    try {
        const { marksData, departmentIds, semester, academicYear, uploadType = 'semester' } = req.body;

        if (!marksData || !Array.isArray(marksData) || marksData.length === 0) {
            return res.status(400).json({ error: true, message: 'Marks data is required', code: 'MISSING_DATA' });
        }

        const { runQuery, getOne, getAll, saveDatabase } = require('../config/database');
        const results = { processed: 0, created: 0, updated: 0, errors: [] };

        // Get departments to process
        let departments = Department.getAll();
        if (departmentIds && departmentIds.length > 0) {
            departments = departments.filter(d => departmentIds.includes(d.id));
        }

        for (const record of marksData) {
            try {
                const { rollNumber, studentName, email, marks, subject, departmentId } = record;

                // Find or create student
                let student = getOne('SELECT id FROM students WHERE roll_number = ?', [rollNumber]);

                if (!student && studentName) {
                    // Create student
                    const deptId = departmentId || (departments[0]?.id || 1);
                    runQuery(
                        'INSERT INTO students (name, roll_number, email, semester, department_id) VALUES (?, ?, ?, ?, ?)',
                        [studentName, rollNumber, email || '', semester || 5, deptId]
                    );
                    student = getOne('SELECT id FROM students WHERE roll_number = ?', [rollNumber]);
                    results.created++;
                }

                if (student) {
                    // Create marks upload record
                    const uploadResult = runQuery(
                        'INSERT INTO semester_marks (department_id, uploaded_by, semester, academic_year, year, upload_type) VALUES (?, ?, ?, ?, ?, ?)',
                        [departmentId || 1, req.user.id, semester || 5, academicYear || '2025-2026', 1, uploadType]
                    );

                    // Insert individual marks
                    runQuery(
                        'INSERT INTO student_marks (marks_upload_id, student_id, subject, marks_obtained, max_marks, percentage) VALUES (?, ?, ?, ?, ?, ?)',
                        [uploadResult.lastInsertRowid, student.id, subject || 'General', marks, 100, marks]
                    );

                    results.processed++;
                } else {
                    results.errors.push({ rollNumber, error: 'Could not find or create student' });
                }
            } catch (err) {
                results.errors.push({ rollNumber: record.rollNumber, error: err.message });
            }
        }

        saveDatabase();

        res.json({
            message: 'Bulk upload completed',
            results
        });
    } catch (error) {
        console.error('Bulk marks upload error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Send bulk notifications to all students
router.post('/notifications/send', async (req, res) => {
    try {
        const { title, message, departmentIds, notificationType = 'info' } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: true, message: 'Title and message are required', code: 'MISSING_FIELDS' });
        }

        const { runQuery, getAll, saveDatabase } = require('../config/database');

        // Get students to notify
        let query = 'SELECT id FROM students';
        if (departmentIds && departmentIds.length > 0) {
            query += ` WHERE department_id IN (${departmentIds.join(',')})`;
        }
        const students = getAll(query);

        let notified = 0;
        for (const student of students) {
            runQuery(
                'INSERT INTO notifications (recipient_type, recipient_id, title, message, notification_type) VALUES (?, ?, ?, ?, ?)',
                ['student', student.id, title, message, notificationType]
            );
            notified++;
        }

        saveDatabase();

        res.json({
            message: 'Notifications sent',
            count: notified
        });
    } catch (error) {
        console.error('Send notifications error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Update user status (activate/deactivate)
router.put('/users/:id/status', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { isActive } = req.body;

        const user = User.getById(userId);
        if (!user) {
            return res.status(404).json({ error: true, message: 'User not found', code: 'NOT_FOUND' });
        }

        // Can't deactivate self
        if (userId === req.user.id) {
            return res.status(400).json({ error: true, message: 'Cannot change your own status', code: 'SELF_UPDATE' });
        }

        if (isActive) {
            User.activate(userId);
        } else {
            User.deactivate(userId);
        }

        res.json({ message: `User ${isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Reset user password
router.put('/users/:id/reset-password', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: true, message: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' });
        }

        const user = User.getById(userId);
        if (!user) {
            return res.status(404).json({ error: true, message: 'User not found', code: 'NOT_FOUND' });
        }

        User.updatePassword(userId, newPassword);
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get all classified students across college
router.get('/students/classified', (req, res) => {
    try {
        const { category, departmentId } = req.query;

        let classifications = Classification.getByDepartment(
            departmentId ? parseInt(departmentId) : null,
            category || null
        );

        res.json({ classifications, count: classifications.length });
    } catch (error) {
        console.error('Get classified students error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
