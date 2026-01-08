import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { NormalizedItem } from '../types/index.js';
import { buildBriefing } from './newsletter.js';

// Send email using NodeMailer
export async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
    try {
        // Dynamic import to avoid requiring it if not used
        const nodemailer = require('nodemailer');

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'Woodmont Daily Briefing <operationssupport@woodmontproperties.com>',
            to: to.join(', '),
            subject: subject,
            html: html,
        };

        console.log('SMTP Config:', {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            from: process.env.EMAIL_FROM,
            to: to.join(', ')
        });
        console.log('Mail Options:', { subject, to: to.join(', '), htmlLength: html.length });

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        console.log('Full email info:', info);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
}

/**
 * Send daily newsletter with categorized articles
 */
export async function sendDailyNewsletter(): Promise<boolean> {
    try {
        console.log('📧 Preparing daily newsletter...');

        // Get the directory of this file
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Load articles from feed.json
        const feedPath = path.join(__dirname, '../../docs/feed.json');
        console.log('📂 Loading articles from:', feedPath);

        if (!fs.existsSync(feedPath)) {
            console.error('❌ Feed file not found:', feedPath);
            return false;
        }

        const feedData = JSON.parse(fs.readFileSync(feedPath, 'utf-8'));
        const allArticles: NormalizedItem[] = feedData.items || [];

        console.log(`📊 Total articles loaded: ${allArticles.length}`);

        // Filter for recent articles (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentArticles = allArticles.filter(article => {
            const pubDate = new Date(article.pubDate || article.date_published || 0);
            return pubDate >= oneDayAgo;
        });

        console.log(`📅 Articles from last 24 hours: ${recentArticles.length}`);

        // Categorize articles
        const transactions = recentArticles.filter(a => a.category === 'transactions');
        const availabilities = recentArticles.filter(a => a.category === 'availabilities');
        const relevant = recentArticles.filter(a => a.category === 'relevant');
        const people = recentArticles.filter(a => a.category === 'people');

        console.log('📋 Article breakdown:');
        console.log(`  - Transactions: ${transactions.length}`);
        console.log(`  - Availabilities: ${availabilities.length}`);
        console.log(`  - Relevant: ${relevant.length}`);
        console.log(`  - People: ${people.length}`);

        // Generate HTML newsletter
        const html = buildBriefing({
            transactions,
            availabilities,
            relevant,
            people
        }, '24 hours');

        // Get recipient email addresses
        const emailTo = process.env.EMAIL_TO || '';
        if (!emailTo) {
            console.error('❌ No EMAIL_TO configured in environment');
            return false;
        }

        const recipients = emailTo.split(',').map(e => e.trim());
        console.log(`📬 Sending to ${recipients.length} recipient(s):`, recipients);

        // Generate subject with date
        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const subject = `🏭 Woodmont Industrial News Briefing - ${today}`;

        // Send the email
        const success = await sendEmail(recipients, subject, html);

        if (success) {
            console.log('✅ Daily newsletter sent successfully!');
        } else {
            console.log('❌ Failed to send daily newsletter');
        }

        return success;
    } catch (error) {
        console.error('❌ Error in sendDailyNewsletter:', error);
        return false;
    }
}
