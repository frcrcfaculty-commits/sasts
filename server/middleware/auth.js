const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: true, message: 'No token provided', code: 'NO_TOKEN' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = User.getById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: true, message: 'User not found', code: 'USER_NOT_FOUND' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: true, message: 'Account is deactivated', code: 'ACCOUNT_DEACTIVATED' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: true, message: 'Session expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: true, message: 'Invalid token', code: 'INVALID_TOKEN' });
    }
};

module.exports = auth;
