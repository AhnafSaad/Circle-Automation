const fs = require('fs');
const path = require('path');

// এখন logStore.js নিজেই dashboard/ ফোল্ডারে আছে, তাই dashboard-data.json-ও এখানেই থাকবে
const DATA_FILE = path.join(__dirname, 'dashboard-data.json');

const state = {
    startedAt: Date.now(),
    stats: { scanned: 0, tokens: 0, tickets: 0, errors: 0 },
    health: { imap: false, radius: false, ticket: false },
    logs: [], // { ts, type, msg }
};

let writeScheduled = false;
function persist() {
    // ঘন ঘন disk write এড়াতে সামান্য ব্যাচ করা হলো
    if (writeScheduled) return;
    writeScheduled = true;
    setTimeout(() => {
        writeScheduled = false;
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(state));
        } catch (e) {
            // dashboard ফাইল লিখতে ব্যর্থ হলেও bot চলতে থাকবে, চুপচাপ ignore
        }
    }, 200);
}

// 🔎 কোনো লগ লাইনের টেক্সট দেখে টাইপ (ok/err/warn/sys/info) এবং কোন স্ট্যাট বাড়বে তা অনুমান করা হয়
function classify(msg) {
    if (/❌/.test(msg)) return 'err';
    if (/⚠️/.test(msg)) return 'warn';
    if (/✅|🎉|⚡|🌐 \[API\] Creating/.test(msg)) return 'ok';
    if (/🤖|📥|🔎/.test(msg)) return 'sys';
    return 'info';
}

// 🎯 শুধু এই নির্দিষ্ট per-email skip/fail মেসেজগুলোকেই "Errors/Skipped" কাউন্টার বাড়াতে দেওয়া হবে।
// IMAP connection/reconnect noise (❌ IMAP Search Error, ❌ IMAP Connection Error ইত্যাদি) ইচ্ছাকৃতভাবে
// বাদ — কারণ সেগুলো একই এরর অনেকবার রিপিট হয়ে কাউন্টারকে কৃত্রিমভাবে ফুলিয়ে তুলছিল, প্রতিটা আসল
// ইমেইলের জন্য একবারও স্কিপ হয়নি এমনও হতে পারে।
const PER_EMAIL_ERROR_PATTERNS = [
    /Skipped: No valid ID\/Phone found/,
    /User not found in Radius/,
    /Failed to generate token/,
    /Customer could not be verified/,
    /No valid\/active order could be confirmed/,
    /Ticket creation failed/,
    /No ticket was successfully created/,
    /Ignored promotional email/,
    /Body mentions .* but it doesn't match/,
];

function updateStatsFromMessage(msg) {
    if (/New Email!/.test(msg)) state.stats.scanned++;
    else if (/Successfully created token/.test(msg)) state.stats.tokens++;
    else if (/Successfully created ticket/.test(msg)) state.stats.tickets++;
    else if (PER_EMAIL_ERROR_PATTERNS.some(re => re.test(msg))) state.stats.errors++;

    if (/Mail Server Connected/.test(msg)) state.health.imap = true;
    if (/Connection Dropped|IMAP Connection Error/.test(msg)) state.health.imap = false;
    if (/Radius API Error/.test(msg)) state.health.radius = false;
    if (/Radius verified|Radius Matched/.test(msg)) state.health.radius = true;
    if (/\[Ticket API\].*Error/.test(msg)) state.health.ticket = false;
    if (/Ticket API Matched/.test(msg)) state.health.ticket = true;
}

function log(msg) {
    const type = classify(msg);
    updateStatsFromMessage(msg);
    state.logs.push({ ts: Date.now(), type, msg });
    if (state.logs.length > 100) state.logs.shift(); // ১০০টার বেশি হলে সবচেয়ে পুরনোটা অটো রিমুভ
    persist();
}

function heartbeat() {
    state.lastHeartbeat = Date.now();
    persist();
}

module.exports = { log, heartbeat, getState: () => state };