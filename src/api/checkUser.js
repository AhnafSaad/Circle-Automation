const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    const requestBody = { search_by: extractedId };

    try {
        const res = await axios.post(process.env.NORMAL_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.NORMAL_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        if (res.status === 200) return { isVerified: true, clientType: 'Normal' };
    } catch (e) {}

    try {
        const res = await axios.post(process.env.CORP_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.CORP_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        if (res.status === 200) return { isVerified: true, clientType: 'Corporate' };
    } catch (e) {}

    return { isVerified: false, clientType: null };
}
module.exports = { verifyClientFromAPI };