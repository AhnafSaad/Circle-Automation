require('dotenv').config();

const { createMailAccount } = require('./src/email/mailAccount');
const {
    extractDataFromEmail,
    extractOrderPatterns,
    extractEmailsFromBody,
    extractCompanyName,
} = require('./src/utils/extractId');
const { verifyRadiusOnly, verifyTicketByField } = require('./src/api/checkUser');
const { summarizeIssueWithAI } = require('./src/ai/gemini');
const { generateTokenViaAPI } = require('./src/api/generateTokenAPI');
const { createTicketViaAPI } = require('./src/api/createTicketViaAPI');


const accountsConfig = [
    {
        name: 'Circle',
        mode: 'radius',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpSecure: true,
    },
    {
        name: 'WCL',
        mode: 'ticket',
        user: process.env.WCL_TEST_EMAIL_USER,
        pass: process.env.WCL_TEST_EMAIL_PASS,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpSecure: true,
    },
];

async function handleRadiusFlow(email, account) {
    const emailData = {
        subject: email.subject || "",
        bodyPreview: email.body || "",
        body: { content: email.body || "" },
        sender: { emailAddress: { address: email.sender || "" } }
    };

    const data = extractDataFromEmail(emailData);
    if (data.skip) {
        console.log(`⏭️ [${account.name}] Skipped: No valid ID/Phone found.`);
        return;
    }

    console.log(`✅ [${account.name}] Extracted ID/Phone: ${data.u}`);
    const { isVerified, exactUsername, clientId } = await verifyRadiusOnly(data.u);

    if (!isVerified) {
        console.log(`❌ [${account.name}] User not found in Radius.`);
        return;
    }

    console.log(`🎉 [${account.name}] Radius verified: ${exactUsername}, CID: ${clientId}`);
    const issueSummary = await summarizeIssueWithAI(data.b);
    const result = await generateTokenViaAPI(clientId, 'Radius', issueSummary);

    if (result !== "Failed") {
        const replyBody = `প্রিয় গ্রাহক,\n\nআমরা আপনার সমস্যাটি আইডেন্টিফাই করেছি। আপনার টোকেন নাম্বার: ${result}\n\nখুব শীঘ্রই আমাদের সাপোর্ট টিম আপনার সাথে যোগাযোগ করবে।\n\nধন্যবাদান্তে,\n\nCircle Network Support Team`;
        await account.sendReplyEmail(data.s, `Re: ${data.r}`, replyBody);
    } else {
        console.log(`❌ [${account.name}] Failed to generate token.`);
    }
}


