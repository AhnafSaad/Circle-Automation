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

        // 🛑 স্প্যাম ফিল্টার অনেক স্ট্রং করা হলো
        const ignoreKeywords = [
            'linkedin', 'instagram', 'facebook', 'twitter', 'x.com', 'youtube', 'pinterest', 
            'postman', 'realmadrid', 'github', 'gitlab', 'vercel', 'heroku', 'render', 'mongodb', 
            'dazn', 'binance', 'promotions', 'marketing', 'newsletter', 'no-reply', 'noreply', 
            'alerts', 'support@', 'info@', 'team@'
        ];

        const checkMails = async () => {
            if (isProcessing) return;
            isProcessing = true;

            try {
                let uids = await client.search({ seen: false });
                
                if (uids.length > 0) {
                    uids = uids.slice(-5);
                    
                    for (let uid of uids) {
                        let emailData = await client.fetchOne(uid, { source: true }); 
                        
                        if (emailData && emailData.source) {
                            let parsed = await simpleParser(emailData.source);
                            let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                            
                            // সেন্ডার মেইলে ওপরের কোনো কিওয়ার্ড থাকলে স্কিপ করবে
                            let isIgnored = ignoreKeywords.some(keyword => senderAddress.includes(keyword));
                            
                            if (isIgnored) {
                                console.log(`🚫 Ignored spam/promo email from: ${senderAddress}`);
                                await client.messageFlagsAdd(uid, ['\\Seen']); 
                                continue; 
                            }

                            const emailObj = {
                                uid: uid,
                                subject: parsed.subject || "(No Subject)", 
                                sender: senderAddress || "Unknown Sender",
                                body: parsed.text || "" 
                            };
                            
                            await client.messageFlagsAdd(uid, ['\\Seen']); 
                            await onNewEmail(emailObj); 
                        }
                    }
                }
            } catch (err) {
                console.error("❌ Search Error:", err.message);
            }
            
            isProcessing = false;
        };

        await checkMails();

        setInterval(() => {
            checkMails();
        }, 10000);

        client.on('exists', () => {
            checkMails();
        });

    } catch (error) {
        console.error("❌ IMAP Connection Error:", error.message);
        setTimeout(() => startEmailListener(onNewEmail), 10000);
    }
}

module.exports = { startEmailListener, sendReplyEmail };