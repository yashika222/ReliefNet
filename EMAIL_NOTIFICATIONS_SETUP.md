# 📧 Real-Time Email Notification System - Setup Guide

## Overview
This system automatically sends email alerts to **all registered users** whenever a new disaster is detected from the NDMA/ReliefWeb API or manually added.

---

## ✅ Step 1: Install Required Packages

```bash
npm install nodemailer
```

(Already installed if you've updated `package.json`)

---

## ✅ Step 2: Configure `.env` File

Add these environment variables to your `.env` file:

```env
# Server Configuration
PORT=3001
BASE_URL=http://localhost:3001
APP_NAME=Disaster Relief Platform

# MongoDB (if not already set)
MONGO_URI=mongodb://localhost:27017/disaster_relief

# Email Configuration (Gmail SMTP)
EMAIL_SERVICE=gmail
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_16_digit_app_password
EMAIL_FROM="Disaster Relief <yourgmail@gmail.com>"

# Alternative: Custom SMTP (e.g., SendGrid, Mailgun)
# EMAIL_HOST=smtp.sendgrid.net
# EMAIL_PORT=587
# EMAIL_SECURE=false
# EMAIL_USER=apikey
# EMAIL_PASS=your_sendgrid_api_key
```

### 🔑 Getting Gmail App Password

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification** (enable it if not already)
3. Scroll down to **App passwords**
4. Generate a new app password for "Mail"
5. Copy the 16-digit password (no spaces) and use it as `EMAIL_PASS`

**Important:** You cannot use your regular Gmail password. You MUST use an App Password.

---

## ✅ Step 3: Verify Integration

The system is already integrated in the following places:

1. **Automatic Sync** (`GET /disasters/sync`):
   - Fetches disasters from ReliefWeb API
   - Detects NEW disasters (not duplicates)
   - Sends emails to all registered users

2. **Controller Sync** (`POST /disasters/sync-and-notify`):
   - Uses `disasterController.autoSync()`
   - Sends emails for new disasters

3. **Demo Mode** (`POST /disasters/demo-start`):
   - Simulates new disasters every 10 seconds
   - Sends emails for each new disaster

---

## ✅ Step 4: Testing Steps

### Test 1: Manual Sync (Recommended for First Test)

1. **Start your server:**
   ```bash
   npm start
   # or
   npm run dev
   ```

2. **Ensure you have at least one registered user in MongoDB:**
   - Sign up at `/auth/signup`
   - Use a real email address you can check

3. **Trigger sync:**
   ```bash
   # Using curl
   curl http://localhost:3001/disasters/sync
   
   # Or visit in browser
   http://localhost:3001/disasters/sync
   ```

4. **Check console logs:**
   ```
   ✅ Synced X disasters to DB. New: Y
   📧 Sent email alerts for Y new disasters to Z registered users
   ```

5. **Check email inbox:**
   - Open Gmail for the registered user
   - Look for email with subject: "Urgent: [Disaster Name] — [Location]"
   - Verify the email contains:
     - Disaster name, location, type, severity
     - Description
     - "Donate Now" button

### Test 2: Demo Mode (For Presentation)

1. **Start demo:**
   ```bash
   curl -X POST http://localhost:3001/disasters/demo-start
   ```

2. **Wait 10 seconds** - A new disaster will be created and emails sent

3. **Check inbox** - You should receive an email alert

4. **Click "Donate Now" button** in the email:
   - Should open: `http://localhost:3001/donate?disasterId=DEMO-NEW-1`
   - Page should show disaster details at the top
   - Fill out donation form and submit

5. **Stop demo:**
   ```bash
   curl -X POST http://localhost:3001/disasters/demo-stop
   ```

### Test 3: Using Controller Sync (With Auth)

1. **Login to your website** (get session cookie)

2. **Trigger sync:**
   ```bash
   curl -X POST http://localhost:3001/disasters/sync-and-notify \
     -H "Cookie: <your_session_cookie>"
   ```

---

## ✅ Step 5: Email Content Preview

Each email includes:

- **Header:** App name and "Real-time Disaster Alert"
- **Disaster Details:**
  - Title (e.g., "Cyclone in Odisha")
  - Location (e.g., "Odisha, India")
  - Type (e.g., "Cyclone")
  - Severity badge (color-coded: Red=Severe, Orange=High, Blue=Moderate)
  - Description
- **Call-to-Action:** "Donate Now" button linking to `/donate?disasterId=...`
- **Footer:** Note that user is receiving this because they registered

---

## ✅ Step 6: Donation Flow

1. **User clicks "Donate Now"** in email
2. **Redirects to:** `/donate?disasterId=<disaster_id>`
3. **Page displays:**
   - Banner showing disaster details (title, location, type, severity)
   - Regular donation form below
4. **User submits donation:**
   - `disasterId` is automatically included in the donation record
   - Admin can view which user donated to which disaster

---

## ✅ Step 7: Admin Dashboard (Donation Tracking)

To view donations linked to disasters:

```javascript
// Example query (in admin dashboard or API):
const donations = await Donation.find({ disasterId: 'DEMO-ODISHA-CYCLONE' })
  .populate('user', 'name email')
  .sort({ createdAt: -1 });
```

This shows:
- Which users donated
- Their email addresses
- Donation amounts/items
- Timestamps

---

## 🎯 Presentation Demo Script

### For Your Evaluation:

1. **Show Registered Users:**
   - Open MongoDB Compass or terminal
   - Show: `db.users.find({}, {email: 1})`
   - Explain: "These are all registered users who will receive alerts"

2. **Trigger New Disaster:**
   ```bash
   curl -X POST http://localhost:3001/disasters/demo-start
   ```

3. **Show Console Logs:**
   ```
   📧 Demo: Sent email alerts for Severe Cyclone (Demo) to 5 users
   ```

4. **Open Gmail:**
   - Show the received email
   - Highlight: Professional design, disaster details, "Donate Now" button

5. **Click "Donate Now":**
   - Show website opens with disaster banner
   - Fill out donation form
   - Submit

6. **Show Admin Dashboard:**
   - Display donation record
   - Show it's linked to the disaster
   - Show user email and details

---

## 🔧 Troubleshooting

### Problem: Emails not sending

**Check:**
1. ✅ `.env` file has correct `EMAIL_USER` and `EMAIL_PASS`
2. ✅ Using Gmail App Password (not regular password)
3. ✅ 2-Step Verification is enabled on Gmail
4. ✅ Check console for error messages

**Common Errors:**
- `Invalid login`: Wrong password or not using App Password
- `Connection timeout`: Check internet/firewall
- `Rate limit exceeded`: Gmail has daily sending limits (500 emails/day)

### Problem: No users receiving emails

**Check:**
1. ✅ Users exist in MongoDB `users` collection
2. ✅ Users have valid `email` field
3. ✅ Check console: `📧 Sent alerts for X new disasters to Y registered users`
   - If Y is 0, no users found

### Problem: Duplicate emails

**Solution:** The system checks for existing disasters by `disasterId` before sending emails. Only truly NEW disasters trigger emails.

---

## 📊 Features Summary

✅ **Automated Email Alerts** - Only registered users receive emails  
✅ **Professional Email Design** - Branded, responsive HTML emails  
✅ **Smart Detection** - Only new disasters trigger alerts (no duplicates)  
✅ **Donation Linking** - Donations linked to disasters via `disasterId`  
✅ **Admin Tracking** - View which users donated to which disasters  
✅ **Multiple Entry Points** - Works with API sync, manual creation, demo mode  

---

## 🚀 Next Steps (Optional Enhancements)

1. **Scheduled Auto-Sync:**
   ```bash
   npm install node-cron
   ```
   Then schedule `autoSync()` to run every 15 minutes

2. **Email Preferences:**
   - Add `emailPreferences` field to User model
   - Allow users to opt-out of alerts

3. **Batch Processing:**
   - Use a job queue (BullMQ) for large user bases
   - Prevents timeout for 1000+ users

4. **Email Templates:**
   - Create multiple templates (urgent, regular, weekly digest)

---

## 📝 Code Files Modified/Created

1. ✅ `src/services/emailService.js` - Email sending service
2. ✅ `src/controllers/disasterController.js` - Sync with email notifications
3. ✅ `src/routes/disasters.js` - Routes updated to send emails
4. ✅ `src/routes/index.js` - Donate route handles `disasterId` query
5. ✅ `src/models/Donation.js` - Added `disasterId` and `disaster` fields
6. ✅ `src/routes/donations.js` - Save `disasterId` with donations
7. ✅ `src/views/pages/donate.ejs` - Display disaster banner
8. ✅ `public/js/donate.js` - Include `disasterId` in donation payload

---

## ✅ Success Checklist

- [ ] Nodemailer installed
- [ ] `.env` configured with Gmail credentials
- [ ] At least one user registered in MongoDB
- [ ] Tested email sending (check inbox)
- [ ] Verified "Donate Now" button works
- [ ] Confirmed donation links to disaster
- [ ] Ready for presentation!

---

**Questions?** Check the console logs - they provide detailed information about email sending status.

