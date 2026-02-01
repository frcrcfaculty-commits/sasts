const { getOne, getAll, runQuery } = require('../config/database');

class Reminder {
  static getByToken(token) {
    return getOne(`
      SELECT rr.*, 
             a.title as activity_title, a.activity_type, a.completion_status,
             s.name as student_name, s.email as student_email
      FROM review_reminders rr
      JOIN activities a ON rr.activity_id = a.id
      JOIN students s ON rr.student_id = s.id
      WHERE rr.review_token = ?
    `, [token]);
  }

  static getPending() {
    return getAll(`
      SELECT rr.*, 
             a.title as activity_title, a.activity_type,
             s.name as student_name, s.email as student_email,
             sc.faculty_id
      FROM review_reminders rr
      JOIN activities a ON rr.activity_id = a.id
      JOIN students s ON rr.student_id = s.id
      JOIN student_classifications sc ON a.classification_id = sc.id
      WHERE rr.response_received = 0 
        AND rr.reminder_count < 3
        AND (rr.last_sent_at IS NULL OR datetime(rr.last_sent_at, '+48 hours') <= datetime('now'))
      ORDER BY rr.last_sent_at ASC
    `);
  }

  static create({ activityId, studentId, reviewToken, tokenExpiresAt }) {
    const result = runQuery(`
      INSERT INTO review_reminders (activity_id, student_id, review_token, token_expires_at, last_sent_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [activityId, studentId, reviewToken, tokenExpiresAt]);
    return getOne('SELECT * FROM review_reminders WHERE id = ?', [result.lastInsertRowid]);
  }

  static incrementReminderCount(id) {
    return runQuery(`
      UPDATE review_reminders 
      SET reminder_count = reminder_count + 1, last_sent_at = datetime('now')
      WHERE id = ?
    `, [id]);
  }

  static markResponseReceived(token) {
    return runQuery(`
      UPDATE review_reminders 
      SET response_received = 1
      WHERE review_token = ?
    `, [token]);
  }

  static getByActivityAndStudent(activityId, studentId) {
    return getOne(`
      SELECT * FROM review_reminders 
      WHERE activity_id = ? AND student_id = ?
    `, [activityId, studentId]);
  }

  static getStats() {
    return getOne(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN response_received = 1 THEN 1 ELSE 0 END) as responses_received,
        SUM(CASE WHEN response_received = 0 AND reminder_count >= 3 THEN 1 ELSE 0 END) as no_response,
        AVG(reminder_count) as avg_reminders_needed
      FROM review_reminders
    `) || { total_sent: 0, responses_received: 0, no_response: 0, avg_reminders_needed: 0 };
  }
}

module.exports = Reminder;
