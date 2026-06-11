const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    const requestBody = { search_by: extractedId };

    // ১. Radius API চেক
    try {
        const res = await axios.post(process.env.RADIUS_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.RADIUS_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        if (res.status === 200) return { isVerified: true, clientType: 'Radius' };
    } catch (e) {}

    // ২. Ticket API চেক
    try {
        const res = await axios.post(process.env.TICKET_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.TICKET_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        if (res.status === 200) return { isVerified: true, clientType: 'Ticket' };
    } catch (e) {}

    return { isVerified: false, clientType: null };
}

module.exports = { verifyClientFromAPI };
