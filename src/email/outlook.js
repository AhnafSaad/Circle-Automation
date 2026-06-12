const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

// ১. মেইল পাঠানোর কনফিগারেশন (Gmail SMTP)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ২. মেইল রিড করার কনফিগারেশন (Gmail IMAP)
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

async function fetchUnreadEmails() {
    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        
        // আনরিড মেইলের আইডিগুলো (UID) খুঁজবে
        const uids = await client.search({ seen: false });
        
        let emails = [];
        for (let uid of uids) {
            // uid ব্যবহার করে মেইলের ডাটা আনা
            let emailData = await client.fetchOne(uid, { envelope: true, source: true });
            
            if (emailData && emailData.envelope) {
                emails.push({
                    uid: uid,
                    subject: emailData.envelope.subject || "(No Subject)", 
                    sender: emailData.envelope.from && emailData.envelope.from[0] ? emailData.envelope.from[0].address : "Unknown Sender",
                    body: emailData.source ? emailData.source.toString() : ""
                });
                
                await client.messageFlagsAdd(uid, ['\\Seen']); // মেইলটি Read মার্ক করা
            }
        }
        
        lock.release();
        await client.logout();
        return emails;
    } catch (error) {
        console.error("❌ IMAP Connection Error:", error.message);
        return [];
    }
}

module.exports = { fetchUnreadEmails, sendReplyEmail };