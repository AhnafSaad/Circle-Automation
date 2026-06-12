function extractDataFromEmail(email) {
    const b = email.body?.content || email.bodyPreview || "";
    const r = email.subject || "";
    let s = email.sender?.emailAddress?.address || "";

    const senderLower = s.toLowerCase();
    
    // অটোমেটেড এবং প্রমোশনাল সেন্ডারদের প্রথমেই বাদ দেওয়া হলো
    if (!s || senderLower.includes('no-reply') || senderLower.includes('it-support') || 
        senderLower.includes('binance') || senderLower.includes('mongodb') || senderLower.includes('dazn')) {
        return { skip: true };
    }

    // ১. ফোন নাম্বার চেক
    let u = b.match(/(?:\+?88)?01[3-9]\d{8}/)?.[0];

    // ২. ইউজার আইডি বা CID চেক (অবশ্যই কোলন, ড্যাশ বা স্পেস থাকতে হবে)
    if (!u) u = b.match(/(?:cid|client\s*id|username|user\s*id|user)\s*[:=-]\s*([a-zA-Z0-9_-]+)/i)?.[1];

    // ৩. ফলব্যাক: মেইলের বডিতে যদি শুধু আইডি লেখা থাকে
    if (!u) {
        const w = b.split(/\s+/);
        for (const k of w) {
            const c = k.replace(/[,.]/g, '').trim();
            // আইডি অবশ্যই ৪-১২ ক্যারেক্টারের হতে হবে এবং অন্তত একটি সংখ্যা থাকতে হবে
            if (/^[a-zA-Z0-9_-]{4,12}$/.test(c) && /\d/.test(c)) { 
                u = c; break; 
            }
        }
    }
    
    // টোকেন বা বিশাল লিংক বাদ দেওয়ার জন্য লেন্থ চেক
    return u && u.length >= 4 && u.length <= 15 ? { skip: false, u, s, r, b } : { skip: true };
}

module.exports = { extractDataFromEmail };