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
        // যদি মেইলবক্স এখনো ওপেন না হয়, তাহলে চেক করবে না
        if (isFetching || !client.mailbox) return;
        isFetching = true;

        try {
            await client.noop(); 

            // 💡 মাস্টার হ্যাক: ইনবক্সে মোট কতগুলো মেইল আছে সেটা বের করা
            let totalMails = client.mailbox.exists || 1;
            
            // 💡 শুধু শেষের ৩০টা মেইলের রেঞ্জ সেট করা
            let startSeq = Math.max(1, totalMails - 30); 

            // ওই শেষের ৩০টা মেইলের মধ্যে যেগুলা আনরিড (seen: false), শুধু সেগুলাকেই ধরবে
            let uids = await client.search({ seq: `${startSeq}:*`, seen: false }, { uid: true });
            
            if (uids && uids.length > 0) {
                uids = uids.slice(-5); // সেফটির জন্য একবারে সর্বোচ্চ ৫টা প্রসেস করবে
                
                for (let uid of uids) {
                    let emailData = await client.fetchOne(uid, { source: true }, { uid: true }); 
                    
                    if (emailData && emailData.source) {
                        let parsed = await simpleParser(emailData.source);
                        let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                        let subject = parsed.subject || "(No Subject)";
                        
                        let isIgnored = ignoreKeywords.some(keyword => senderAddress.includes(keyword));
                        
                        // 💡 রিপ্লাই বা ফরোয়ার্ড মেইল কি না সেটা চেক করা (In-Reply-To / References header + subject prefix)
                        let subjTrimmed = subject.toLowerCase().trim();
                        let isReply = !!parsed.inReplyTo || !!parsed.references || subjTrimmed.startsWith('re:') || subjTrimmed.startsWith('fwd:') || subjTrimmed.startsWith('fw:');
                        
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }); 
                        
                        if (isIgnored) {
                            console.log(`⏭️ Ignored promotional email from: ${senderAddress}`);
                        } else if (isReply) {
                            // 💡 যদি কাস্টমার রিপ্লাই দেয়, তবে সেটা ইগনোর করবে
                            console.log(`⏭️ Ignored customer REPLY to avoid duplicate token: ${senderAddress}`);
                        } else {
                            emailQueue.push({
                                uid: uid,
                                subject: subject, 
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
            isFetching = false;
            processQueue(); 
        }
    };

    try {
        await client.connect();
        console.log("⚡ Gmail Server Connected!");

        await client.mailboxOpen('INBOX');
        console.log("📥 INBOX Opened! Scanning ONLY the last 30 emails for backlog...");

        client.on('close', () => {
            console.log("⚠️ Gmail Connection Dropped! Auto-reconnecting in 5 seconds...");
            isFetching = false; 
            setTimeout(() => startEmailListener(onNewEmail), 5000);
        });

        client.on('error', (err) => {
            console.error("❌ IMAP Client Error:", err.message);
        });

        client.on('exists', () => {
            console.log("🔔 Server Signal: New email landed!");
            checkMails();
        });

        // বট চালু হওয়ার পর একবার ব্যাকলগ চেক করবে (লাস্ট ৩০টার মধ্যে)
        await checkMails();

        setInterval(() => {
            checkMails();
        }, 10000);

    } catch (error) {
        console.error("❌ IMAP Connection Error:", error.message);
        isFetching = false;
        setTimeout(() => startEmailListener(onNewEmail), 10000);
    }
}

module.exports = { startEmailListener, sendReplyEmail };