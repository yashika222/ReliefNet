# 🚀 Quick Start - Email Notification System

## ✅ Setup Complete!

Your email notification system is fully integrated and ready to test.

---

## 📋 Step 1: Configure `.env`

Add these to your `.env` file:

```env
# Database
MONGO_URI=mongodb://127.0.0.1:27017/disaster_relief

# Server
PORT=3001
NODE_ENV=development

# Gmail SMTP (using Google App Password)
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_16_character_google_app_password
EMAIL_FROM=Disaster Relief <noreply@disasterrelief.com>

# App
BASE_URL=http://localhost:3001
APP_NAME=Disaster Relief Platform
```

### 🔑 Get Google App Password:
1. Go to https://myaccount.google.com/apppasswords
2. Generate password for "Mail"
3. Copy 16-character password → use as `EMAIL_PASS`

---

## 🧪 Step 2: Test Email System

### Option A: Quick Test Route (Recommended)

1. **Start server:**
   ```bash
   npm start
   ```

2. **Register at least one user:**
   - Visit: http://localhost:3001/auth/signup
   - Use a real email you can check

3. **Test email sending:**
   - Visit: http://localhost:3001/test-email
   - Or use curl:
     ```bash
     curl http://localhost:3001/test-email
     ```

4. **Check console output:**
   ```
   ✅ Test disaster created: Cyclone in Odisha
   📧 Email sent to user1@gmail.com
   📧 Email sent to user2@gmail.com
   ✅ Emails sent to all registered users.
   ```

5. **Check email inbox** - You should receive the disaster alert!

---

### Option B: Test via API Sync

1. **Trigger disaster sync:**
   ```bash
   curl http://localhost:3001/disasters/sync
   ```

2. **Check console:**
   ```
   ✅ Synced X disasters to DB. New: Y
   📧 Sent email alerts for Y new disasters to Z registered users
   ```

3. **Check inbox** - New disasters trigger emails automatically!

---

## 📧 Email Features

✅ **Automatic Detection** - Only NEW disasters trigger emails (no duplicates)  
✅ **All Registered Users** - Fetches all users from MongoDB User collection  
✅ **Professional Design** - Branded HTML emails with disaster details  
✅ **Donate Now Button** - Direct link to donation page with disasterId  
✅ **Error Handling** - Graceful failures, detailed console logs  

---

## 🎯 Presentation Script

**"Sir, our platform automatically tracks live disasters from the NDMA/ReliefWeb API. Whenever a new disaster appears, it is saved in MongoDB and a real-time email is sent to all registered users using Gmail SMTP via Nodemailer. The mail includes disaster details and a 'Donate Now' link to the campaign page. This automation replaces the manual campaign creation process found on other sites."**

**Demo Steps:**
1. Show registered users in MongoDB
2. Trigger `/test-email` or `/disasters/sync`
3. Show console logs: `📧 Email sent to user@gmail.com`
4. Open Gmail inbox → show received email
5. Click "Donate Now" → show website opens with disaster banner
6. Submit donation → show it's linked to disaster

---

## 🔍 Verify Everything Works

### Checklist:
- [ ] Nodemailer installed (`npm install`)
- [ ] `.env` configured with Gmail credentials
- [ ] At least 1 user registered in MongoDB
- [ ] Server running (`npm start`)
- [ ] Test route works (`/test-email`)
- [ ] Email received in inbox
- [ ] "Donate Now" button works
- [ ] Donation links to disaster

---

## 📁 Files Created/Modified

✅ `src/services/emailService.js` - Email sending service  
✅ `src/controllers/disasterController.js` - Auto-sync with email notifications  
✅ `src/routes/disasters.js` - Sync routes with email alerts  
✅ `src/routes/testRoutes.js` - Test route for email system  
✅ `src/app.js` - Registered test routes  
✅ `src/models/Donation.js` - Added disasterId field  
✅ `src/routes/donations.js` - Save disasterId with donations  
✅ `src/views/pages/donate.ejs` - Show disaster banner  
✅ `public/js/donate.js` - Include disasterId in form  

---

## 🐛 Troubleshooting

**No emails sent?**
- Check `.env` has correct `EMAIL_USER` and `EMAIL_PASS`
- Must use Gmail App Password (not regular password)
- Check console for error messages

**No users found?**
- Register at least one user at `/auth/signup`
- Verify user exists in MongoDB: `db.users.find()`

**Email errors?**
- `Invalid login`: Wrong password or not using App Password
- `Connection timeout`: Check internet/firewall
- `Rate limit`: Gmail has 500 emails/day limit

---

## ✅ Success!

Your email notification system is ready! Every new disaster automatically triggers email alerts to all registered users. 🎉

