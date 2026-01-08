const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { Resend } = require('resend');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Resend client will be initialized lazily when needed
// This avoids errors during deployment analysis when env vars aren't available
let resend = null;
function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Cloud Function to send survey completion notification email
 * Includes rate limiting (90 emails/day) to stay within free tier
 */
exports.sendSurveyNotification = functions.https.onCall(async (data, context) => {
  try {
    // Validate input parameters
    const { professorEmail, studentEmail, studentName, timeSpent } = data;

    if (!professorEmail || !studentEmail || !studentName || !timeSpent) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: professorEmail, studentEmail, studentName, or timeSpent'
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(professorEmail) || !emailRegex.test(studentEmail)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid email format'
      );
    }

    // Rate limiting check
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const metadataRef = db.collection('metadata').doc('emailCount');

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(metadataRef);

      let count = 0;
      let lastDate = today;

      if (doc.exists) {
        const data = doc.data();
        lastDate = data.date || today;
        count = data.count || 0;

        // Reset count if it's a new day
        if (lastDate !== today) {
          count = 0;
          lastDate = today;
        }
      }

      // Check if under daily limit (90 to stay safely under 100/day)
      if (count >= 90) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Daily email limit reached. Please try again tomorrow.'
        );
      }

      // Increment count
      transaction.set(metadataRef, {
        date: today,
        count: count + 1,
        lastReset: admin.firestore.FieldValue.serverTimestamp()
      });

      return { count: count + 1 };
    });

    // Send email via Resend
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'long',
      timeStyle: 'short'
    });

    const emailResponse = await getResendClient().emails.send({
      from: 'Student Survey <noreply@delivered.resend.dev>',
      to: professorEmail,
      subject: `Student Survey Completion - ${studentName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
            .content { margin: 20px 0; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Student Survey Completion Notification</h2>
            </div>
            <div class="content">
              <p>A student has completed the Online Learning Self-Assessment Survey.</p>

              <div class="info-row">
                <span class="label">Student Name:</span> ${studentName}
              </div>
              <div class="info-row">
                <span class="label">Student Email:</span> ${studentEmail}
              </div>
              <div class="info-row">
                <span class="label">Time Spent:</span> ${timeSpent}
              </div>
              <div class="info-row">
                <span class="label">Submitted:</span> ${timestamp}
              </div>
            </div>
            <div class="footer">
              Contact Professor Kristen Kirkman - Writing Program Coordinator - kkirkman@rose.edu
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Student Survey Completion Notification

A student has completed the Online Learning Self-Assessment Survey.

Student Name: ${studentName}
Student Email: ${studentEmail}
Time Spent: ${timeSpent}
Submitted: ${timestamp}

---
Contact Professor Kristen Kirkman - Writing Program Coordinator - kkirkman@rose.edu
      `
    });

    functions.logger.info('Email sent successfully', {
      emailId: emailResponse.id,
      studentName,
      emailCount: result.count,
      resendResponse: emailResponse
    });

    return {
      success: true,
      message: 'Survey notification sent successfully',
      emailId: emailResponse.id
    };

  } catch (error) {
    functions.logger.error('Error sending survey notification', error);

    // Re-throw HttpsError for client-side handling
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Handle Resend API errors
    if (error.name === 'ResendError') {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send email. Please try again later.'
      );
    }

    // Generic error
    throw new functions.https.HttpsError(
      'internal',
      'An unexpected error occurred. Please try again.'
    );
  }
});
