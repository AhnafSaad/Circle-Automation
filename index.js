require('dotenv').config();
const { fetchUnreadEmails, sendReplyEmail } = require('./src/email/outlook');
const { extractDataFromEmail } = require('./src/utils/extractId');
const { verifyClientFromAPI } = require('./src/api/checkUser');
const { summarizeIssueWithAI } = require('./src/ai/gemini');
const { generateTokenViaScraping } = require('./src/scraper/generateToken');

async function startBot() {
    console.log("🤖 Support Bot started... Checking for new emails every 30 seconds.\n");
    
    setInterval(async () => {
        const emails = await fetchUnreadEmails();
        
        for (let email of emails) {
            console.log(`\n📩 New Email Received! From: ${email.sender}`);
            
            const emailData = {
                subject: email.subject || "",
                bodyPreview: email.body || "",
                body: { content: email.body || "" },
                sender: { emailAddress: { address: email.sender || "" } }
            };

            const data = extractDataFromEmail(emailData);
            if (data.skip) {
                console.log("⏭️ Skipped: No valid ID found in the email.");
                continue;
            }

            console.log(`✅ Extracted ID: ${data.u}`);
            console.log("🔍 Checking API...");
            const { isVerified, clientType } = await verifyClientFromAPI(data.u);

            if (isVerified) {
                console.log(`🎉 Success: User verified as ${clientType}!`);
                
                // AI Summary
                const issueSummary = await summarizeIssueWithAI(data.b);
                console.log(`📝 AI Summary generated: ${issueSummary}`);
                
                // Puppeteer Scraping
                console.log("⚙️ Generating Token via Scraping...");
                const token = await generateTokenViaScraping(data.u, clientType, issueSummary);
                
                // Reply Email
                if (token !== "Failed") {
                    const replyBody = `আপনার রেফারেন্স টোকেন: ${token}\nসমস্যার সারসংক্ষেপ: ${issueSummary}\n\nধন্যবাদ!`;
                    await sendReplyEmail(data.s, `Re: ${data.r}`, replyBody);
                } else {
                    console.log("❌ Failed to generate token.");
                }
            } else {
                console.log("❌ User not found in API.");
            }
        }
    }, 30000); 
}

startBot();