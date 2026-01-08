/**
 * Test function for Firebase email notification
 * Copy and paste this into the browser console on your live site
 * Then call: testEmailSend()
 */

async function testEmailSend(professorEmail = 'test@example.com', studentEmail = 'student@example.com', studentName = 'Test Student') {
    console.log('Testing email send...');
    console.log('Professor Email:', professorEmail);
    console.log('Student Email:', studentEmail);
    console.log('Student Name:', studentName);

    try {
        // Get the Firebase function reference
        const sendSurveyNotification = firebase.functions().httpsCallable('sendSurveyNotification');

        // Call the function with test data
        const result = await sendSurveyNotification({
            professorEmail: professorEmail,
            studentEmail: studentEmail,
            studentName: studentName,
            timeSpent: '2 minutes 30 seconds'
        });

        console.log('✅ Success!', result.data);
        alert('Email sent successfully! Check Resend dashboard.');
        return result.data;

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        alert('Error: ' + error.message);
        return error;
    }
}

console.log('Test function loaded! Usage:');
console.log('  testEmailSend()  // Uses default test emails');
console.log('  testEmailSend("prof@rose.edu", "student@rose.edu", "John Doe")  // Custom emails');
