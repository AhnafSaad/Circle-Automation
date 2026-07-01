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

    // ৪. 🚀 কোম্পানির নাম বা ব্যক্তির নাম এক্সট্রাক্ট করা
    // ⚠️ ফিক্স: lazy quantifier (+?) ব্যবহার করা হয়েছে, যাতে প্রথম terminator
    // (., কমা, নিউলাইন ইত্যাদি) পেলেই থেমে যায়, পুরো পরের বাক্য গিলে না ফেলে
    if (!u) {
        const nameMatch = b.match(/(?:company(?: name)?|organization|isp(?: name)?|name(?: is)?)\s*[:=-]?\s*([a-zA-Z0-9\s&-]+?)(?:\n|\r|$|<|,|\.|!|\?)/i);
        if (nameMatch && nameMatch[1]) {
            let extracted = nameMatch[1].trim();
            extracted = extracted.replace(/^(is\s+|the\s+)/i, '').trim(); 
            if (extracted.length >= 3 && extracted.length <= 40) {
                u = extracted;
            }
        }
    }

    // ৫. ফলব্যাক: শুধু আইডি (সংখ্যাসহ)
    if (!u) {
        const w = b.split(/\s+/);
        for (const k of w) {
            const c = k.replace(/[,.]/g, '').trim();
            if (/^[a-zA-Z0-9_-]{4,12}$/.test(c) && /\d/.test(c)) { 
                u = c; break; 
            }
        }
    }

    // ৬. মাস্টার ফলব্যাক: বডিতে কিছু না পেলে সেন্ডারের ইমেইল নিবে
    if (!u && s) {
        u = s; 
    }
    
    // টোকেন বা বিশাল লিংক বাদ দেওয়ার জন্য লেন্থ চেক (লিমিট 60 করা হয়েছে)
    return u && u.length >= 3 && u.length <= 60 ? { skip: false, u, s, r, b } : { skip: true };
}

module.exports = { extractDataFromEmail };