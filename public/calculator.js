/**
 * Student Survey Form - Calculator & Validation Logic
 * Handles time tracking, form validation, and Firebase integration
 */

// Track start time when page loads
const startTime = Date.now();

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyChVtH4Ib8x5WObCHGnNYrmX4GTqWJ9uJs",
    authDomain: "student-reflection.firebaseapp.com",
    projectId: "student-reflection",
    storageBucket: "student-reflection.firebasestorage.app",
    messagingSenderId: "23391461940",
    appId: "1:23391461940:web:9c81a09347bbb9ebdca061"
};

// Initialize Firebase app
firebase.initializeApp(firebaseConfig);
const functions = firebase.functions();

/**
 * Format elapsed time as "X minutes Y seconds"
 */
function formatTimeSpent(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
        return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (seconds === 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Show error message for a specific field
 */
function showFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);

    if (field && error) {
        field.classList.add('error');
        error.textContent = message;
        error.classList.add('show');
    }
}

/**
 * Hide error message for a specific field
 */
function hideFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);

    if (field && error) {
        field.classList.remove('error');
        error.classList.remove('show');
    }
}

/**
 * Validate all form inputs
 * Returns { isValid: boolean, errors: string[] }
 */
function validateForm() {
    let isValid = true;
    const errors = [];

    // Clear all previous errors
    hideFieldError('studentName', 'studentNameError');
    hideFieldError('studentEmail', 'studentEmailError');
    hideFieldError('professorEmail', 'professorEmailError');

    // Hide all question errors
    document.querySelectorAll('.question-item .error').forEach(error => {
        error.classList.remove('show');
        const questionItem = error.closest('.question-item');
        if (questionItem) {
            questionItem.classList.remove('has-error');
        }
    });

    // Validate student name
    const studentName = document.getElementById('studentName').value.trim();
    if (!studentName) {
        showFieldError('studentName', 'studentNameError', 'Please enter your name.');
        isValid = false;
        errors.push('Student name is required');
    }

    // Validate student email
    const studentEmail = document.getElementById('studentEmail').value.trim();
    if (!studentEmail) {
        showFieldError('studentEmail', 'studentEmailError', 'Please enter your email address.');
        isValid = false;
        errors.push('Student email is required');
    } else if (!isValidEmail(studentEmail)) {
        showFieldError('studentEmail', 'studentEmailError', 'Please enter a valid email address.');
        isValid = false;
        errors.push('Student email is invalid');
    }

    // Validate professor email
    const professorEmail = document.getElementById('professorEmail').value.trim();
    if (!professorEmail) {
        showFieldError('professorEmail', 'professorEmailError', 'Please enter your professor\'s email address.');
        isValid = false;
        errors.push('Professor email is required');
    } else if (!isValidEmail(professorEmail)) {
        showFieldError('professorEmail', 'professorEmailError', 'Please enter a valid email address.');
        isValid = false;
        errors.push('Professor email is invalid');
    }

    // Validate all 50 survey questions
    const questionGroups = [
        'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11',
        'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
        'd1', 'd2', 'd3', 'd4', 'd5',
        'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13'
    ];

    let firstUnansweredQuestion = null;

    questionGroups.forEach(name => {
        const radios = document.getElementsByName(name);
        const isAnswered = Array.from(radios).some(radio => radio.checked);

        if (!isAnswered) {
            isValid = false;
            errors.push(`Question ${name} is not answered`);

            // Find the question item and show error
            const questionItem = document.querySelector(`[data-question="${name}"]`);
            if (questionItem) {
                questionItem.classList.add('has-error');
                const errorDiv = questionItem.querySelector('.error');
                if (errorDiv) {
                    errorDiv.classList.add('show');
                }

                // Track first unanswered question for scrolling
                if (!firstUnansweredQuestion) {
                    firstUnansweredQuestion = questionItem;
                }
            }
        }
    });

    // Scroll to first error
    if (!isValid) {
        if (firstUnansweredQuestion) {
            firstUnansweredQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Scroll to top if error is in student info
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    return { isValid, errors };
}

/**
 * Show info box message
 */
function showInfoBox(message, type = 'info') {
    const infoBox = document.getElementById('info_box');
    if (infoBox) {
        infoBox.textContent = message;
        infoBox.className = type; // 'success' or 'error'
        infoBox.style.display = 'block';

        // Scroll to info box
        infoBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Hide info box
 */
function hideInfoBox() {
    const infoBox = document.getElementById('info_box');
    if (infoBox) {
        infoBox.style.display = 'none';
    }
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
    event.preventDefault();

    hideInfoBox();

    // Validate form
    const validation = validateForm();
    if (!validation.isValid) {
        showInfoBox('Please complete all required fields and answer all questions.', 'error');
        return false;
    }

    // Calculate time spent
    const timeSpent = formatTimeSpent(Date.now() - startTime);

    // Get form data
    const studentName = document.getElementById('studentName').value.trim();
    const studentEmail = document.getElementById('studentEmail').value.trim();
    const professorEmail = document.getElementById('professorEmail').value.trim();

    // Collect all survey responses
    const responses = {};
    const questionGroups = [
        'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11',
        'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10',
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
        'd1', 'd2', 'd3', 'd4', 'd5',
        'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13'
    ];

    questionGroups.forEach(name => {
        const radio = document.querySelector(`input[name="${name}"]:checked`);
        if (radio) {
            responses[name] = parseInt(radio.value);
        }
    });

    // Disable submit button and show loading state
    const submitButton = document.getElementById('submit');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    submitButton.textContent = 'Sending...';

    try {
        // Call Firebase Cloud Function
        const sendSurveyNotification = functions.httpsCallable('sendSurveyNotification');
        const result = await sendSurveyNotification({
            studentName: studentName,
            studentEmail: studentEmail,
            professorEmail: professorEmail,
            timeSpent: timeSpent,
            responses: responses
        });

        // Success
        console.log('Survey notification sent:', result.data);
        showInfoBox(
            `Thank you, ${studentName}! Your survey has been submitted successfully. ` +
            `Your professor has been notified. Time spent: ${timeSpent}`,
            'success'
        );

        // Optionally disable form after successful submission
        document.getElementById('SurveyForm').style.opacity = '0.6';
        document.getElementById('SurveyForm').style.pointerEvents = 'none';

    } catch (error) {
        console.error('Error submitting survey:', error);

        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = originalButtonText;

        // Show error message
        let errorMessage = 'An error occurred while submitting your survey. Please try again.';

        if (error.code === 'functions/resource-exhausted') {
            errorMessage = 'Daily email limit reached. Please try again tomorrow.';
        } else if (error.code === 'functions/invalid-argument') {
            errorMessage = 'Invalid email address. Please check your entries and try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        showInfoBox(errorMessage, 'error');
    }

    return false;
}

/**
 * Initialize form when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    // Attach form submit handler
    const form = document.getElementById('SurveyForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    // Add real-time validation for input fields
    const studentName = document.getElementById('studentName');
    const studentEmail = document.getElementById('studentEmail');
    const professorEmail = document.getElementById('professorEmail');

    if (studentName) {
        studentName.addEventListener('blur', function() {
            if (!this.value.trim()) {
                showFieldError('studentName', 'studentNameError', 'Please enter your name.');
            } else {
                hideFieldError('studentName', 'studentNameError');
            }
        });
    }

    if (studentEmail) {
        studentEmail.addEventListener('blur', function() {
            const email = this.value.trim();
            if (!email) {
                showFieldError('studentEmail', 'studentEmailError', 'Please enter your email address.');
            } else if (!isValidEmail(email)) {
                showFieldError('studentEmail', 'studentEmailError', 'Please enter a valid email address.');
            } else {
                hideFieldError('studentEmail', 'studentEmailError');
            }
        });
    }

    if (professorEmail) {
        professorEmail.addEventListener('blur', function() {
            const email = this.value.trim();
            if (!email) {
                showFieldError('professorEmail', 'professorEmailError', 'Please enter your professor\'s email address.');
            } else if (!isValidEmail(email)) {
                showFieldError('professorEmail', 'professorEmailError', 'Please enter a valid email address.');
            } else {
                hideFieldError('professorEmail', 'professorEmailError');
            }
        });
    }

    // Clear question errors when answered
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const questionItem = this.closest('.question-item');
            if (questionItem) {
                questionItem.classList.remove('has-error');
                const errorDiv = questionItem.querySelector('.error');
                if (errorDiv) {
                    errorDiv.classList.remove('show');
                }
            }
        });
    });

    console.log('Student Survey Form initialized. Time tracking started.');
});
