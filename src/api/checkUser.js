const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    const requestBody = { search_by: extractedId };

    // ১. Radius API চেক
    try {
        const res = await axios.post(process.env.RADIUS_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.RADIUS_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        
        if (res.status === 200 && res.data && res.data.data) {
            const actualUsername = res.data.data.username; 
            return { isVerified: true, clientType: 'Radius', exactUsername: actualUsername };
        } else {
            console.log(`⚠️ Radius API Status 200, but no 'data' object found for: ${extractedId}`);
        }
    } catch (e) {
        // এপিআই এর আসল এরর মেসেজ প্রিন্ট করা হবে
        console.log(`❌ Radius API Error: ${e.response ? JSON.stringify(e.response.data) : e.message}`);
    }

    // ২. Ticket API চেক
    try {
        const res = await axios.post(process.env.TICKET_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.TICKET_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        
        if (res.status === 200 && res.data && res.data.data) {
            const actualUsername = res.data.data.username;
            return { isVerified: true, clientType: 'Ticket', exactUsername: actualUsername };
        }
    } catch (e) {
        console.log(`❌ Ticket API Error: ${e.response ? JSON.stringify(e.response.data) : e.message}`);
    }

    return { isVerified: false, clientType: null, exactUsername: null };
}

module.exports = { verifyClientFromAPI };