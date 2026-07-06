const axios = require('axios');

/**
 * 🟦 Radius অ্যাকাউন্টের জন্য (Circle মেইল) — শুধু Radius API চেক করে, Ticket API-তে fallback করে না।
 *
 * @param {string} extractedId
 * @returns {Promise<{isVerified, clientType, exactUsername, clientId}>}
 */
async function verifyRadiusOnly(extractedId) {
    try {
        const radiusUrl = process.env.RADIUS_CHECK_API_URL;
        if (radiusUrl && radiusUrl.trim() !== '') {
            const requestBody = {
                search_by: extractedId,
                CLIENT_SEARCH_SECRET: process.env.RADIUS_CHECK_SECRET
            };

            const res = await axios.post(radiusUrl, requestBody, {
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });

            if (res.status === 200 && res.data && res.data.data) {
                const actualUsername = res.data.data.username;
                const clientId = res.data.data.id;
                return { isVerified: true, clientType: 'Radius', exactUsername: actualUsername, clientId: clientId };
            }
        }
    } catch (e) {
        const status = e.response ? e.response.status : 'Unknown';
        const msg = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`❌ Radius API Error (Status ${status}): ${msg}`);
    }

    return { isVerified: false, clientType: null, exactUsername: null, clientId: null };
}

/**
 * 🟩 Ticket অ্যাকাউন্টের জন্য (WCL মেইল) — একটা নির্দিষ্ট field/value দিয়ে Ticket API-তে verify করে
 * এবং সফল হলে পুরো customer object (orders[] সহ) রিটার্ন করে, যাতে software/order/status cross-check করা যায়।
 *
 * @param {string} field - 'email' | 'companyname' | 'name' | 'mobile'
 * @param {string} value
 * @returns {Promise<{isVerified: boolean, customer: object|null}>}
 */
async function verifyTicketByField(field, value) {
    try {
        const ticketUrl = process.env.TICKET_CHECK_API_URL;
        const ticketSecret = process.env.TICKET_API_SECRET;

        if (!ticketUrl || ticketUrl.trim() === '' || !value) {
            return { isVerified: false, customer: null };
        }

        const ticketBody = { value, field, API_SECRET: ticketSecret };

        console.log(`   ↳ [Ticket API] Trying field="${field}" value="${value}" ...`);

        const res = await axios.post(ticketUrl, ticketBody, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });

        console.log(`   ↳ Response [${field}]: success=${res.data?.success}, matches=${res.data?.data?.length || 0}`);

        if (res.status === 200 && res.data && res.data.success && res.data.data && res.data.data.length > 0) {
            const customer = res.data.data[0]; // { user_id, name, email, mobile, isp_name, orders: [...] }
            console.log(`   ↳ ✅ Ticket API Matched! Customer: ${customer.name} (${customer.isp_name})`);
            return { isVerified: true, customer };
        }

        return { isVerified: false, customer: null };
    } catch (e) {
        const status = e.response ? e.response.status : 'Unknown';
        const msg = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`   ↳ ❌ [Ticket API] field="${field}" Error (Status ${status}): ${msg}`);
        return { isVerified: false, customer: null };
    }
}

/**
 * ⚠️ পুরনো কম্বাইন্ড ফাংশন (Radius → Ticket fallback), backward-compatibility-এর জন্য রাখা হলো।
 * নতুন account-mode based flow-এ এটা আর ব্যবহার হচ্ছে না — verifyRadiusOnly (Circle) এবং
 * verifyTicketByField (WCL) আলাদাভাবে ব্যবহার হয়।
 */
async function verifyClientFromAPI(extractedId, senderEmail) {
    const radiusResult = await verifyRadiusOnly(extractedId);
    if (radiusResult.isVerified) return radiusResult;

    const mobileRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    let candidates = [];
    if (senderEmail && emailRegex.test(senderEmail)) {
        candidates.push({ field: "email", value: senderEmail });
    }
    if (mobileRegex.test(extractedId)) {
        candidates.push({ field: "mobile", value: extractedId });
    } else if (emailRegex.test(extractedId)) {
        if (!senderEmail || extractedId.toLowerCase() !== senderEmail.toLowerCase()) {
            candidates.push({ field: "email", value: extractedId });
        }
    } else {
        candidates.push({ field: "companyname", value: extractedId });
        candidates.push({ field: "name", value: extractedId });
    }

    for (const { field, value } of candidates) {
        const { isVerified, customer } = await verifyTicketByField(field, value);
        if (isVerified) {
            return { isVerified: true, clientType: 'Ticket', exactUsername: customer.name, clientId: null };
        }
    }

    return { isVerified: false, clientType: null, exactUsername: null, clientId: null };
}

module.exports = { verifyClientFromAPI, verifyRadiusOnly, verifyTicketByField };