// Role-based access control middleware
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: true, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: true,
                message: 'You do not have permission to perform this action',
                code: 'FORBIDDEN'
            });
        }

        next();
    };
};

// Department-scoped access middleware (for admins)
const requireDepartmentAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: true, message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    // Superadmin has access to all departments
    if (req.user.role === 'superadmin') {
        return next();
    }

    // Get department ID from request (body, query, or params)
    const requestedDeptId = req.body.departmentId || req.query.departmentId || req.params.departmentId;

    // If no specific department requested, allow (will be filtered by user's department)
    if (!requestedDeptId) {
        return next();
    }

    // Check if user has access to the requested department
    if (parseInt(requestedDeptId) !== req.user.department_id) {
        return res.status(403).json({
            error: true,
            message: 'You do not have access to this department',
            code: 'DEPARTMENT_ACCESS_DENIED'
        });
    }

    next();
};

// Classification ownership middleware
const requireClassificationOwnership = (req, res, next) => {
    const Classification = require('../models/Classification');
    const classificationId = req.params.id || req.body.classificationId;

    if (!classificationId) {
        return next();
    }

    const classification = Classification.getById(classificationId);

    if (!classification) {
        return res.status(404).json({ error: true, message: 'Classification not found', code: 'NOT_FOUND' });
    }

    // Superadmin can access all
    if (req.user.role === 'superadmin') {
        req.classification = classification;
        return next();
    }

    // Admin can access their department
    if (req.user.role === 'admin') {
        const Student = require('../models/Student');
        const student = Student.getById(classification.student_id);
        if (student && student.department_id === req.user.department_id) {
            req.classification = classification;
            return next();
        }
    }

    // Faculty can only access their own classifications
    if (classification.faculty_id !== req.user.id) {
        return res.status(403).json({
            error: true,
            message: 'You can only modify your own classifications',
            code: 'OWNERSHIP_DENIED'
        });
    }

    req.classification = classification;
    next();
};

module.exports = { requireRole, requireDepartmentAccess, requireClassificationOwnership };
