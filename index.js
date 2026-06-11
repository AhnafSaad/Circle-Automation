require('dotenv').config();
const cron = require('node-cron');

const { extractDataFromEmail } = require('./src/utils/extractId');
const { verifyClientFromAPI } = require('./src/api/checkUser');
const { summarizeIssueWithAI } = require('./src/ai/gemini');
const { generateTokenViaScraping } = require('./src/scraper/generateToken');
const { fetchUnreadEmails, sendReplyEmail } = require('./src/email/outlook');

async function processIncomingEmails() {
    const emails = await fetchUnreadEmails();
    
    for (const email of emails) {
        const data = extractDataFromEmail(email);
        if (data.skip) continue;

        const { isVerified, clientType } = await verifyClientFromAPI(data.u);
        if (!isVerified) continue;

        const issueSummary = await summarizeIssueWithAI(data.b);

        const token = await generateTokenViaScraping(data.u, clientType, issueSummary);

        if (token !== "Failed") {
            const replySubject = `Re: ${data.r}`;
            let replyBody = "";

            if (clientType === 'Ticket') {
                replyBody = `প্রিয় এন্টারপ্রাইজ ক্লায়েন্ট, আপনার সাপোর্ট টিকেটটি তৈরি করা হয়েছে।\n\nটিকেট আইডি: ${token}\nআপনার সমস্যার সারসংক্ষেপ: ${issueSummary}\n\nধন্যবাদ,\nএন্টারপ্রাইজ সাপোর্ট`;
            } else if (clientType === 'Radius') {
                replyBody = `আপনার রিকুয়েস্টটি সফলভাবে গ্রহণ করা হয়েছে।\n\nআপনার রেফারেন্স টোকেন: ${token}\nআপনার সমস্যার সারসংক্ষেপ: ${issueSummary}\n\nধন্যবাদ,\nসাপোর্ট টিম`;
            }

            await sendReplyEmail(data.s, replySubject, replyBody);
        } else {
            console.log(`Token generation failed for ${data.u}, no email sent.`);
        }
    }
}

cron.schedule('* * * * *', processIncomingEmails);
console.log("🚀 Email processing service started. Polling every minute...");
