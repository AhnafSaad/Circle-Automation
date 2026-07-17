// File: src/email/mailAccount.js
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { getAccessToken } = require('../api/getOutlookToken'); // 🚀 নতুন টোকেন মেথড ইম্পোর্ট করা হলো

// 🚀  ইগনোর লিস্ট 
const ignoreKeywords = [
    'linkedin', 'instagram', 'facebook', 'twitter', 'x.com', 'youtube', 'pinterest',
    'postman', 'realmadrid', 'github', 'gitlab', 'vercel', 'heroku', 'render', 'mongodb',
    'dazn', 'binance', 'shopify', 'coursera', 'n8n', 'promotions', 'marketing',
    'newsletter', 'no-reply', 'noreply', 'alerts',
    'fontawesome.com', 'mailchimp', 'sendgrid', 'campaign-archive', 'substack',
    'ticket@windstreamcommunication.net',
    'ticket@yetfix.net',
    'ticket1@circlenetworkbd.com',
    'ites_billing@yetfix.net',
];

// 🚀 ইন্টারনাল স্টাফ ডোমেইন
const internalDomains = [
    '@windstreamcommunication.net',
    '@circlenetworkbd.com',
    '@yetfix.net'
];

// 🚀 ড্যাশবোর্ডের JSON ফাইল থেকে লাইভ ইগনোর লিস্ট পড়ার ফাংশন
function getDynamicIgnoreList() {
    const ignoreListPath = path.join(__dirname, '../../dashboard/ignore-list.json');
    if (!fs.existsSync(ignoreListPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(ignoreListPath, 'utf8'));
    } catch (e) {
        return [];
    }
}

/**
 * Creates an independent email account handler (IMAP listener + SMTP sender).
 */
