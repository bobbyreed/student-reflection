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

    // Create mock responses (all set to 4 = "Agree" for a good score)
    const mockResponses = {
        // Computer Skills (a1-a11)
        a1: 4, a2: 4, a3: 4, a4: 4, a5: 4, a6: 4, a7: 4, a8: 4, a9: 4, a10: 4, a11: 4,
        // Independent Skills (b1-b10)
        b1: 4, b2: 4, b3: 4, b4: 4, b5: 4, b6: 4, b7: 4, b8: 4, b9: 4, b10: 4,
        // Dependent Skills (c1-c6)
        c1: 4, c2: 4, c3: 4, c4: 4, c5: 4, c6: 4,
        // Need for Online Delivery (d1-d5)
        d1: 4, d2: 4, d3: 4, d4: 4, d5: 4,
        // Academic Skills (e1-e13)
        e1: 4, e2: 4, e3: 4, e4: 4, e5: 4, e6: 4, e7: 4, e8: 4, e9: 4, e10: 4, e11: 4, e12: 4, e13: 4
    };

    try {
        // Get the Firebase function reference
        const sendSurveyNotification = firebase.functions().httpsCallable('sendSurveyNotification');

        // Call the function with test data
        const result = await sendSurveyNotification({
            professorEmail: professorEmail,
            studentEmail: studentEmail,
            studentName: studentName,
            timeSpent: '2 minutes 30 seconds',
            responses: mockResponses
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
