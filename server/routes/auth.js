const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Department = require('../models/Department');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: true, message: 'Email and password are required', code: 'MISSING_FIELDS' });
        }

        const user = User.getByEmail(email);

        if (!user) {
            return res.status(401).json({ error: true, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: true, message: 'Account is deactivated. Contact your admin.', code: 'ACCOUNT_DEACTIVATED' });
        }

        if (!User.verifyPassword(user, password)) {
            return res.status(401).json({ error: true, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, departmentId: user.department_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
        );

        // Get department name
        let departmentName = null;
        if (user.department_id) {
            const dept = Department.getById(user.department_id);
            departmentName = dept ? dept.name : null;
        }

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.department_id,
                departmentName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Register (Faculty only - admin/superadmin created via admin panel)
router.post('/register', (req, res) => {
    try {
        const { email, password, name, departmentId } = req.body;

        // Validation
        if (!email || !password || !name || !departmentId) {
            return res.status(400).json({ error: true, message: 'All fields are required', code: 'MISSING_FIELDS' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: true, message: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' });
        }

        // Check if email already exists
        const existingUser = User.getByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: true, message: 'Email already registered', code: 'EMAIL_EXISTS' });
        }

        // Check if department exists
        const department = Department.getById(departmentId);
        if (!department) {
            return res.status(400).json({ error: true, message: 'Invalid department', code: 'INVALID_DEPARTMENT' });
        }

        // Create user as faculty
        const user = User.create({
            email,
            password,
            name,
            role: 'faculty',
            departmentId
        });

        if (!user) {
            console.error('User creation returned null for:', email);
            return res.status(500).json({ error: true, message: 'Failed to create user account', code: 'CREATE_FAILED' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, departmentId: user.department_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '30m' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.department_id,
                departmentName: department.name
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get current user profile
router.get('/me', require('../middleware/auth'), (req, res) => {
    try {
        let departmentName = null;
        if (req.user.department_id) {
            const dept = Department.getById(req.user.department_id);
            departmentName = dept ? dept.name : null;
        }

        res.json({
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                departmentId: req.user.department_id,
                departmentName
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', require('../middleware/auth'), (req, res) => {
    // In a more complex setup, you might blacklist the token here
    res.json({ message: 'Logged out successfully' });
});

// Get departments (for registration dropdown)
router.get('/departments', (req, res) => {
    try {
        const departments = Department.getAll();
        res.json({ departments });
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
