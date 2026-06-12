const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    const requestBody = { search_by: extractedId };

    // ১. Radius API চেক
    try {
        const radiusUrl = process.env.RADIUS_CHECK_API_URL;
        if (radiusUrl && radiusUrl.trim() !== '') {
            const res = await axios.post(radiusUrl, requestBody, {
                headers: { 
                    // 💡 ম্যাজিক এখানেই! CLIENT_SEARCH_SECRET এর বদলে Authorization: Bearer দেওয়া হয়েছে
                    'Authorization': `Bearer ${process.env.RADIUS_CHECK_SECRET}`, 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (res.status === 200 && res.data && res.data.data) {
                const actualUsername = res.data.data.username; 
                return { isVerified: true, clientType: 'Radius', exactUsername: actualUsername };
            }
        }
    } catch (e) {
        const status = e.response ? e.response.status : 'Unknown';
        const msg = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`❌ Radius API Error (Status ${status}): ${msg}`);
    }

    // ২. Ticket API চেক (লিংক না থাকলে স্কিপ করবে)
    try {
        const ticketUrl = process.env.TICKET_CHECK_API_URL;
        
        if (ticketUrl && ticketUrl.trim() !== '') {
            const res = await axios.post(ticketUrl, requestBody, {
                headers: { 
                    // টিকিটের জন্যও একই হেডার ফরম্যাট দেওয়া হলো
                    'Authorization': `Bearer ${process.env.TICKET_CHECK_SECRET}`, 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (res.status === 200 && res.data && res.data.data) {
                const actualUsername = res.data.data.username;
                return { isVerified: true, clientType: 'Ticket', exactUsername: actualUsername };
            }
        } else {
            console.log(`⏭️ Skipped Ticket API (No URL provided in .env)`);
        }
    } catch (e) {
        console.log(`❌ Ticket API Error: ${e.message}`);
    }

    return { isVerified: false, clientType: null, exactUsername: null };
}

module.exports = { verifyClientFromAPI };