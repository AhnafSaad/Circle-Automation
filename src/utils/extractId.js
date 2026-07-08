function extractDataFromEmail(email) {
    const b = email.body?.content || email.bodyPreview || "";
    const r = email.subject || "";
    let s = email.sender?.emailAddress?.address || "";

    const senderLower = s.toLowerCase();
    
    // অটোমেটেড এবং প্রমোশনাল সেন্ডারদের বাদ দেওয়া হলো
    if (!s || senderLower.includes('no-reply') || senderLower.includes('it-support') || 
        senderLower.includes('binance') || senderLower.includes('mongodb') || senderLower.includes('dazn')) {
        return { skip: true };
    }

    let u = null;

    // ১. ফোন নাম্বার চেক
    u = b.match(/(?:\+?88)?01[3-9]\d{8}/)?.[0];

    // ২. ইউজার আইডি বা CID চেক
    if (!u) {
        const matchObj = b.match(/(?:cid|client\s*id|username|user\s*id|user)\s*[:=-]\s*([a-zA-Z0-9_-]+)/i);
        if (matchObj) u = matchObj[1].trim();
    }

    // ৩. 🚀 ইমেইল অ্যাড্রেস চেক (বডিতে valid TLD সহ থাকলে সেটাই নিবে)
    if (!u) {
        const emailMatch = b.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) u = emailMatch[0];
    }

    // ৪. 🚀 কোম্পানির নাম এক্সট্র্যাক্ট করা (শুধু company/organization/isp name — জেনেরিক "name" বাদ,
    // কারণ প্রমোশনাল মেইলে "Package Name: Free 718" টাইপ লাইনকে ভুলভাবে ধরে ফেলছিল)
    // ⚠️ ফিক্স: lazy quantifier (+?) ব্যবহার করা হয়েছে, যাতে প্রথম terminator
    // (., কমা, নিউলাইন ইত্যাদি) পেলেই থেমে যায়, পুরো পরের বাক্য গিলে না ফেলে
    if (!u) {
        const nameMatch = b.match(/(?:company(?: name)?|organization|isp(?: name)?)\s*[:=-]?\s*([a-zA-Z0-9\s&-]+?)(?:\n|\r|$|<|,|\.|!|\?)/i);
        if (nameMatch && nameMatch[1]) {
            let extracted = nameMatch[1].trim();
            extracted = extracted.replace(/^(is\s+|the\s+)/i, '').trim(); 
            if (extracted.length >= 3 && extracted.length <= 40) {
                u = extracted;
            }
        }
    }

    // ৫. ফলব্যাক: শুধু আইডি (সংখ্যাসহ) — শুধু তখনই গ্রহণ করা হবে যদি
    // সেই শব্দটা যে লাইনে আছে সেখানে context keyword (id/account/mobile/cid/client/username/order/phone) থাকে।
    // ⚠️ আগে একটা junk-word blocklist ছিল (free/offer/discount...), কিন্তু সেটা বাদ দেওয়া হলো —
    // কারণ real username-এও "free718" টাইপ শব্দ থাকতে পারে (যেমন client-এর ইউজারনেম), আর
    // context-keyword চেকটাই যথেষ্ট নিরাপদ (কনটেক্সট ছাড়া কোনো সংখ্যা এমনিতেই ধরা পড়বে না)।
    if (!u) {
        const contextKeywords = /\b(id|account|mobile|cid|client|username|order|phone|no)\b/i;
        const lines = b.split(/[\r\n]+/);
        for (const line of lines) {
            if (!contextKeywords.test(line)) continue; // এই লাইনে কোনো context keyword না থাকলে স্কিপ
            const tokens = line.split(/\s+/);
            for (const k of tokens) {
                const c = k.replace(/[,.:]/g, '').trim();
                if (/^[a-zA-Z0-9_-]{4,12}$/.test(c) && /\d/.test(c)) {
                    const alphaPart = c.replace(/[\d_-]/g, '').toLowerCase();
                    if (contextKeywords.test(alphaPart)) continue; // "id"/"cid" শব্দটা নিজেই যেন ধরা না পড়ে
                    u = c;
                    break;
                }
            }
            if (u) break;
        }
    }

    // ৬. মাস্টার ফলব্যাক: বডিতে কিছু না পেলে সেন্ডারের ইমেইল নিবে
    if (!u && s) {
        u = s; 
    }
    
    // টোকেন বা বিশাল লিংক বাদ দেওয়ার জন্য লেন্থ চেক (লিমিট 60 করা হয়েছে)
    return u && u.length >= 3 && u.length <= 60 ? { skip: false, u, s, r, b } : { skip: true };
}

/**
 * 🎫 Ticket Flow-এর জন্য: বডিতে explicit "<Software> Order ID: <num>" প্যাটার্ন খোঁজে।
 * যেমন: "WCL Order ID: 1006", "ITES Order ID: 3954", "WCL Order ID #5165"
 * শুধু "Order ID: 123" (software ছাড়া) এখানে ধরা হবে না — সেটা fallback logic-এ যাবে।
 *
 * @param {string} body
 * @returns {Array<{software: string, orderId: string}>} — ডুপ্লিকেট বাদে
 */
function extractOrderPatterns(body) {
    if (!body) return [];
    const regex = /\b(WCL|ITES)\b\s*Order\s*ID\s*:?\s*#?\s*(\d+)/gi;
    const seen = new Set();
    const results = [];
    let match;
    while ((match = regex.exec(body)) !== null) {
        const software = match[1].toUpperCase();
        const orderId = match[2];
        const key = `${software}-${orderId}`;
        if (!seen.has(key)) {
            seen.add(key);
            results.push({ software, orderId });
        }
    }
    return results;
}

/**
 * 🎫 Ticket Flow verification-এর জন্য: বডিতে উল্লেখিত সব ইমেইল অ্যাড্রেস বের করে
 * (sender-এর নিজস্ব ইমেইল বাদ দিয়ে, ডুপ্লিকেট বাদে, বডিতে যে ক্রমে পাওয়া যায় সেই ক্রমে)
 *
 * @param {string} body
 * @param {string} excludeEmail - সাধারণত sender-এর ইমেইল
 * @returns {string[]}
 */
function extractEmailsFromBody(body, excludeEmail = "") {
    if (!body) return [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const excludeLower = (excludeEmail || "").toLowerCase();
    const seen = new Set();
    const results = [];
    let match;
    while ((match = emailRegex.exec(body)) !== null) {
        const email = match[0];
        const emailLower = email.toLowerCase();
        if (emailLower !== excludeLower && !seen.has(emailLower)) {
            seen.add(emailLower);
            results.push(email);
        }
    }
    return results;
}

/**
 * 🎫 Ticket Flow verification-এর শেষ fallback candidate হিসেবে:
 * বডি থেকে company/organization/isp নাম বের করার চেষ্টা করে।
 *
 * @param {string} body
 * @returns {string|null}
 */
function extractCompanyName(body) {
    if (!body) return null;
    const nameMatch = body.match(/(?:company(?: name)?|organization|isp(?: name)?)\s*[:=-]?\s*([a-zA-Z0-9\s&-]+?)(?:\n|\r|$|<|,|\.|!|\?)/i);
    if (nameMatch && nameMatch[1]) {
        let extracted = nameMatch[1].trim().replace(/^(is\s+|the\s+)/i, '').trim();
        if (extracted.length >= 3 && extracted.length <= 40) {
            return extracted;
        }
    }
    return null;
}

module.exports = {
    extractDataFromEmail,
    extractOrderPatterns,
    extractEmailsFromBody,
    extractCompanyName,
};