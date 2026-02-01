const { getOne, getAll, runQuery } = require('../config/database');

class Notification {
    static getById(id) {
        return getOne('SELECT * FROM notifications WHERE id = ?', [id]);
    }

    static getForRecipient(recipientType, recipientId, unreadOnly = false) {
        let query = `
      SELECT * FROM notifications 
      WHERE recipient_type = ? AND recipient_id = ?
    `;
        const params = [recipientType, recipientId];

        if (unreadOnly) {
            query += ' AND is_read = 0';
        }
        query += ' ORDER BY created_at DESC LIMIT 50';

        return getAll(query, params);
    }

    static getUnreadCount(recipientType, recipientId) {
        const result = getOne(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0
    `, [recipientType, recipientId]);
        return result?.count || 0;
    }

    static create({ recipientType, recipientId, title, message, link, notificationType = 'info' }) {
        const result = runQuery(`
      INSERT INTO notifications (recipient_type, recipient_id, title, message, link, notification_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [recipientType, recipientId, title, message, link, notificationType]);
        return this.getById(result.lastInsertRowid);
    }

    static createBulk(notifications) {
        const results = [];
        for (const n of notifications) {
            const result = this.create(n);
            results.push(result);
        }
        return results;
    }

    static markAsRead(id) {
        return runQuery('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    }

    static markAllAsRead(recipientType, recipientId) {
        return runQuery(`
      UPDATE notifications SET is_read = 1 
      WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0
    `, [recipientType, recipientId]);
    }

    static markEmailSent(id) {
        return runQuery('UPDATE notifications SET email_sent = 1 WHERE id = ?', [id]);
    }

    static delete(id) {
        return runQuery('DELETE FROM notifications WHERE id = ?', [id]);
    }

    static deleteOld(days = 30) {
        return runQuery(`
      DELETE FROM notifications 
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `, [days]);
    }

    // Notify students about new activity
    static notifyStudentsOfActivity(activityId, studentIds, activityTitle, facultyName) {
        const notifications = studentIds.map(studentId => ({
            recipientType: 'student',
            recipientId: studentId,
            title: '🎮 New Activity Available',
            message: `${facultyName} has assigned "${activityTitle}" for you to complete.`,
            link: `/student-activity.html?id=${activityId}`,
            notificationType: 'activity'
        }));
        return this.createBulk(notifications);
    }

    // Notify faculty about student completion
    static notifyFacultyOfCompletion(facultyId, studentName, activityTitle, score, maxScore) {
        return this.create({
            recipientType: 'faculty',
            recipientId: facultyId,
            title: '✅ Activity Completed',
            message: `${studentName} completed "${activityTitle}" with score ${score}/${maxScore}`,
            link: '/activities.html',
            notificationType: 'info'
        });
    }

    // Get pending email notifications
    static getPendingEmails(limit = 50) {
        return getAll(`
      SELECT n.*, 
             CASE 
               WHEN n.recipient_type = 'student' THEN sa.email
               WHEN n.recipient_type IN ('faculty', 'admin', 'superadmin') THEN u.email
             END as recipient_email,
             CASE 
               WHEN n.recipient_type = 'student' THEN s.name
               WHEN n.recipient_type IN ('faculty', 'admin', 'superadmin') THEN u.name
             END as recipient_name
      FROM notifications n
      LEFT JOIN students_auth sa ON n.recipient_type = 'student' AND n.recipient_id = sa.student_id
      LEFT JOIN students s ON n.recipient_type = 'student' AND n.recipient_id = s.id
      LEFT JOIN users u ON n.recipient_type IN ('faculty', 'admin', 'superadmin') AND n.recipient_id = u.id
      WHERE n.email_sent = 0
      ORDER BY n.created_at ASC
      LIMIT ?
    `, [limit]);
    }
}

module.exports = Notification;
