const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: false
});

let isProcessing = false;

async function sendReplyEmail(toAddress, subject, bodyContent) {
    try {
        await transporter.sendMail({
            from: `"Support Bot" <${process.env.EMAIL_USER}>`,
            to: toAddress,
            subject: subject,
            text: bodyContent
        });
        console.log(`✅ Reply sent to ${toAddress}`);
    } catch (error) {
        console.error(`❌ Send Error:`, error.message);
    }
}

async function startEmailListener(onNewEmail) {
    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        console.log("⚡ Hybrid Gmail Server Connected! (Push + 10s Polling active)...");

        const ignoreKeywords = [
            'linkedin.com', 'instagram.com', 'facebookmail.com', 'facebook.com', 
            'twitter.com', 'x.com', 'youtube.com', 'pinterest.com', 
            'promotions', 'marketing', 'newsletter', 'no-reply', 'noreply', 'alerts'
        ];

        // মেইল চেক করার কোর ফাংশন (এখন অনেক ফাস্ট)
        const checkMails = async () => {
            if (isProcessing) return;
            isProcessing = true;

            try {
                // 🚀 ম্যাজিক: ডেট ফিল্টার বাদ দেওয়া হয়েছে! এখন সরাসরি শুধু আনরিড মেইল খুঁজবে
                let uids = await client.search({ seen: false });
                
                if (uids.length > 0) {
                    // একসাথে অনেক মেইল আসলে যেন হ্যাং না করে, তাই শেষের ৫টি করে প্রসেস করবে
                    uids = uids.slice(-5);
                    
                    for (let uid of uids) {
                        let emailData = await client.fetchOne(uid, { source: true }); 
                        
                        if (emailData && emailData.source) {
                            let parsed = await simpleParser(emailData.source);
                            let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                            
                            let isIgnored = ignoreKeywords.some(keyword => senderAddress.includes(keyword));
                            
                            if (isIgnored) {
                                await client.messageFlagsAdd(uid, ['\\Seen']); 
                                continue; 
                            }

                            const emailObj = {
                                uid: uid,
                                subject: parsed.subject || "(No Subject)", 
                                sender: senderAddress || "Unknown Sender",
                                body: parsed.text || "" 
                            };
                            
                            await client.messageFlagsAdd(uid, ['\\Seen']); // মেইল Read করে দেয়া হলো
                            await onNewEmail(emailObj); // এক্সট্রাক্ট করার জন্য index.js এ পাঠানো হলো
                        }
                    }
                }
            } catch (err) {
                console.error("❌ Search Error:", err.message);
            }
            
            isProcessing = false;
        };

        // ১. রান করার সাথে সাথেই একবার চেক করবে
        await checkMails();

        // ২. ফলব্যাক হিসেবে প্রতি ১০ সেকেন্ড পর পর চেক করবে (যাতে কোনোভাবেই লেট না হয়)
        setInterval(() => {
            checkMails();
        }, 10000);

        // ৩. গুগল পুশ নোটিফিকেশন দিলে সাথে সাথেই চেক করবে (০ সেকেন্ড ডিলে)
        client.on('exists', () => {
            checkMails();
        });

    } catch (error) {
        console.error("❌ IMAP Connection Error:", error.message);
        // কানেকশন লস্ট হলে ১০ সেকেন্ড পর আবার রিস্টার্ট নিবে
        setTimeout(() => startEmailListener(onNewEmail), 10000);
    }
}

module.exports = { startEmailListener, sendReplyEmail };