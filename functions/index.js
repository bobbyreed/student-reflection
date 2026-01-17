const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { Resend } = require('resend');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Define the secret for Resend API key
const resendApiKey = functions.params.defineSecret('RESEND_API_KEY');

// Resend client will be initialized lazily when needed
// This avoids errors during deployment analysis when env vars aren't available
let resend = null;
function getResendClient() {
  if (!resend) {
    resend = new Resend(resendApiKey.value());
  }
  return resend;
}

/**
 * Cloud Function to send survey completion notification email
 * Includes rate limiting (90 emails/day) to stay within free tier
 */
exports.sendSurveyNotification = functions
  .runWith({ secrets: [resendApiKey] })
  .https.onCall(async (data, context) => {
  try {
    // Validate input parameters
    const { professorEmail, studentEmail, studentName, timeSpent, responses } = data;

    if (!professorEmail || !studentEmail || !studentName || !timeSpent || !responses) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: professorEmail, studentEmail, studentName, timeSpent, or responses'
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

    // Calculate scores
    const calculateScores = (responses) => {
      // Computer Skills (a1-a11)
      const computerQuestions = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'];
      const computerSum = computerQuestions.reduce((sum, q) => sum + (responses[q] || 0), 0);
      const computerScore = computerSum / 11;

      // Independent Skills (b1-b10)
      const independentQuestions = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'];
      const independentSum = independentQuestions.reduce((sum, q) => sum + (responses[q] || 0), 0);
      const independentScore = independentSum / 10;

      // Dependent Skills (c1-c6)
      const dependentQuestions = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
      const dependentSum = dependentQuestions.reduce((sum, q) => sum + (responses[q] || 0), 0);
      const dependentScore = dependentSum / 6;

      // Need for Online Delivery (d1-d5)
      const needQuestions = ['d1', 'd2', 'd3', 'd4', 'd5'];
      const needSum = needQuestions.reduce((sum, q) => sum + (responses[q] || 0), 0);
      const needScore = needSum / 5;

      // Academic Skills (e1-e13)
      const academicQuestions = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13'];
      const academicSum = academicQuestions.reduce((sum, q) => sum + (responses[q] || 0), 0);
      const academicScore = academicSum / 13;

      // Total Score (sum of all responses)
      const totalScore = Object.values(responses).reduce((sum, val) => sum + val, 0);

      return {
        computer: computerScore.toFixed(2),
        independent: independentScore.toFixed(2),
        dependent: dependentScore.toFixed(2),
        need: needScore.toFixed(2),
        academic: academicScore.toFixed(2),
        total: totalScore
      };
    };

    const scores = calculateScores(responses);

    // Determine overall readiness category
    let readinessCategory = '';
    let readinessText = '';
    if (scores.total >= 190) {
      readinessCategory = 'Ready to go';
      readinessText = 'You are more prepared for online learning than 50-75 percent of your student peers. Congratulations!';
    } else if (scores.total >= 178) {
      readinessCategory = 'Almost there';
      readinessText = 'You may experience some difficulty with online courses. However, with some improvement in certain areas, you should be successful. Review your subscale scores below to identify areas for growth.';
    } else {
      readinessCategory = 'Proceed with caution';
      readinessText = 'Individuals with a score in this range may need to acquire some new skills before proceeding with online courses. You may need to increase your reading and writing skills, learn some time management skills, or take an introduction to computers course. Look over the statements again to identify the areas in which you need the most help and start there.';
    }

    // Need for Online Delivery interpretation
    const needInterpretation = parseFloat(scores.need) >= 3.4
      ? 'Your score indicates that your lifestyle (i.e., career, family structure, personal responsibilities, distance to higher education entities) may demand the flexibility that the online classroom can provide.'
      : 'Your score suggests that you do not have a pressing need for online delivery of instruction. Online courses are just one of several options for you.';

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'long',
      timeStyle: 'short'
    });

    // Send professor notification email
    const professorEmailResponse = await getResendClient().emails.send({
      from: 'Student Survey <noreply@reflection.kristenkirkman.life>',
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
      `
    });

    // Send student reflection email
    const studentEmailResponse = await getResendClient().emails.send({
      from: 'Student Survey <noreply@reflection.kristenkirkman.life>',
      to: studentEmail,
      subject: `Your Online Learning Self-Assessment Results`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; border-radius: 5px; }
            .content { margin: 20px 0; }
            .score-section { background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
            .score-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; }
            .score-value { font-size: 24px; color: #4CAF50; font-weight: bold; }
            .subscale { margin: 10px 0; padding: 10px; background-color: #fff; border: 1px solid #ddd; }
            .subscale-name { font-weight: bold; color: #555; }
            .subscale-score { float: right; color: #4CAF50; font-weight: bold; }
            .interpretation { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
            .resources { background-color: #e7f3ff; padding: 15px; margin: 15px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Your Online Learning Self-Assessment Results</h2>
            </div>
            <div class="content">
              <p>Dear ${studentName},</p>
              <p>Thank you for completing the Online Learning Self-Assessment Survey. Here are your results:</p>

              <div class="score-section">
                <div class="score-title">Your Total Score</div>
                <div class="score-value">${scores.total}</div>
                <p><strong>${readinessCategory}</strong></p>
                <p>${readinessText}</p>
              </div>

              <h3>Subscale Scores</h3>

              <div class="subscale">
                <span class="subscale-name">Computer Skills:</span>
                <span class="subscale-score">${scores.computer}</span>
                <div style="clear:both"></div>
              </div>

              <div class="subscale">
                <span class="subscale-name">Independent Learning Skills:</span>
                <span class="subscale-score">${scores.independent}</span>
                <div style="clear:both"></div>
              </div>

              <div class="subscale">
                <span class="subscale-name">Dependent Learning Skills:</span>
                <span class="subscale-score">${scores.dependent}</span>
                <div style="clear:both"></div>
              </div>

              <div class="subscale">
                <span class="subscale-name">Academic Skills:</span>
                <span class="subscale-score">${scores.academic}</span>
                <div style="clear:both"></div>
              </div>

              <div class="subscale">
                <span class="subscale-name">Need for Online Delivery:</span>
                <span class="subscale-score">${scores.need}</span>
                <div style="clear:both"></div>
              </div>

              <div class="interpretation">
                <h4>Need for Online Delivery</h4>
                <p>${needInterpretation}</p>
                <p><em>Note: Unlike the other subscales, the Need for Online Delivery score identifies a need instead of a skill. If your score is 3.4 or higher, it indicates that your lifestyle may demand the flexibility that the online classroom can provide.</em></p>
              </div>

              ${scores.total < 178 ? `
              <div class="resources">
                <h4>Tips for Online Learning Success</h4>
                <p><strong>Time Management:</strong> Consider if you have adequate time for online learning. Although online education offers accessibility and convenience, you need to create a schedule that allows you to focus on your studies while attending to other life commitments.</p>

                <p><strong>Discipline and Determination:</strong> Online learning requires self-discipline. Make sure you can avoid distractions during study time and allot time for relaxation and extra-curricular activities that enrich your learning experience.</p>
              </div>
              ` : ''}
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Your Online Learning Self-Assessment Results

Dear ${studentName},

Thank you for completing the Online Learning Self-Assessment Survey. Here are your results:

YOUR TOTAL SCORE: ${scores.total}
${readinessCategory}

${readinessText}

SUBSCALE SCORES:
- Computer Skills: ${scores.computer}
- Independent Learning Skills: ${scores.independent}
- Dependent Learning Skills: ${scores.dependent}
- Academic Skills: ${scores.academic}
- Need for Online Delivery: ${scores.need}

NEED FOR ONLINE DELIVERY:
${needInterpretation}

Note: Unlike the other subscales, the Need for Online Delivery score identifies a need instead of a skill. If your score is 3.4 or higher, it indicates that your lifestyle may demand the flexibility that the online classroom can provide.

${scores.total < 178 ? `
TIPS FOR ONLINE LEARNING SUCCESS:

Time Management: Consider if you have adequate time for online learning. Although online education offers accessibility and convenience, you need to create a schedule that allows you to focus on your studies while attending to other life commitments.

Discipline and Determination: Online learning requires self-discipline. Make sure you can avoid distractions during study time and allot time for relaxation and extra-curricular activities that enrich your learning experience.
` : ''}
Submitted: ${timestamp}
Time Spent: ${timeSpent}

---
      `
    });

    functions.logger.info('Emails sent successfully', {
      professorEmailId: professorEmailResponse.id,
      studentEmailId: studentEmailResponse.id,
      studentName,
      emailCount: result.count,
      scores: scores
    });

    return {
      success: true,
      message: 'Survey notifications sent successfully',
      professorEmailId: professorEmailResponse.id,
      studentEmailId: studentEmailResponse.id,
      scores: scores
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
