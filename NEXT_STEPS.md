# Student Reflection Survey - Next Steps

## What Was Completed

1. **Modern HTML Layout** - Converted from table-based layout to modern flexbox/grid
2. **CSS Styling** - Created responsive, mobile-first design
3. **Form Validation** - JavaScript validation for all 53 fields (3 input fields + 50 questions)
4. **Time Tracking** - Tracks time from page load to submission
5. **Firebase Cloud Functions** - Email notification system with rate limiting
6. **Firestore Integration** - Rate limiting (90 emails/day)

## Required Setup Steps

### 1. Get Your Firebase Project Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `student-reflection`
3. Go to **Project Settings** (gear icon)
4. Scroll down to **"Your apps"** section
5. Click on the web app (or create one if needed)
6. Copy the Firebase configuration object

### 2. Update calculator.js with Firebase Config

Open `/home/bobby/repos/student-reflection/calculator.js` and replace lines 11-17 with your actual Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "ACTUAL_VALUE_FROM_FIREBASE",
    authDomain: "student-reflection.firebaseapp.com",
    projectId: "student-reflection",
    storageBucket: "student-reflection.appspot.com",
    messagingSenderId: "ACTUAL_VALUE_FROM_FIREBASE",
    appId: "ACTUAL_VALUE_FROM_FIREBASE"
};
```

### 3. Set Up Resend Email Service

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address
4. Go to **API Keys** section
5. Click **"Create API Key"**
6. Name it: "Student Reflection Survey"
7. Copy the API key (starts with `re_`)

### 4. Create functions/.env File

```bash
cd /home/bobby/repos/student-reflection/functions
cp .env.example .env
```

Edit `functions/.env` and add your Resend API key:
```
RESEND_API_KEY=re_your_actual_api_key_here
```

### 5. Install Firebase Functions Dependencies

```bash
cd /home/bobby/repos/student-reflection/functions
npm install
```

### 6. Upgrade to Firebase Blaze Plan

**IMPORTANT**: Cloud Functions require the Blaze (pay-as-you-go) plan.

1. Go to Firebase Console
2. Click **Upgrade** in the left sidebar
3. Select **Blaze Plan**
4. Add payment information
5. Don't worry - the free tier is generous:
   - 2M function invocations/month (free)
   - 90 emails/day limit built-in to stay under Resend's 100/day
   - You won't be charged unless you exceed free limits

### 7. Enable Firestore Database

1. Go to Firebase Console → **Firestore Database**
2. Click **"Create database"**
3. Choose **Production mode**
4. Select region (us-central1 recommended)
5. Click **"Enable"**

### 8. Deploy Everything to Firebase

```bash
cd /home/bobby/repos/student-reflection
firebase deploy
```

This will deploy:
- Hosting (your website)
- Functions (email sending)
- Firestore rules (security)

### 9. Test the Form

1. Visit your Firebase Hosting URL
2. Fill out the form completely
3. Submit and check:
   - Email arrives at professor's inbox
   - Check Resend dashboard for logs
   - Check Firebase Functions logs: `firebase functions:log`

## Testing Locally (Optional)

To test before deploying:

```bash
# Install Firebase emulators
firebase init emulators
# Select: Functions, Firestore

# Start emulators
firebase emulators:start

# In calculator.js, temporarily add this line after firebase.initializeApp():
# functions.useEmulator("localhost", 5001);

# Open http://localhost:5000 in your browser
```

## Email Configuration (Optional)

### Using Resend's Onboarding Domain

By default, emails will be sent from `noreply@delivered.resend.dev`. This works fine for testing.

### Using Your Own Domain (Production)

1. Go to Resend Dashboard → **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `rose.edu` or `survey.rose.edu`)
4. Add the DNS records Resend provides
5. Wait for verification (5-15 minutes)
6. Update `functions/index.js` line 55:
   ```javascript
   from: 'Student Survey <noreply@rose.edu>',
   ```

## Monitoring

### Check Email Delivery

- Resend Dashboard → **Logs**: See all sent emails
- Firebase Console → **Functions**: See function execution logs
- Firebase Console → **Firestore**: Check rate limit count

### Daily Rate Limit

- Limit: 90 emails/day (stays under Resend's 100/day free tier)
- Auto-resets at midnight
- View count: Firestore → `metadata/emailCount` document

## Troubleshooting

### "Firebase is not defined"

Make sure Firebase scripts are loading in index.html (lines 1454-1455)

### Email not sending

1. Check Functions logs: `firebase functions:log`
2. Check Resend dashboard logs
3. Verify API key in `functions/.env`
4. Ensure Blaze plan is active

### Rate limit errors

Check Firestore → `metadata/emailCount` to see current count

### CORS errors

Functions should handle CORS automatically. If issues persist, check Functions logs.

## File Structure Summary

```
/home/bobby/repos/student-reflection/
├── public/
│   ├── index.html          ← Modern survey form
│   └── style.css           ← Responsive CSS
├── calculator.js           ← Form logic & Firebase integration
├── functions/
│   ├── package.json        ← Dependencies
│   ├── index.js            ← Cloud Function (email sending)
│   ├── .env               ← Resend API key (gitignored)
│   └── .env.example       ← Template
├── firebase.json           ← Firebase configuration
├── firestore.rules         ← Security rules
└── .gitignore             ← Updated

```

## Cost Estimate

**Free Tier Limits:**
- Firebase Hosting: 10 GB storage, 360 MB/day bandwidth (FREE)
- Cloud Functions: 2M invocations/month (FREE)
- Firestore: 50K reads, 20K writes/day (FREE)
- Resend: 100 emails/day, 3,000/month (FREE)

**Your Usage:**
- ~90 emails/day max (rate limited)
- Minimal Firestore writes (1-2 per submission)
- Low bandwidth (simple form)

**Expected Cost**: $0/month (stays within all free tiers)

## Support

Questions? Check:
- Firebase Docs: https://firebase.google.com/docs
- Resend Docs: https://resend.com/docs
- Plan file: `/home/bobby/.claude/plans/zazzy-forging-sedgewick.md`

Good luck with your deployment!
