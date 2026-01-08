# GitHub Secrets Setup Guide

## 🔐 Important: Secure Your Email Credentials

Your `.env` file is **NEVER committed to GitHub** (it's in `.gitignore`). 

For **automated daily newsletters via GitHub Actions**, you need to add your email credentials as **GitHub Secrets**.

---

## 📝 Step-by-Step: Add GitHub Secrets

### 1. Go to Repository Settings
Navigate to: **https://github.com/prcasley/Woodmont-Industrial-News-Briefing/settings/secrets/actions**

Or:
- Go to your repository on GitHub
- Click **Settings** tab
- In left sidebar, click **Secrets and variables** → **Actions**

### 2. Add Each Secret

Click **"New repository secret"** and add these **6 secrets** one at a time:

#### Secret 1: SMTP_HOST
```
Name: SMTP_HOST
Secret: smtp.gmail.com
```

#### Secret 2: SMTP_PORT
```
Name: SMTP_PORT
Secret: 587
```

#### Secret 3: SMTP_USER
```
Name: SMTP_USER
Secret: pratcasley@gmail.com
```

#### Secret 4: SMTP_PASS
```
Name: SMTP_PASS
Secret: nqwx ybug wzie tsrk
```

#### Secret 5: EMAIL_FROM
```
Name: EMAIL_FROM
Secret: Woodmont Daily Briefing <pratcasley@gmail.com>
```

#### Secret 6: EMAIL_TO
```
Name: EMAIL_TO
Secret: pratiyush.casley@woodmontproperties.com
```

**To add more recipients**, make it comma-separated:
```
Secret: person1@woodmontproperties.com,person2@woodmontproperties.com,person3@woodmontproperties.com
```

---

## ✅ Verify Setup

After adding all 6 secrets, you should see them listed (values hidden for security):
- ✅ SMTP_HOST
- ✅ SMTP_PORT
- ✅ SMTP_USER
- ✅ SMTP_PASS
- ✅ EMAIL_FROM
- ✅ EMAIL_TO

---

## 🧪 Test the Automation

### Method 1: Manual Test (GitHub Actions)
1. Go to **Actions** tab in your repository
2. Click **"Send Daily Newsletter"** workflow
3. Click **"Run workflow"** button (top right)
4. Select `Test mode: true` (sends to only first recipient)
5. Click green **"Run workflow"** button
6. Wait 1-2 minutes, check your email!

### Method 2: Wait for Automatic Run
The newsletter will automatically send:
- **Every Monday-Friday at 8:00 AM EST**
- No action needed - just check your inbox!

---

## 🔒 Security Notes

✅ **Your credentials are safe:**
- `.env` file is **never** committed to GitHub
- GitHub Secrets are **encrypted** and hidden
- Only GitHub Actions workflows can access them
- Even repository admins can't view secret values after creation

✅ **Best Practices:**
- Use App Passwords instead of real passwords (especially for Gmail/Office365 with 2FA)
- Only share repository access with trusted team members
- Rotate credentials periodically

---

## 📊 What Your Team Will Receive

**Enhanced Newsletter Format:**
Each article now includes:

1. **📰 Article Title** - Full headline
2. **🏷️ Badges** - Location (NJ/PA/TX/FL), Category, Source
3. **📝 Description** - 250-character summary of the article
4. **💡 Why This Matters** - Impact context explaining relevance:
   - Transactions: "Signals market activity and pricing trends"
   - Availabilities: "Potential opportunity for expansion/investment"
   - People: "Personnel moves indicate market shifts"
   - Relevant: "Macro trend affecting industrial RE fundamentals"
5. **📰 Source** - Prominent display of publisher/source
6. **🔗 Read Full Article** - Gradient button linking to full story

**Email Design:**
- Professional gradient header with Woodmont branding
- 4 categorized sections (Relevant, Transactions, Availabilities, People)
- Mobile-responsive design
- Clean, modern styling

---

## ❓ Troubleshooting

### Newsletter not arriving?
1. Check **Actions** tab for workflow errors
2. Verify all 6 secrets are configured correctly
3. Make sure EMAIL_TO has correct recipient addresses
4. Check spam/junk folder

### Want to change recipients?
1. Go to Secrets settings
2. Find **EMAIL_TO** secret
3. Click **Update** (trash icon)
4. Enter new comma-separated email list

### Want to change schedule?
Edit `.github/workflows/send-newsletter.yml`:
```yaml
schedule:
  # Current: Monday-Friday at 8:00 AM EST (13:00 UTC)
  - cron: '0 13 * * 1-5'
```

---

## 🚀 You're All Set!

Once GitHub Secrets are configured, your team will receive beautiful daily briefings every weekday morning automatically! 📬
