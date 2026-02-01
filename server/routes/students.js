const express = require('express');
const auth = require('../middleware/auth');
const { requireRole, requireDepartmentAccess, requireClassificationOwnership } = require('../middleware/roleCheck');
const Student = require('../models/Student');
const Classification = require('../models/Classification');

const router = express.Router();

// Get all students (with optional filters)
router.get('/', auth, (req, res) => {
    try {
        const { category, semester, search } = req.query;
        let departmentId = req.user.role === 'superadmin' ? req.query.departmentId : req.user.department_id;

        let classifications;
        if (category) {
            classifications = Classification.getAll(
                req.user.role === 'faculty' ? req.user.id : null,
                category
            );

            // Filter by department for non-superadmin
            if (departmentId) {
                classifications = classifications.filter(c => {
                    const student = Student.getById(c.student_id);
                    return student && student.department_id === parseInt(departmentId);
                });
            }
        } else {
            classifications = Classification.getAll(
                req.user.role === 'faculty' ? req.user.id : null
            );
        }

        // Filter by semester if provided
        if (semester) {
            classifications = classifications.filter(c => c.semester === parseInt(semester));
        }

        res.json({ classifications });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Search students (for adding to classification)
router.get('/search', auth, (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ students: [] });
        }

        const departmentId = req.user.role === 'superadmin' ? null : req.user.department_id;
        const students = Student.search(q, departmentId);
        res.json({ students });
    } catch (error) {
        console.error('Search students error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Classify a student (or add new student and classify)
router.post('/classify', auth, (req, res) => {
    try {
        const {
            studentId, // Optional - use if student exists
            studentName, rollNumber, studentEmail, semester, // For new student
            category, reason, academicYear
        } = req.body;

        // Validation
        if (!category || !['weak', 'strong'].includes(category)) {
            return res.status(400).json({ error: true, message: 'Category must be weak or strong', code: 'INVALID_CATEGORY' });
        }

        if (!reason || reason.length < 20) {
            return res.status(400).json({ error: true, message: 'Reason must be at least 20 characters', code: 'REASON_TOO_SHORT' });
        }

        if (!academicYear) {
            return res.status(400).json({ error: true, message: 'Academic year is required', code: 'MISSING_ACADEMIC_YEAR' });
        }

        let student;
        const departmentId = req.user.department_id;

        if (studentId) {
            // Use existing student
            student = Student.getById(studentId);
            if (!student) {
                return res.status(404).json({ error: true, message: 'Student not found', code: 'STUDENT_NOT_FOUND' });
            }
        } else {
            // Create or find student
            if (!studentName || !rollNumber || !studentEmail || !semester) {
                return res.status(400).json({ error: true, message: 'Student details are required', code: 'MISSING_STUDENT_DETAILS' });
            }

            student = Student.findOrCreate({
                name: studentName,
                rollNumber,
                email: studentEmail,
                departmentId,
                semester
            });
        }

        // Check for duplicate classification
        const existing = Classification.checkDuplicate(student.id, req.user.id, semester || student.semester, academicYear);
        if (existing) {
            return res.status(400).json({
                error: true,
                message: 'You have already classified this student for this semester',
                code: 'DUPLICATE_CLASSIFICATION'
            });
        }

        // Create classification
        const classification = Classification.create({
            studentId: student.id,
            facultyId: req.user.id,
            category,
            reason,
            academicYear,
            semester: semester || student.semester
        });

        res.status(201).json({
            message: 'Student classified successfully',
            classification
        });
    } catch (error) {
        console.error('Classify student error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Update classification
router.put('/classify/:id', auth, requireClassificationOwnership, (req, res) => {
    try {
        const { category, reason } = req.body;

        if (category && !['weak', 'strong'].includes(category)) {
            return res.status(400).json({ error: true, message: 'Category must be weak or strong', code: 'INVALID_CATEGORY' });
        }

        if (reason && reason.length < 20) {
            return res.status(400).json({ error: true, message: 'Reason must be at least 20 characters', code: 'REASON_TOO_SHORT' });
        }

        const classification = Classification.update(req.params.id, { category, reason });
        res.json({ message: 'Classification updated', classification });
    } catch (error) {
        console.error('Update classification error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Delete classification
router.delete('/classify/:id', auth, requireClassificationOwnership, (req, res) => {
    try {
        Classification.delete(req.params.id);
        res.json({ message: 'Classification deleted' });
    } catch (error) {
        console.error('Delete classification error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

// Get classification stats
router.get('/stats', auth, (req, res) => {
    try {
        const facultyId = req.user.role === 'faculty' ? req.user.id : null;
        const departmentId = req.user.role === 'superadmin' ? null : req.user.department_id;

        const stats = Classification.getStats(facultyId, departmentId);
        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: true, message: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
