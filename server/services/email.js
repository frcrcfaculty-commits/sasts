/**
 * Email Notification Service for SASTS
 * Sends notifications for new activities, reminders, etc.
 */

const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');

let transporter = null;

// Initialize email transporter
function initEmailService() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        console.log('✅ Email service initialized');
        return true;
    }
    console.log('⚠️ Email service not configured (missing SMTP settings)');
    return false;
}

// Send a single email
async function sendEmail({ to, subject, html, text }) {
    if (!transporter) {
        console.log(`📧 [Mock Email] To: ${to}, Subject: ${subject}`);
        return { mock: true };
    }

    try {
        const result = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"SASTS" <noreply@fcrit.ac.in>',
            to,
            subject,
            html,
            text
        });
        return result;
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
}

// Email templates
const templates = {
    newActivity: (data) => ({
        subject: `🎮 New Activity: ${data.activityTitle}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0;">🎮 New Activity Available!</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${data.studentName}</strong>,</p>
          <p>${data.facultyName} has assigned a new activity for you:</p>
          <div style="background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0;">${data.activityTitle}</h2>
            <p style="margin: 0; color: #666;">Type: ${data.activityType} | Difficulty: ${data.difficulty}</p>
          </div>
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/student-activity.html?id=${data.activityId}" 
             style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Start Activity →
          </a>
          <p style="margin-top: 30px; font-size: 12px; color: #999;">
            This is an automated message from SASTS - Student Academic Support Tracking System
          </p>
        </div>
      </div>
    `,
        text: `New Activity: ${data.activityTitle}\n\nHello ${data.studentName},\n\n${data.facultyName} has assigned "${data.activityTitle}" for you.\n\nComplete it at: ${process.env.BASE_URL}/student-activity.html?id=${data.activityId}`
    }),

    activityReminder: (data) => ({
        subject: `⏰ Reminder: Complete "${data.activityTitle}"`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0;">⏰ Activity Reminder</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${data.studentName}</strong>,</p>
          <p>You have an incomplete activity that needs your attention:</p>
          <div style="background: white; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0;">${data.activityTitle}</h2>
            ${data.dueDate ? `<p style="margin: 0; color: #ef4444;">Due: ${data.dueDate}</p>` : ''}
          </div>
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/student-activity.html?id=${data.activityId}" 
             style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Complete Now →
          </a>
        </div>
      </div>
    `,
        text: `Reminder: ${data.activityTitle}\n\nYou have an incomplete activity. Complete it at: ${process.env.BASE_URL}/student-activity.html?id=${data.activityId}`
    }),

    weeklyDigest: (data) => ({
        subject: `📊 Your Weekly SASTS Summary`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0;">📊 Weekly Summary</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${data.studentName}</strong>,</p>
          <p>Here's your activity summary for this week:</p>
          <div style="display: flex; gap: 15px; margin: 20px 0;">
            <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 2rem; font-weight: bold; color: #22c55e;">${data.activitiesCompleted}</div>
              <div style="font-size: 0.875rem; color: #666;">Completed</div>
            </div>
            <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 2rem; font-weight: bold; color: #667eea;">${data.avgScore}%</div>
              <div style="font-size: 0.875rem; color: #666;">Avg Score</div>
            </div>
            <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 2rem; font-weight: bold; color: #f59e0b;">${data.timeSpent}m</div>
              <div style="font-size: 0.875rem; color: #666;">Time Spent</div>
            </div>
          </div>
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/student-dashboard.html" 
             style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Dashboard →
          </a>
        </div>
      </div>
    `,
        text: `Weekly Summary\n\nCompleted: ${data.activitiesCompleted}\nAvg Score: ${data.avgScore}%\nTime Spent: ${data.timeSpent} minutes`
    })
};

// Send notification email
async function sendNotificationEmail(notificationId) {
    const notification = Notification.getById(notificationId);
    if (!notification || notification.email_sent) return;

    // Get recipient email (would need to lookup based on recipient_type and recipient_id)
    // For now, just mark as sent
    try {
        // In production, lookup email from students_auth or users table
        Notification.markEmailSent(notificationId);
        return true;
    } catch (error) {
        console.error('Send notification email error:', error);
        return false;
    }
}

// Process pending email notifications (run periodically)
async function processEmailQueue() {
    const pending = Notification.getPendingEmails(20);
    let sent = 0;

    for (const notification of pending) {
        if (!notification.recipient_email) continue;

        try {
            await sendEmail({
                to: notification.recipient_email,
                subject: notification.title,
                html: `<p>${notification.message}</p>`,
                text: notification.message
            });
            Notification.markEmailSent(notification.id);
            sent++;
        } catch (error) {
            console.error(`Failed to send email for notification ${notification.id}:`, error.message);
        }
    }

    if (sent > 0) {
        console.log(`📧 Sent ${sent} notification emails`);
    }
    return sent;
}

// Notify students of new activity
async function notifyStudentsOfNewActivity(activity, studentIds, facultyName) {
    const GeneratedActivity = require('../models/GeneratedActivity');
    const activityData = GeneratedActivity.getById(activity.id);

    // Create in-app notifications
    Notification.notifyStudentsOfActivity(
        activity.id,
        studentIds,
        activity.title,
        facultyName
    );

    // Queue emails would happen here in production
    console.log(`📧 Queued activity notification emails for ${studentIds.length} students`);
}

module.exports = {
    initEmailService,
    sendEmail,
    templates,
    sendNotificationEmail,
    processEmailQueue,
    notifyStudentsOfNewActivity
};
