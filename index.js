require('dotenv').config();

// 💡 এখানে startEmailListener কল করা হয়েছে
const { startEmailListener, sendReplyEmail } = require('./src/email/gmail'); 
const { extractDataFromEmail } = require('./src/utils/extractId');
const { verifyClientFromAPI } = require('./src/api/checkUser');
const { summarizeIssueWithAI } = require('./src/ai/gemini');
const { generateTokenViaScraping } = require('./src/scraper/generateToken');

async function startBot() {
    console.log("🤖 Support Bot started... Initializing Hybrid Push + Polling System.\n");
    
    // 🚀 এখানে কোনো setInterval বা লুপ নেই, সরাসরি ইমেইল লিসেনার কাজ করবে
    await startEmailListener(async (email) => {
        console.log(`\n📩 New Email Received! From: ${email.sender}`);
        
        const emailData = {
            subject: email.subject || "",
            bodyPreview: email.body || "",
            body: { content: email.body || "" },
            sender: { emailAddress: { address: email.sender || "" } }
        };

        const data = extractDataFromEmail(emailData);
        if (data.skip) {
            console.log("⏭️ Skipped: No valid ID/Phone found.");
            return; // 💡 লুপ না থাকায় continue এর বদলে return হবে
        }

        console.log(`✅ Extracted ID/Phone: ${data.u}`);
        console.log("🔍 Checking API...");
        
        const { isVerified, clientType, exactUsername } = await verifyClientFromAPI(data.u);

        if (isVerified) {
            console.log(`🎉 Success: User verified as ${clientType}! Exact Username: ${exactUsername}`);
            
            const issueSummary = await summarizeIssueWithAI(data.b);
            console.log(`📝 AI Summary generated: ${issueSummary}`);
            
            console.log("⚙️ Generating Token via Scraping...");
            const token = await generateTokenViaScraping(exactUsername, clientType, issueSummary);
            
            if (token !== "Failed") {
                const replyBody = `আপনার রেফারেন্স টোকেন: ${token}\nসমস্যার সারসংক্ষেপ: ${issueSummary}\n\nধন্যবাদ!`;
                await sendReplyEmail(data.s, `Re: ${data.r}`, replyBody);
            } else {
                console.log("❌ Failed to generate token.");
            }
        } else {
            console.log("❌ User not found in API.");
        }
    });
}

startBot();