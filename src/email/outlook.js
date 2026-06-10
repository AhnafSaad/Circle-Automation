const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', port: 587, secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function sendReplyEmail(toAddress, subject, bodyContent) {
    try {
        await transporter.sendMail({
            from: `"Support Team" <${process.env.EMAIL_USER}>`,
            to: toAddress,
            subject: subject,
            text: bodyContent
        });
        console.log(`✅ Reply Email sent to ${toAddress}`);
    } catch (error) {
        console.error(`❌ Error sending email to ${toAddress}:`, error.message);
    }
}

async function fetchUnreadEmails() { 
    // প্লেসহোল্ডার: এখানে আপনার ইমেইল ফেচ করার লজিক বসবে
    return []; 
}
module.exports = { fetchUnreadEmails, sendReplyEmail };