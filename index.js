require('dotenv').config();
const express = require('express');

const { extractDataFromEmail } = require('./src/utils/extractId');
const { verifyClientFromAPI } = require('./src/api/checkUser');
// টেস্টিং শেষে এগুলো আনকমেন্ট করতে হবে
// const { summarizeIssueWithAI } = require('./src/ai/gemini');
// const { generateTokenViaScraping } = require('./src/scraper/generateToken');
// const { sendReplyEmail } = require('./src/email/outlook');

const app = express();
app.use(express.json());

app.post('/webhook/email', async (req, res) => {
    const { sender, subject, body } = req.body;
    console.log(`\n📬 Webhook Received! Email from: ${sender}`);
    
    // Power Automate-কে সাথে সাথে রেসপন্স দেওয়া
    res.status(200).send("Webhook received");

    // extractId.js এর জন্য ডাটা সাজানো
    const emailData = {
        subject: subject || "",
        bodyPreview: body || "",
        body: { content: body || "" },
        sender: { emailAddress: { address: sender || "" } }
    };

    const data = extractDataFromEmail(emailData);
    if (data.skip) {
        console.log("⏭️ Skipped: No valid ID found.");
        return;
    }

    console.log(`✅ Extracted ID: ${data.u}`);

    console.log("🔍 Checking API...");
    const { isVerified, clientType } = await verifyClientFromAPI(data.u);

    if (isVerified) {
        console.log(`🎉 Success: User verified as ${clientType}!`);
        // আপাতত শুধু API টেস্ট করা হচ্ছে। সবকিছু ঠিক থাকলে এখানে Gemini এবং Puppeteer এর কোডগুলো যুক্ত হবে।
    } else {
        console.log("❌ Failed: User not found in API.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Express Server is running on port ${PORT}`);
});