function createMailAccount(config) {
    const {
        name = 'Account',
        user, // বটের নিজস্ব ইমেইল এড্রেস
        pass, // (OAuth-এ এটি আর কাজে লাগবে না, তবে কনফিগে থাকলে সমস্যা নেই)
        imapHost,
        imapPort = 993,
        smtpHost,
        smtpPort = 587, // Outlook-এর জন্য 587
        smtpSecure = false, // 587 পোর্টের জন্য false হবে
    } = config;

    if (!user || !imapHost || !smtpHost) {
        throw new Error(`❌ [${name}] Missing required mail config (user/imapHost/smtpHost)`);
    }

    let emailQueue = [];
    let isProcessingQueue = false;
    let isFetching = false;

    // 🚀 মেইল সেন্ড করার ফাংশন (ডাইনামিক টোকেন দিয়ে)
    async function sendReplyEmail(toAddress, subject, bodyContent) {
        try {
            const token = await getAccessToken(); // পাঠানোর সময় ফ্রেশ টোকেন নেওয়া হলো
            if (!token) throw new Error("Failed to get OAuth token.");

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure,
                requireTLS: true,
                auth: {
                    type: 'OAuth2',
                    user: user,
                    accessToken: token
                },
            });

            await transporter.sendMail({
                from: `"Support Bot" <${user}>`,
                to: toAddress,
                subject,
                text: bodyContent,
            });
            console.log(`✅ [${name}] Reply sent to ${toAddress}`);
        } catch (error) {
            console.error(`❌ [${name}] Send Error:`, error.message);
        }
    }

    // 🚀 মেইল রিসিভ করার ফাংশন (ডাইনামিক টোকেন দিয়ে)
    async function startEmailListener(onNewEmail) {
        const token = await getAccessToken(); // কানেক্ট করার আগে টোকেন নেওয়া হলো
        if (!token) {
            console.error(`❌ [${name}] Cannot start listener, token missing.`);
            return;
        }

        const client = new ImapFlow({
            host: imapHost,
            port: imapPort,
            secure: true,
            auth: { 
                user: user, 
                accessToken: token 
            },
            logger: false,
        });

        const processQueue = async () => {
            if (isProcessingQueue) return;
            isProcessingQueue = true;

            while (emailQueue.length > 0) {
                let emailObj = emailQueue.shift();
                try {
                    await onNewEmail(emailObj);
                } catch (error) {
                    console.error(`❌ [${name}] Process Error:`, error.message);
                }
            }
            isProcessingQueue = false;
        };

        const checkMails = async () => {
            if (isFetching || !client.mailbox) return;
            isFetching = true;

            try {
                await client.noop();

                let totalMails = client.mailbox.exists || 1;
                let startSeq = Math.max(1, totalMails - 30);
                let uids = await client.search({ seq: `${startSeq}:*`, seen: false }, { uid: true });

                if (uids && uids.length > 0) {
                    uids = uids.slice(-5);
                    
                    const dynamicIgnoreList = getDynamicIgnoreList(); 
                    const allIgnoreKeywords = [...ignoreKeywords, ...dynamicIgnoreList];

                    for (let uid of uids) {
                        let emailData = await client.fetchOne(uid, { source: true }, { uid: true });

                        if (emailData && emailData.source) {
                            let parsed = await simpleParser(emailData.source);
                            let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                            let subject = parsed.subject || "(No Subject)";

                            let isIgnored = allIgnoreKeywords.some(keyword => senderAddress.includes(keyword.toLowerCase()));
                            let isInternal = internalDomains.some(domain => senderAddress.endsWith(domain));

                            let isInTo = false;
                            if (parsed.to && parsed.to.value) {
                                isInTo = parsed.to.value.some(r => r.address && r.address.toLowerCase() === user.toLowerCase());
                            }
                            
                            let isInCC = false;
                            if (parsed.cc && parsed.cc.value) {
                                isInCC = parsed.cc.value.some(r => r.address && r.address.toLowerCase() === user.toLowerCase());
                            }
                            
                            let isOnlyCC = isInCC && !isInTo;
                            let subjTrimmed = subject.toLowerCase().trim();
                            let isReply = !!parsed.inReplyTo || !!parsed.references || subjTrimmed.startsWith('re:') || subjTrimmed.startsWith('fwd:') || subjTrimmed.startsWith('fw:');

                            // 🚀 নিজের পাঠানো মেইল ইগনোর করার লজিক
                            let isSelfSent = senderAddress === user.toLowerCase();

                            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

                            // কন্ডিশনাল স্কিপিং
                            if (isSelfSent) {
                                console.log(`⏭️ [${name}] Ignored self-sent email.`);
                            } else if (isIgnored) {
                                console.log(`⏭️ [${name}] Ignored promotional/blocked email from: ${senderAddress}`);
                            } else if (isInternal) {
                                console.log(`⏭️ [${name}] Ignored internal staff email from: ${senderAddress}`);
                            } else if (isOnlyCC) {
                                console.log(`⏭️ [${name}] Ignored email (Bot is only in CC, not TO): ${senderAddress}`);
                            } else if (isReply) {
                                console.log(`⏭️ [${name}] Ignored customer REPLY to avoid duplicate token: ${senderAddress}`);
                            } else {
                                emailQueue.push({
                                    uid,
                                    subject,
                                    sender: senderAddress || "Unknown Sender",
                                    body: parsed.text || "",
                                    account: name,
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ [${name}] IMAP Search Error:`, err.message);
            } finally {
                isFetching = false;
                processQueue();
            }
        };

        try {
            await client.connect();
            console.log(`⚡ [${name}] Mail Server Connected! (${imapHost}) via OAuth 2.0`);

            await client.mailboxOpen('INBOX');
            console.log(`📥 [${name}] INBOX Opened! Scanning last 30 emails for backlog...`);

            client.on('close', () => {
                console.log(`⚠️ [${name}] Connection Dropped! Auto-reconnecting in 5 seconds...`);
                isFetching = false;
                setTimeout(() => startEmailListener(onNewEmail), 5000);
            });

            client.on('error', (err) => {
                console.error(`❌ [${name}] IMAP Client Error:`, err.message || String(err));
            });

            client.on('exists', () => {
                console.log(`🔔 [${name}] Server Signal: New email landed!`);
                checkMails();
            });

            await checkMails();

            setInterval(() => {
                checkMails();
            }, 10000);

        } catch (error) {
            console.error(`❌ [${name}] IMAP Connection Error:`, error.message);
            isFetching = false;
            setTimeout(() => startEmailListener(onNewEmail), 10000);
        }
    }

    return { name, startEmailListener, sendReplyEmail };
}

module.exports = { createMailAccount };