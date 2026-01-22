# Daily Newsletter Setup Guide

## Overview
Your newsletter system is now configured to automatically send a daily industrial news briefing to your coworkers every weekday morning at 8:00 AM EST.

## ✅ What's Already Done
1. **Newsletter Generation** - Beautiful HTML emails with categorized articles
2. **Email Function** - `sendDailyNewsletter()` function created
3. **GitHub Actions Workflow** - Automated daily sending (Monday-Friday at 8 AM EST)

## 📧 Step 1: Configure Email Settings

### Option A: Local Testing (Manual Sending)

1. **Edit the `.env` file** in the project root:
```bash
# Fill in your Woodmont email credentials
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@woodmontproperties.com
SMTP_PASS=your-password
EMAIL_FROM=Woodmont Daily Briefing <your-email@woodmontproperties.com>
EMAIL_TO=colleague1@woodmontproperties.com,colleague2@woodmontproperties.com
```

2. **Test locally:**
```bash
npm run build
npx tsx rssfeed.ts --send-newsletter
```

### Option B: GitHub Actions (Automated Daily)

1. **Go to GitHub Repository Settings**:
   - Navigate to: `https://github.com/woodmont-industrial/Woodmont-Industrial-News-Briefing/settings/secrets/actions`

2. **Add these Repository Secrets**:
   ```
   SMTP_HOST = smtp.office365.com
   SMTP_PORT = 587
   SMTP_USER = your-email@woodmontproperties.com
   SMTP_PASS = your-password
   EMAIL_FROM = Woodmont Daily Briefing <your-email@woodmontproperties.com>
   EMAIL_TO = colleague1@woodmontproperties.com,colleague2@woodmontproperties.com
   ```

3. **Enable the workflow**:
   - Go to: `Actions` tab → `Send Daily Newsletter` workflow
   - Click "Enable workflow" if disabled

## 🔐 Getting Your Email Credentials

### For Office 365/Outlook:
- **SMTP_HOST**: `smtp.office365.com`
- **SMTP_PORT**: `587`
- **SMTP_USER**: Your full Woodmont email address
- **SMTP_PASS**: 
  - **If you have 2FA enabled**: Create an "App Password"
    1. Go to https://account.microsoft.com/security
    2. Select "Advanced security options"
    3. Create new "App password" for "Mail"
  - **If no 2FA**: Use your regular email password

## 📅 Newsletter Schedule

The newsletter automatically sends:
- **When**: Every Monday-Friday at 8:00 AM EST (1:00 PM UTC)
- **What**: Articles from the last 24 hours, categorized as:
  - 📰 Relevant Articles (macro trends, major news)
  - 💼 Transactions (sales/leases ≥100K SF or ≥$25M)
  - 🏢 Availabilities (properties for sale/lease)
  - 👥 People News (personnel moves)

## 🧪 Testing the Newsletter

### Test Manually (Local):
```bash
# Make sure .env is configured
npm run build
npx tsx rssfeed.ts --send-newsletter
```

### Test via GitHub Actions:
1. Go to `Actions` tab in GitHub
2. Select "Send Daily Newsletter"
3. Click "Run workflow" → Set "Test mode" to `true`
4. This sends to only the first recipient in EMAIL_TO

## 📊 What Your Coworkers Will Receive

**Email Subject:**
```
🏭 Woodmont Industrial News Briefing - Wednesday, January 8, 2026
```

**Email Body:**
- Professional gradient header with Woodmont branding
- 4 categorized sections with the latest articles
- Each article shows:
  - Location badge (NJ, PA, TX, FL, US)
  - Category badge
  - Source badge
  - Brief summary (150 chars)
  - "Read Full Article" link
- Clean, mobile-responsive design

## 🔧 Customization Options

### Change Recipients
Edit `EMAIL_TO` in `.env` or GitHub Secrets:
```
EMAIL_TO=person1@company.com,person2@company.com,person3@company.com
```

### Change Schedule
Edit `.github/workflows/send-newsletter.yml`:
```yaml
schedule:
  # Current: Monday-Friday at 8:00 AM EST
  - cron: '0 13 * * 1-5'
  
  # Example: Every day at 7:00 AM EST
  - cron: '0 12 * * *'
```

### Change Time Window
Edit `src/server/email.ts`, line 75:
```typescript
// Current: Last 24 hours
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

// Example: Last 48 hours
const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
```

## ❓ Troubleshooting

### "Failed to send email" error
- ✅ Check SMTP credentials are correct
- ✅ Verify your email account allows SMTP access
- ✅ If using 2FA, make sure you're using an App Password

### "No articles" in newsletter
- The newsletter only includes articles from the last 24 hours
- If no new articles, sections will show "No updated information provided"

### Newsletter not sending automatically
- ✅ Check GitHub Secrets are configured
- ✅ Verify workflow is enabled in Actions tab
- ✅ Check Actions tab for error logs

## 🚀 Ready to Go!

Once configured, your team will receive a beautiful, categorized news briefing every weekday morning with the latest industrial real estate news!

**Need help?** Check the error logs in:
- Local testing: Terminal output
- GitHub Actions: Actions tab → Latest workflow run → Logs
