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

let emailQueue = [];
let isProcessingQueue = false;
let isFetching = false;
let fallbackInterval = null;

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

    const processQueue = async () => {
        if (isProcessingQueue) return;
        isProcessingQueue = true;

        while (emailQueue.length > 0) {
            let emailObj = emailQueue.shift(); 
            try {
                await onNewEmail(emailObj); 
            } catch (error) {
                console.error("❌ Process Error:", error.message);
            }
        }
        
        isProcessingQueue = false;
    };

    const ignoreKeywords = [
        'linkedin', 'instagram', 'facebook', 'twitter', 'x.com', 'youtube', 'pinterest', 
        'postman', 'realmadrid', 'github', 'gitlab', 'vercel', 'heroku', 'render', 'mongodb', 
        'dazn', 'binance', 'shopify', 'coursera', 'n8n', 'promotions', 'marketing', 
        'newsletter', 'no-reply', 'noreply', 'alerts', 'support@', 'info@', 'team@'
    ];

    const checkMails = async () => {
        if (isFetching) return;
        isFetching = true;
        let tempLock;

        try {
            tempLock = await client.getMailboxLock('INBOX');
            
            let yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            let uids = await client.search({ seen: false, since: yesterday });
            
            if (uids && uids.length > 0) {
                uids = uids.slice(-5); 
                
                for (let uid of uids) {
                    let emailData = await client.fetchOne(uid, { source: true }); 
                    
                    if (emailData && emailData.source) {
                        let parsed = await simpleParser(emailData.source);
                        let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                        
                        let isIgnored = ignoreKeywords.some(keyword => senderAddress.includes(keyword));
                        
                        await client.messageFlagsAdd(uid, ['\\Seen']); 
                        
                        if (!isIgnored) {
                            emailQueue.push({
                                uid: uid,
                                subject: parsed.subject || "(No Subject)", 
                                sender: senderAddress || "Unknown Sender",
                                body: parsed.text || "" 
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error("❌ IMAP Search Error:", err.message);
        } finally {
            if (tempLock) {
                tempLock.release();
            }
            isFetching = false;
            processQueue(); 
        }
    };

    try {
        await client.connect();
        console.log("⚡ Gmail Server Connected!");

        let initLock = await client.getMailboxLock('INBOX');
        initLock.release(); 
        console.log("🔓 INBOX active and securely listening for Real-time push emails...");

        client.on('close', () => {
            console.log("⚠️ Gmail Connection Dropped! Auto-reconnecting in 5 seconds...");
            if (fallbackInterval) clearInterval(fallbackInterval);
            
            // 💡 এই দুটো লাইন না থাকার কারণেই বট চুপ মেরে যাচ্ছিল!
            isFetching = false; 
            isProcessingQueue = false; 
            
            setTimeout(() => startEmailListener(onNewEmail), 5000);
        });

        client.on('error', (err) => {
            console.error("❌ IMAP Client Error:", err.message);
        });

        client.on('exists', () => {
            console.log("🔔 Push Notification: New email landed!");
            checkMails();
        });

        await checkMails();

        fallbackInterval = setInterval(() => {
            checkMails();
        }, 10000);

    } catch (error) {
        console.error("❌ IMAP Connection Error:", error.message);
        if (fallbackInterval) clearInterval(fallbackInterval);
        isFetching = false;
        isProcessingQueue = false;
        setTimeout(() => startEmailListener(onNewEmail), 10000);
    }
}

module.exports = { startEmailListener, sendReplyEmail };