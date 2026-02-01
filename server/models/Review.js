const { getOne, getAll, runQuery } = require('../config/database');

class Review {
  static getAll(activityId = null) {
    let query = `
      SELECT ar.*, 
             a.title as activity_title, a.activity_type,
             s.name as student_name, s.roll_number
      FROM activity_reviews ar
      JOIN activities a ON ar.activity_id = a.id
      JOIN students s ON ar.student_id = s.id
    `;
    const params = [];

    if (activityId) {
      query += ' WHERE ar.activity_id = ?';
      params.push(activityId);
    }
    query += ' ORDER BY ar.submitted_at DESC';

    return getAll(query, params);
  }

  static getById(id) {
    return getOne(`
      SELECT ar.*, 
             a.title as activity_title, a.activity_type,
             s.name as student_name, s.roll_number
      FROM activity_reviews ar
      JOIN activities a ON ar.activity_id = a.id
      JOIN students s ON ar.student_id = s.id
      WHERE ar.id = ?
    `, [id]);
  }

  static getByToken(token) {
    return getOne(`
      SELECT ar.*, 
             a.title as activity_title, a.activity_type,
             s.name as student_name, s.roll_number
      FROM activity_reviews ar
      JOIN activities a ON ar.activity_id = a.id
      JOIN students s ON ar.student_id = s.id
      WHERE ar.review_token = ?
    `, [token]);
  }

  static getByActivityId(activityId) {
    return getAll(`
      SELECT ar.*, 
             CASE WHEN ar.is_anonymous = 1 THEN 'Anonymous' ELSE s.name END as display_name
      FROM activity_reviews ar
      JOIN students s ON ar.student_id = s.id
      WHERE ar.activity_id = ?
      ORDER BY ar.submitted_at DESC
    `, [activityId]);
  }

  static create({ activityId, studentId, rating, feedbackText, reviewToken, isAnonymous = true }) {
    const result = runQuery(`
      INSERT INTO activity_reviews (activity_id, student_id, rating, feedback_text, review_token, is_anonymous)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [activityId, studentId, rating, feedbackText, reviewToken, isAnonymous ? 1 : 0]);
    return this.getById(result.lastInsertRowid);
  }

  static getAverageRating(activityId) {
    const result = getOne(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM activity_reviews
      WHERE activity_id = ?
    `, [activityId]);
    return result || { avg_rating: null, review_count: 0 };
  }

  static getFacultyReviewStats(facultyId) {
    return getOne(`
      SELECT 
        COUNT(ar.id) as total_reviews,
        AVG(ar.rating) as avg_rating,
        SUM(CASE WHEN ar.rating >= 4 THEN 1 ELSE 0 END) as positive_reviews,
        SUM(CASE WHEN ar.rating <= 2 THEN 1 ELSE 0 END) as negative_reviews
      FROM activity_reviews ar
      JOIN activities a ON ar.activity_id = a.id
      JOIN student_classifications sc ON a.classification_id = sc.id
      WHERE sc.faculty_id = ?
    `, [facultyId]) || { total_reviews: 0, avg_rating: null, positive_reviews: 0, negative_reviews: 0 };
  }

  static getDepartmentReviewStats(departmentId) {
    return getOne(`
      SELECT 
        COUNT(ar.id) as total_reviews,
        AVG(ar.rating) as avg_rating,
        SUM(CASE WHEN ar.rating >= 4 THEN 1 ELSE 0 END) as positive_reviews,
        SUM(CASE WHEN ar.rating <= 2 THEN 1 ELSE 0 END) as negative_reviews
      FROM activity_reviews ar
      JOIN activities a ON ar.activity_id = a.id
      JOIN student_classifications sc ON a.classification_id = sc.id
      JOIN students s ON sc.student_id = s.id
      WHERE s.department_id = ?
    `, [departmentId]) || { total_reviews: 0, avg_rating: null, positive_reviews: 0, negative_reviews: 0 };
  }
}

module.exports = Review;