async function handleTicketFlow(email, account) {
    const sender = email.sender || "";
    const body = email.body || "";
    const subject = email.subject || "";

    // ধাপ ১: Customer Verification
    // ক্রম: sender email → body-র email(গুলো) → body-র company name
    let verifiedCustomer = null;

    if (sender) {
        const { isVerified, customer } = await verifyTicketByField('email', sender);
        if (isVerified) verifiedCustomer = customer;
    }

    if (!verifiedCustomer) {
        const bodyEmails = extractEmailsFromBody(body, sender);
        for (const em of bodyEmails) {
            const { isVerified, customer } = await verifyTicketByField('email', em);
            if (isVerified) { verifiedCustomer = customer; break; }
        }
    }

    if (!verifiedCustomer) {
        const companyName = extractCompanyName(body);
        if (companyName) {
            const { isVerified, customer } = await verifyTicketByField('companyname', companyName);
            if (isVerified) verifiedCustomer = customer;
        }
    }

    if (!verifiedCustomer) {
        console.log(`❌ [${account.name}] Customer could not be verified (sender/body-email/company-name all failed). Skipped.`);
        return;
    }

    console.log(`🎉 [${account.name}] Verified customer: ${verifiedCustomer.name} (${verifiedCustomer.isp_name})`);

    const orders = verifiedCustomer.orders || [];

    // ধাপ ২: Order নির্ধারণ
    let confirmedPairs = []; // [{ software, orderId }]

    // (ক) Body-তে explicit "<Software> Order ID: X" প্যাটার্ন থাকলে
    const explicitPatterns = extractOrderPatterns(body);

    if (explicitPatterns.length > 0) {
        for (const p of explicitPatterns) {
            const match = orders.find(o =>
                String(o.order_id) === String(p.orderId) &&
                (o.software_name || '').toUpperCase() === p.software
            );
            if (match) {
                confirmedPairs.push({ software: p.software, orderId: p.orderId });
            } else {
                console.log(`⏭️ [${account.name}] Body mentions "${p.software} Order ID: ${p.orderId}" but it doesn't match the customer's order list, discarded.`);
            }
        }
    }

    // (খ) Fallback: explicit pattern কিছুই না থাকলে বা কোনোটাই match করেনি
    if (confirmedPairs.length === 0) {
        const activeOrders = orders.filter(o => (o.status || '').toLowerCase() === 'active');
        const activeItes = activeOrders.filter(o => (o.software_name || '').toUpperCase() === 'ITES');
        const activeWcl = activeOrders.filter(o => (o.software_name || '').toUpperCase() === 'WCL');

        if (activeItes.length > 0) {
            confirmedPairs = activeItes.map(o => ({ software: 'ITES', orderId: String(o.order_id) }));
        } else if (activeWcl.length > 0) {
            confirmedPairs = activeWcl.map(o => ({ software: 'WCL', orderId: String(o.order_id) }));
        }
    }

    if (confirmedPairs.length === 0) {
        console.log(`❌ [${account.name}] No valid/active order could be confirmed. Skipped.`);
        return;
    }

    // ধাপ ৩: প্রতিটা কনফার্ম হওয়া পেয়ারের জন্য টিকিট তৈরি (তবে রিপ্লাই একটাই মেইলে, সব TT ID লিস্ট করে)
    const issueSummary = await summarizeIssueWithAI(body);
    console.log(`📝 [${account.name}] AI Summary: ${issueSummary}`);

    const createdTickets = []; // [{ ticketId, software, orderId }]

    for (const pair of confirmedPairs) {
        const ticketId = await createTicketViaAPI(verifiedCustomer.name, pair.orderId, pair.software, issueSummary);

        if (ticketId !== "Failed") {
            createdTickets.push({ ticketId, software: pair.software, orderId: pair.orderId });
        } else {
            console.log(`❌ [${account.name}] Ticket creation failed for ${pair.software} Order ID: ${pair.orderId}.`);
        }
    }

    if (createdTickets.length === 0) {
        console.log(`❌ [${account.name}] No ticket was successfully created, reply not sent.`);
        return;
    }

    const ticketLines = createdTickets
        .map(t => `TT ID: #${t.ticketId} (${t.software} — Order ID: ${t.orderId})`)
        .join('\n');

    const replyBody = `Dear concern,\n\nAssalamu Alaikum, Greetings from Windstream Communication Limited!!\nWe have acknowledged your mail. We have already forwarded this issue to our concern department. Please allow some time. Your kind co-operation and patience are highly appreciated during this period.\n\nWe are creating the following ticket(s) for your issue(s). We will update you accordingly.\n${ticketLines}\n\nWe are available 24x7 to assist you, please feel free to contact us.\n\nBest Regards,\n\nWindstream Communication Limited`;

    await account.sendReplyEmail(sender, `Re: ${subject}`, replyBody);
}

// ==================================================================
// রাউটার
// ==================================================================
async function handleIncomingEmail(email, account) {
    console.log(`\n📩 [${account.name} | ${account.mode}] New Email! From: ${email.sender}`);

    try {
        if (account.mode === 'radius') {
            await handleRadiusFlow(email, account);
        } else if (account.mode === 'ticket') {
            await handleTicketFlow(email, account);
        } else {
            console.log(`❌ [${account.name}] Unknown mode: ${account.mode}`);
        }
    } catch (error) {
        console.error(`❌ [${account.name}] Unexpected error while processing email:`, error.message);
    }
}

async function startBot() {
    console.log("🤖 Support Bot started... Initializing Hybrid Push + Polling System.\n");

    for (const cfg of accountsConfig) {
        if (!cfg.user || !cfg.pass || !cfg.imapHost || !cfg.smtpHost) {
            console.log(`⏭️ Skipping "${cfg.name}" — incomplete config in .env, skipped.`);
            continue;
        }
        const account = createMailAccount(cfg);
        account.mode = cfg.mode; // routing-এর জন্য mode carry করা হলো
        account.startEmailListener((email) => handleIncomingEmail(email, account));
    }
}

startBot();