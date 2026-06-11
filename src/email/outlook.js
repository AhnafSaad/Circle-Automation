const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

// ইমেইল সেন্ড করার কনফিগারেশন
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', port: 587, secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
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

// ইনবক্স থেকে আনরিড মেইল রিড করার সহজ লজিকim
async function fetchUnreadEmails() {
    const config = {
        imap: {
            user: 'ahnafsadik01857@outlook.com',
            password: 'yaoyepxyumfbkoqr', // আপনার জেনারেট করা App Password
            host: 'outlook.office365.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 10000
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // শুধু আনরিড মেইল খুঁজবে
        const searchCriteria = ['UNSEEN'];
        
        // markSeen: true দেওয়ার কারণে মেইলটি পড়ার সাথে সাথেই Read হয়ে যাবে
        const fetchOptions = { bodies: [''], markSeen: true }; 

        const messages = await connection.search(searchCriteria, fetchOptions);
        const unreadEmails = [];

        for (let item of messages) {
            const rawEmail = item.parts.find(part => part.which === '');
            
            // মেইলের বডি পার্স করা
            const mail = await simpleParser(rawEmail.body);

            unreadEmails.push({
                subject: mail.subject || "",
                bodyPreview: mail.text || "",
                body: { content: mail.text || "" },
                sender: {
                    emailAddress: {
                        address: mail.from?.value[0]?.address || ""
                    }
                }
            });
            console.log(`📬 New Email Detected from: ${mail.from?.value[0]?.address}`);
        }

        connection.end();
        return unreadEmails;

    } catch (error) {
        console.error("❌ Email Fetch Error:", error.message);
        return [];
    }
}

module.exports = { fetchUnreadEmails, sendReplyEmail };