const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

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
        pass,
        imapHost,
        imapPort = 993,
        smtpHost,
        smtpPort = 465,
        smtpSecure = true,
    } = config;

    if (!user || !pass || !imapHost || !smtpHost) {
        throw new Error(`❌ [${name}] Missing required mail config (user/pass/imapHost/smtpHost)`);
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user, pass },
    });

    let emailQueue = [];
    let isProcessingQueue = false;
    let isFetching = false;

    async function sendReplyEmail(toAddress, subject, bodyContent) {
        try {
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

    async function startEmailListener(onNewEmail) {
        const client = new ImapFlow({
            host: imapHost,
            port: imapPort,
            secure: true,
            auth: { user, pass },
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
                    
                    // 🚀 হার্ডকোডেড এবং ড্যাশবোর্ডের ডাইনামিক লিস্ট দুটোকে একসাথে মার্জ করা হলো
                    const dynamicIgnoreList = getDynamicIgnoreList(); 
                    const allIgnoreKeywords = [...ignoreKeywords, ...dynamicIgnoreList];

                    for (let uid of uids) {
                        let emailData = await client.fetchOne(uid, { source: true }, { uid: true });

                        if (emailData && emailData.source) {
                            let parsed = await simpleParser(emailData.source);
                            let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                            let subject = parsed.subject || "(No Subject)";

                            // ১. ইগনোর লিস্ট চেক
                            let isIgnored = allIgnoreKeywords.some(keyword => senderAddress.includes(keyword.toLowerCase()));

                            // ২. ইন্টারনাল ডোমেইন চেক
                            let isInternal = internalDomains.some(domain => senderAddress.endsWith(domain));

                            // ৩. CC লজিক (বট কি 'To' তে আছে নাকি শুধু 'CC' তে?)
                            let isInTo = false;
                            if (parsed.to && parsed.to.value) {
                                isInTo = parsed.to.value.some(r => r.address && r.address.toLowerCase() === user.toLowerCase());
                            }
                            
                            let isInCC = false;
                            if (parsed.cc && parsed.cc.value) {
                                isInCC = parsed.cc.value.some(r => r.address && r.address.toLowerCase() === user.toLowerCase());
                            }
                            
                            // যদি বট CC তে থাকে কিন্তু To তে না থাকে
                            let isOnlyCC = isInCC && !isInTo;

                            // ৪. রিপ্লাই চেক
                            let subjTrimmed = subject.toLowerCase().trim();
                            let isReply = !!parsed.inReplyTo || !!parsed.references || subjTrimmed.startsWith('re:') || subjTrimmed.startsWith('fwd:') || subjTrimmed.startsWith('fw:');

                            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

                            // কন্ডিশনাল স্কিপিং
                            if (isIgnored) {
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
            console.log(`⚡ [${name}] Mail Server Connected! (${imapHost})`);

            await client.mailboxOpen('INBOX');
            console.log(`📥 [${name}] INBOX Opened! Scanning last 30 emails for backlog...`);

            client.on('close', () => {
                console.log(`⚠️ [${name}] Connection Dropped! Auto-reconnecting in 5 seconds...`);
                isFetching = false;
                setTimeout(() => startEmailListener(onNewEmail), 5000);
            });

            client.on('error', (err) => {
                console.error(`❌ [${name}] IMAP Client Error:`, err.message || err.code || err.name || String(err));
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
            const detail = error.message || error.code || error.name || error.response || String(error);
            console.error(`❌ [${name}] IMAP Connection Error:`, detail);
            isFetching = false;
            setTimeout(() => startEmailListener(onNewEmail), 10000);
        }
    }

    return { name, startEmailListener, sendReplyEmail };
}

module.exports = { createMailAccount };