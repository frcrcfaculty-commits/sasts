const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
let transporter = null;

const initTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('⚠️  Email not configured. Review emails will be logged to console.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

// Send review request email
const sendReviewRequest = async (student, activity, token) => {
  const reviewUrl = `${process.env.BASE_URL}/review.html?token=${token}`;

  const emailContent = {
    to: student.email,
    from: process.env.SMTP_USER || 'noreply@fcrit.ac.in',
    subject: `Feedback Request: ${activity.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📚 Feedback Request</h1>
          <p style="margin-top: 10px; opacity: 0.9;">Father Agnel Engineering College</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Dear <strong>${student.name}</strong>,</p>
          
          <p>Your faculty member has completed an academic support activity for you. We'd love to hear your feedback!</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #333;">${activity.title}</h3>
            <p style="color: #666; margin-bottom: 5px;"><strong>Type:</strong> ${activity.activity_type.replace('_', ' ').toUpperCase()}</p>
            <p style="color: #666; margin-bottom: 0;"><strong>Faculty:</strong> ${activity.faculty_name}</p>
          </div>
          
          <p>Please take a moment to provide your anonymous feedback:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">Submit Feedback</a>
          </div>
          
          <p style="color: #888; font-size: 12px;">This feedback is completely anonymous. Your responses help us improve our academic support programs.</p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
          <p>Student Academic Support Tracking System (SASTS)</p>
          <p>Father Agnel Engineering College</p>
        </div>
      </div>
    `
  };

  if (!transporter) {
    console.log('\n📧 Email (not sent - SMTP not configured):');
    console.log(`   To: ${student.email}`);
    console.log(`   Subject: ${emailContent.subject}`);
    console.log(`   Review URL: ${reviewUrl}\n`);
    return { success: true, simulated: true };
  }

  try {
    await transporter.sendMail(emailContent);
    console.log(`📧 Review request sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// Send reminder email
const sendReminder = async (student, activity, token, reminderCount) => {
  const reviewUrl = `${process.env.BASE_URL}/review.html?token=${token}`;

  const emailContent = {
    to: student.email,
    from: process.env.SMTP_USER || 'noreply@fcrit.ac.in',
    subject: `Reminder: Feedback Pending for ${activity.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⏰ Reminder (${reminderCount}/3)</h1>
          <p style="margin-top: 10px; opacity: 0.9;">Your feedback is pending</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Dear <strong>${student.name}</strong>,</p>
          
          <p>We haven't received your feedback yet for the following activity:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c;">
            <h3 style="margin-top: 0; color: #333;">${activity.title}</h3>
            <p style="color: #666; margin-bottom: 0;"><strong>Faculty:</strong> ${activity.faculty_name}</p>
          </div>
          
          <p>Your feedback helps us improve. Please take a moment to share your thoughts:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewUrl}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">Submit Feedback Now</a>
          </div>
        </div>
      </div>
    `
  };

  if (!transporter) {
    console.log('\n📧 Reminder Email (not sent - SMTP not configured):');
    console.log(`   To: ${student.email}`);
    console.log(`   Subject: ${emailContent.subject}`);
    console.log(`   Review URL: ${reviewUrl}\n`);
    return { success: true, simulated: true };
  }

  try {
    await transporter.sendMail(emailContent);
    console.log(`📧 Reminder ${reminderCount} sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('Reminder send error:', error);
    throw error;
  }
};

// Send new activity notification email
const sendActivityNotification = async (student, activity, dueDate) => {
  const activityUrl = `${process.env.BASE_URL}/student-login.html`;
  const dueDateFormatted = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  }) : 'No due date';

  const activityTypes = {
    'mcq': '📝 MCQ Quiz',
    'crossword': '🧩 Crossword Puzzle',
    'fill_blanks': '✏️ Fill in the Blanks',
    'flashcards': '🎴 Flashcards',
    'puzzle': '🧠 Puzzle'
  };

  const emailContent = {
    to: student.email,
    from: process.env.SMTP_USER || 'noreply@fcrit.ac.in',
    subject: `New Activity Assigned: ${activity.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎯 New Activity Assigned!</h1>
          <p style="margin-top: 10px; opacity: 0.9;">Father Agnel Engineering College - SASTS</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Dear <strong>${student.name}</strong>,</p>
          
          <p>A new learning activity has been assigned to you! Please complete it before the due date.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #11998e;">
            <h3 style="margin-top: 0; color: #333;">${activity.title}</h3>
            <p style="color: #666; margin-bottom: 5px;"><strong>Type:</strong> ${activityTypes[activity.activity_type] || activity.activity_type}</p>
            <p style="color: #666; margin-bottom: 5px;"><strong>Difficulty:</strong> ${activity.difficulty || 'Medium'}</p>
            <p style="color: #666; margin-bottom: 0;"><strong>Due Date:</strong> ${dueDateFormatted}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${activityUrl}" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">Start Activity</a>
          </div>
          
          <p style="color: #888; font-size: 12px;">Complete activities on time to track your progress and earn better scores!</p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
          <p>Student Academic Support Tracking System (SASTS)</p>
          <p>Father Agnel Engineering College</p>
        </div>
      </div>
    `
  };

  if (!transporter) {
    console.log('\n📧 Activity Notification (not sent - SMTP not configured):');
    console.log(`   To: ${student.email}`);
    console.log(`   Subject: ${emailContent.subject}`);
    console.log(`   Activity: ${activity.title}`);
    console.log(`   Due: ${dueDateFormatted}\n`);
    return { success: true, simulated: true };
  }

  try {
    await transporter.sendMail(emailContent);
    console.log(`📧 Activity notification sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('Activity notification send error:', error);
    throw error;
  }
};

// Send bulk notification to multiple students
const sendBulkActivityNotifications = async (students, activity, dueDate) => {
  const results = [];
  for (const student of students) {
    try {
      const result = await sendActivityNotification(student, activity, dueDate);
      results.push({ studentId: student.id, success: true, ...result });
    } catch (error) {
      results.push({ studentId: student.id, success: false, error: error.message });
    }
  }
  return results;
};

module.exports = {
  initTransporter,
  sendReviewRequest,
  sendReminder,
  sendActivityNotification,
  sendBulkActivityNotifications
};
