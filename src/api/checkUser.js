const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    const requestBody = { search_by: extractedId };

    // ১. Radius API চেক
    try {
        const res = await axios.post(process.env.RADIUS_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.RADIUS_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        
        // আপনার API রেসপন্স অনুযায়ী res.data.data.username ব্যবহার করা হলো
        if (res.status === 200 && res.data && res.data.data) {
            const actualUsername = res.data.data.username; 
            return { isVerified: true, clientType: 'Radius', exactUsername: actualUsername };
        }
    } catch (e) {
        // API Error ইগনোর করে পরেরটায় যাবে
    }

    // ২. Ticket API চেক (যদি এটার রেসপন্সও সেম হয়, তবে এরকমই থাকবে)
    try {
        const res = await axios.post(process.env.TICKET_CHECK_API_URL, requestBody, {
            headers: { 'CLIENT_SEARCH_SECRET': process.env.TICKET_CHECK_SECRET, 'Content-Type': 'application/json' }
        });
        
        if (res.status === 200 && res.data && res.data.data) {
            const actualUsername = res.data.data.username;
            return { isVerified: true, clientType: 'Ticket', exactUsername: actualUsername };
        }
    } catch (e) {}

    return { isVerified: false, clientType: null, exactUsername: null };
}

module.exports = { verifyClientFromAPI };