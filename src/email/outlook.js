const nodemailer = require('nodemailer');

// শুধুমাত্র ইমেইল সেন্ড করার কনফিগারেশন (SMTP)
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', 
    port: 587, 
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

// রিপ্লাই পাঠানোর ফাংশন
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
        console.error(`❌ Error sending email:`, error.message);
    }
}

// শুধুমাত্র sendReplyEmail এক্সপোর্ট করা হলো
module.exports = { sendReplyEmail };