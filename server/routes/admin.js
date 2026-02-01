const express = require('express');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const User = require('../models/User');
const Department = require('../models/Department');
const Classification = require('../models/Classification');
const Activity = require('../models/Activity');
const Review = require('../models/Review');

const router = express.Router();

// All admin routes require admin or superadmin role
router.use(auth);
router.use(requireRole(['admin', 'superadmin']));

// Get users in department (admins get their dept, superadmin can specify)
router.get('/users', (req, res) => {
    try {
        const departmentId = req.user.role === 'superadmin' ? req.query.departmentId : req.user.department_id;

        const users = departmentId ? User.getAll(parseInt(departmentId)) : User.getAll();
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get faculty in department
router.get('/faculty', (req, res) => {
    try {
        const departmentId = req.user.role === 'superadmin' ? req.query.departmentId : req.user.department_id;

        if (!departmentId) {
            return res.status(400).json({ error: true, message: 'Department ID required', code: 'MISSING_DEPARTMENT' });
        }

        const faculty = User.getFacultyByDepartment(parseInt(departmentId));
        res.json({ faculty });
    } catch (error) {
        console.error('Get faculty error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Create new faculty user
router.post('/users', (req, res) => {
    try {
        const { email, password, name, departmentId } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: true, message: 'Email, password, and name are required', code: 'MISSING_FIELDS' });
        }

        // Admin can only add to their department
        const targetDeptId = req.user.role === 'superadmin' ? departmentId : req.user.department_id;

        if (!targetDeptId) {
            return res.status(400).json({ error: true, message: 'Department is required', code: 'MISSING_DEPARTMENT' });
        }

        // Check if email exists
        const existing = User.getByEmail(email);
        if (existing) {
            return res.status(400).json({ error: true, message: 'Email already registered', code: 'EMAIL_EXISTS' });
        }

        const user = User.create({
            email,
            password,
            name,
            role: 'faculty',
            departmentId: parseInt(targetDeptId)
        });

        res.status(201).json({ message: 'Faculty member added', user });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Reset user password
router.put('/users/:id/reset-password', (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = parseInt(req.params.id);

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: true, message: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' });
        }

        const user = User.getById(userId);
        if (!user) {
            return res.status(404).json({ error: true, message: 'User not found', code: 'NOT_FOUND' });
        }

        // Admin can only reset passwords in their department
        if (req.user.role === 'admin' && user.department_id !== req.user.department_id) {
            return res.status(403).json({ error: true, message: 'Cannot reset password for users outside your department', code: 'FORBIDDEN' });
        }

        // Cannot reset superadmin password unless you are superadmin
        if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: true, message: 'Cannot reset superadmin password', code: 'FORBIDDEN' });
        }

        User.updatePassword(userId, newPassword);
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Activate/Deactivate user
router.put('/users/:id/status', (req, res) => {
    try {
        const { isActive } = req.body;
        const userId = parseInt(req.params.id);

        const user = User.getById(userId);
        if (!user) {
            return res.status(404).json({ error: true, message: 'User not found', code: 'NOT_FOUND' });
        }

        // Admin can only manage users in their department
        if (req.user.role === 'admin' && user.department_id !== req.user.department_id) {
            return res.status(403).json({ error: true, message: 'Cannot manage users outside your department', code: 'FORBIDDEN' });
        }

        // Cannot deactivate self
        if (user.id === req.user.id) {
            return res.status(400).json({ error: true, message: 'Cannot deactivate your own account', code: 'SELF_DEACTIVATE' });
        }

        // Cannot deactivate superadmin
        if (user.role === 'superadmin') {
            return res.status(403).json({ error: true, message: 'Cannot deactivate superadmin', code: 'FORBIDDEN' });
        }

        if (isActive) {
            User.activate(userId);
        } else {
            User.deactivate(userId);
        }

        res.json({ message: isActive ? 'User activated' : 'User deactivated' });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get department stats
router.get('/stats', (req, res) => {
    try {
        const departmentId = req.user.role === 'superadmin' ? req.query.departmentId : req.user.department_id;

        if (!departmentId) {
            return res.status(400).json({ error: true, message: 'Department ID required', code: 'MISSING_DEPARTMENT' });
        }

        const deptStats = Department.getStats(parseInt(departmentId));
        const classificationStats = Classification.getStats(null, parseInt(departmentId));
        const activityStats = Activity.getStats(null, parseInt(departmentId));
        const reviewStats = Review.getDepartmentReviewStats(parseInt(departmentId));

        res.json({
            department: deptStats,
            classifications: classificationStats,
            activities: activityStats,
            reviews: reviewStats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
