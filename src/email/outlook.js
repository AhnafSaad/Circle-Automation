const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', 
    port: 587, 
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

async function sendReplyEmail(toAddress, subject, bodyContent) {
    try {
        await transporter.sendMail({
            from: `"Support Team" <${process.env.EMAIL_USER}>`,
            to: toAddress, subject: subject, text: bodyContent
        });
        console.log(`✅ Reply Email sent to ${toAddress}`);
    } catch (error) {
        console.error(`❌ Error sending email:`, error.message);
    }
}

async function fetchUnreadEmails() {
    console.log("🔄 Connecting to Outlook via ImapFlow...");

    const client = new ImapFlow({
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // অবশ্যই App Password হতে হবে
        },
        logger: false, // লগ বন্ধ রাখা হয়েছে যেন টার্মিনাল ক্লিন থাকে
        tls: {
            rejectUnauthorized: false // অনেক সময় সার্টিফিকেট ইস্যুর কারণে ব্লক হয়, এটি তা এড়াবে
        }
    });

    const unreadEmails = [];

    try {
        await client.connect();
        console.log("✅ Successfully connected to Outlook IMAP!");

        // ইনবক্স লক করে ওপেন করা
        let lock = await client.getMailboxLock('INBOX');
        try {
            // UNSEEN (আনরিড) মেইল সার্চ করা
            const messages = await client.search({ seen: false });
            console.log(`📥 Found ${messages.length || 0} UNREAD emails in Inbox.`);

            for (let message of messages) {
                // মেইলের বডি এবং হেডার ফেচ করা
                let emailData = await client.fetchOne(message.uid, { source: true, envelope: true });
                
                let bodyText = '';
                if (emailData.source) {
                    const sourceStr = emailData.source.toString();
                    const match = sourceStr.match(/\r\n\r\n([\s\S]*)$/);
                    bodyText = match ? match[1] : '';
                }

                unreadEmails.push({
                    subject: emailData.envelope.subject || "",
                    bodyPreview: bodyText,
                    body: { content: bodyText },
                    sender: {
                        emailAddress: {
                            address: emailData.envelope.from[0]?.address || ""
                        }
                    }
                });

                // মেইল রিড হিসেবে মার্ক করা
                await client.messageFlagsAdd(message.uid, ['\\Seen']);
                console.log(`📬 Processed & Marked as Read: ${emailData.envelope.subject}`);
            }
        } finally {
            lock.release(); // ইনবক্স আনলক করা
        }
        await client.logout();

    } catch (error) {
        console.error("❌ IMAP Connection Failed:", error.message);
    }

    return unreadEmails;
}

module.exports = { fetchUnreadEmails, sendReplyEmail };