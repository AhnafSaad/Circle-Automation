require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dashboardStore = require('./dashboard/logStore');

// 📊 Dashboard hook
const _origLog = console.log;
const _origError = console.error;
function _stringifyArgs(args) {
    return args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
}
console.log = (...args) => { dashboardStore.log(_stringifyArgs(args)); _origLog(...args); };
console.error = (...args) => { dashboardStore.log(_stringifyArgs(args)); _origError(...args); };

// 🔥 আপনার আগের সব ইম্পোর্ট (IMAP বাদে)
const { createGraphMailAccount } = require('./src/email/graphMailAccount');
const { extractDataFromEmail, extractOrderPatterns, extractEmailsFromBody, extractCompanyName } = require('./src/utils/extractId');
const { verifyRadiusOnly, verifyTicketByField } = require('./src/api/checkUser');
const { summarizeIssueWithAI } = require('./src/ai/gemini');
const { generateTokenViaAPI } = require('./src/api/generateTokenAPI');
const { createTicketViaAPI } = require('./src/api/createTicketViaAPI');

// কনফিগারেশন - Circle এবং WCL উভয়ের জন্য
const accountsConfig = [
    {
        name: 'Circle',
        mode: 'radius',
        type: 'graph', 
        user: process.env.EMAIL_USER?.trim(),
        tenantId: process.env.AZURE_TENANT_ID?.trim(),
        clientId: process.env.AZURE_CLIENT_ID?.trim(),
        clientSecret: process.env.AZURE_CLIENT_SECRET?.trim(),
    },
    {
        name: 'WCL',
        mode: 'ticket',
        type: 'graph', 
        user: process.env.WCL_TEST_EMAIL_USER?.trim(),
        tenantId: process.env.WCL_AZURE_TENANT_ID?.trim(),
        clientId: process.env.WCL_AZURE_CLIENT_ID?.trim(),
        clientSecret: process.env.WCL_AZURE_CLIENT_SECRET?.trim(),
    }
];

// ইগনোর লিস্ট চেক
function isIgnored(emailAddress) {
    const ignoreListPath = path.join(__dirname, 'dashboard', 'ignore-list.json');
    if (!fs.existsSync(ignoreListPath)) return false;
    try {
        const list = JSON.parse(fs.readFileSync(ignoreListPath, 'utf8'));
        return list.includes(emailAddress.toLowerCase());
    } catch (e) { return false; }
}

// ⚠️ এখানে আপনার handleRadiusFlow ফাংশনের আসল কোড বসাবেন
async function handleRadiusFlow(email, account) {
    console.log(`[${account.name}] Processing Radius Flow...`);
    // আপনার আগের কোড...
}

// ⚠️ এখানে আপনার handleTicketFlow ফাংশনের আসল কোড বসাবেন
async function handleTicketFlow(email, account) {
    console.log(`[${account.name}] Processing Ticket Flow...`);
    // আপনার আগের কোড...
}

// ইনকামিং ইমেইল হ্যান্ডলার
async function handleIncomingEmail(email, account) {
    const senderEmail = (email.sender || "").toLowerCase();
    
    if (isIgnored(senderEmail)) {
        console.log(`🚫 [${account.name}] Skipped: ${senderEmail} is in the Ignore List.`);
        return;
    }

    console.log(`\n📩 [${account.name} | ${account.mode}] New Email! From: ${email.sender}`);
    
    try {
        if (account.mode === 'radius') {
            await handleRadiusFlow(email, account);
        } else if (account.mode === 'ticket') {
            await handleTicketFlow(email, account);
        }
    } catch (error) { 
        console.error(`❌ [${account.name}] Flow Error:`, error.message); 
    }
}

// বট স্টার্টার
async function startBot() {
    console.log("🤖 Support Bot started... Initializing Microsoft Graph REST System.\n");
    dashboardStore.heartbeat();
    setInterval(() => dashboardStore.heartbeat(), 5000);

    for (const cfg of accountsConfig) {
        if (!cfg.user) {
            console.log(`⏭️ Skipping "${cfg.name}" — Email not configured in .env.`);
            continue;
        }

        console.log(`🔑 [${cfg.name}] Initializing Microsoft Graph REST Connection...`);
        const account = createGraphMailAccount(cfg); 
        account.startEmailListener((email) => handleIncomingEmail(email, account));
    }
}

startBot();