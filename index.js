require('dotenv').config();

// 💡 এখানে startEmailListener কল করা হয়েছে
const { startEmailListener, sendReplyEmail } = require('./src/email/gmail'); 
const { extractDataFromEmail } = require('./src/utils/extractId');
const { verifyClientFromAPI } = require('./src/api/checkUser');
const { summarizeIssueWithAI } = require('./src/ai/gemini');
const { generateTokenViaAPI } = require('./src/api/generateTokenAPI'); // ✅ Radius-verified দের জন্য
const { createTicketViaAPI } = require('./src/api/createTicketViaAPI'); // ⚠️ Ticket-verified দের জন্য (placeholder)

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
            return; // 💡 লুপ না থাকায় continue এর বদলে return হবে
        }

        console.log(`✅ Extracted ID/Phone: ${data.u}`);
        console.log("🔍 Checking API...");
        
        const { isVerified, clientType, exactUsername, clientId } = await verifyClientFromAPI(data.u, data.s);

        if (isVerified) {
            console.log(`🎉 Success: User verified as ${clientType}! Exact Username: ${exactUsername}, CID: ${clientId}`);
            
            const issueSummary = await summarizeIssueWithAI(data.b);
            console.log(`📝 AI Summary generated: ${issueSummary}`);
            
            let result;

            if (clientType === 'Radius') {
                console.log("⚙️ [Radius] Generating Token via API...");
                result = await generateTokenViaAPI(clientId, clientType, issueSummary);
            } else if (clientType === 'Ticket') {
                console.log("🎫 [Ticket] Creating Ticket via API...");
                result = await createTicketViaAPI(exactUsername, issueSummary);
            } else {
                console.log(`❌ Unknown clientType: ${clientType}`);
                result = "Failed";
            }

            if (result !== "Failed") {
                const label = clientType === 'Radius' ? 'রেফারেন্স টোকেন' : 'টিকিট আইডি';
                const replyBody = `আপনার ${label}: ${result}\nসমস্যার সারসংক্ষেপ: ${issueSummary}\n\nধন্যবাদ!`;
                await sendReplyEmail(data.s, `Re: ${data.r}`, replyBody);
            } else {
                console.log(`❌ Failed to generate ${clientType === 'Radius' ? 'token' : 'ticket'}.`);
            }
        } else {
            console.log("❌ User not found in API.");
        }
    });
}

startBot();