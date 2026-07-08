const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const ignoreKeywords = [
    'linkedin', 'instagram', 'facebook', 'twitter', 'x.com', 'youtube', 'pinterest',
    'postman', 'realmadrid', 'github', 'gitlab', 'vercel', 'heroku', 'render', 'mongodb',
    'dazn', 'binance', 'shopify', 'coursera', 'n8n', 'promotions', 'marketing',
    'newsletter', 'no-reply', 'noreply', 'alerts',
    // ✅ নতুন যোগ করা হলো — এটাই আসল কারণ ছিল ভুল রিপ্লাই যাওয়ার
    'fontawesome.com', 'mailchimp', 'sendgrid', 'campaign-archive', 'substack',
    // ⚠️ 'support@', 'info@', 'team@' এখান থেকে সরিয়ে দেওয়া হয়েছে —
    // অনেক আসল ক্লায়েন্ট/ISP নিজেদের support desk থেকেই মেইল পাঠায়
    // (যেমন: support@globalonlinebd.com), সেগুলোকে ভুলভাবে ইগনোর করে ফেলছিল।

    // ✅ এগুলো আমাদের নিজস্ব সিস্টেমের ঠিকানা (ticket/billing notification, NOC log copy) —
    // নির্দিষ্ট ঠিকানা হওয়ায় অন্য কোনো real client মেইলকে প্রভাবিত করবে না।
    'ticket@windstreamcommunication.net',
    'ticket@yetfix.net',
    'ticket1@circlenetworkbd.com',
    'ites_billing@yetfix.net',
];

/**
 * Creates an independent email account handler (IMAP listener + SMTP sender).
 * Works for any provider that supports standard IMAP/SMTP (Gmail, cPanel, Zoho, Titan, etc).
 * NOTE: This does NOT support Microsoft 365 / Exchange Online accounts that have
 * Basic Authentication disabled — those require OAuth2 / Microsoft Graph API instead.
 *
 * @param {Object} config
 * @param {string} config.name          - Friendly label for logs, e.g. "Gmail" / "Business"
 * @param {string} config.user          - Mailbox login (email address)
 * @param {string} config.pass          - Mailbox password / app password
 * @param {string} config.imapHost
 * @param {number} [config.imapPort=993]
 * @param {string} config.smtpHost
 * @param {number} [config.smtpPort=465]
 * @param {boolean} [config.smtpSecure=true]
 */
function createMailAccount(config) {
    const {
        name = 'Account',
        user,
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
        secure: smtpSecure, // true for 465, false for 587 (STARTTLS)
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

                    for (let uid of uids) {
                        let emailData = await client.fetchOne(uid, { source: true }, { uid: true });

                        if (emailData && emailData.source) {
                            let parsed = await simpleParser(emailData.source);
                            let senderAddress = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address.toLowerCase() : "";
                            let subject = parsed.subject || "(No Subject)";

                            let isIgnored = ignoreKeywords.some(keyword => senderAddress.includes(keyword));

                            let subjTrimmed = subject.toLowerCase().trim();
                            let isReply = !!parsed.inReplyTo || !!parsed.references || subjTrimmed.startsWith('re:') || subjTrimmed.startsWith('fwd:') || subjTrimmed.startsWith('fw:');

                            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

                            if (isIgnored) {
                                console.log(`⏭️ [${name}] Ignored promotional email from: ${senderAddress}`);
                            } else if (isReply) {
                                console.log(`⏭️ [${name}] Ignored customer REPLY to avoid duplicate token: ${senderAddress}`);
                            } else {
                                emailQueue.push({
                                    uid,
                                    subject,
                                    sender: senderAddress || "Unknown Sender",
                                    body: parsed.text || "",
                                    account: name, // 💡 কোন অ্যাকাউন্ট থেকে মেইলটা এসেছে তা ট্র্যাক করার জন্য
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