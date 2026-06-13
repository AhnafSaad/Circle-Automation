const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    // ১. Radius API চেক
    try {
        const radiusUrl = process.env.RADIUS_CHECK_API_URL;
        if (radiusUrl && radiusUrl.trim() !== '') {
            
            // 💡 Header এর বদলে Body-তে সিক্রেট কি পাঠানো হচ্ছে
            const requestBody = { 
                search_by: extractedId,
                CLIENT_SEARCH_SECRET: process.env.RADIUS_CHECK_SECRET 
            };

            const res = await axios.post(radiusUrl, requestBody, {
                headers: { 
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

    // ২. Ticket API চেক
    try {
        const ticketUrl = process.env.TICKET_CHECK_API_URL;
        
        if (ticketUrl && ticketUrl.trim() !== '') {
            const ticketBody = { 
                search_by: extractedId,
                CLIENT_SEARCH_SECRET: process.env.TICKET_CHECK_SECRET 
            };

            const res = await axios.post(ticketUrl, ticketBody, {
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (res.status === 200 && res.data && res.data.data) {
                const actualUsername = res.data.data.username;
                return { isVerified: true, clientType: 'Ticket', exactUsername: actualUsername };
            }
        } else {
            console.log(`⏭️ Skipped Ticket API (No URL provided)`);
        }
    } catch (e) {
        console.log(`❌ Ticket API Error: ${e.message}`);
    }

    return { isVerified: false, clientType: null, exactUsername: null };
}

module.exports = { verifyClientFromAPI };