function extractDataFromEmail(email) {
    const b = email.body?.content || email.bodyPreview || "";
    const r = email.subject || "";
    let s = email.sender?.emailAddress?.address || "";

    const senderLower = s.toLowerCase();
    if (!s || senderLower.includes('no-reply') || senderLower.includes('it-support')) {
        return { skip: true };
    }

    let u = b.match(/(?:cid|client[-_\s]*id)\s*[:=-]?\s*([a-zA-Z0-9_-]+)/i)?.[1] || 
            b.match(/(?:username|user)\s*[:=-]?\s*([a-zA-Z0-9_-]+)/i)?.[1] || 
            b.match(/(?:\+?88)?01[3-9]\d{8}/)?.[0];

    if (!u) {
        const w = b.split(/\s+/);
        for (const k of w) {
            const c = k.replace(/[,.]/g, '').trim();
            if (/^\d+$/.test(c) || (/^[a-zA-Z0-9]+$/.test(c) && /\d/.test(c))) { u = c; break; }
        }
    }
    return u && u.length >= 3 ? { skip: false, u, s, r, b } : { skip: true };
}
module.exports = { extractDataFromEmail };