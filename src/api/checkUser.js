const axios = require('axios');

async function verifyClientFromAPI(extractedId) {
    // ১. Radius API চেক
    try {
        const radiusUrl = process.env.RADIUS_CHECK_API_URL;
        if (radiusUrl && radiusUrl.trim() !== '') {
            
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

    // ২. Ticket API চেক (Smart Loop Logic)
    try {
        const ticketUrl = process.env.TICKET_CHECK_API_URL;
        const ticketSecret = process.env.TICKET_API_SECRET; 
        
        if (ticketUrl && ticketUrl.trim() !== '') {
            
            let searchFields = []; 

            const mobileRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

            if (mobileRegex.test(extractedId)) {
                searchFields = ["mobile"];
            } else if (emailRegex.test(extractedId)) {
                searchFields = ["email"];
            } else {
                // 🚀 যদি মোবাইল বা ইমেইল না হয়, তবে প্রথমে companyname এরপর name (Owner Name) এ খুঁজবে
                searchFields = ["companyname", "name"];
            }

            let actualName = null;
            let isTicketVerified = false;

            // লুপ চালিয়ে ফিল্ড অনুযায়ী চেক করবে
            for (let field of searchFields) {
                const ticketBody = { 
                    value: extractedId, 
                    field: field, 
                    API_SECRET: ticketSecret 
                };

                const res = await axios.post(ticketUrl, ticketBody, {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                // যদি এই ফিল্ডে ডেটা পাওয়া যায়
                if (res.status === 200 && res.data && res.data.success && res.data.data && res.data.data.length > 0) {
                    // টিকিট এপিআইতে name মানে Owner Name
                    actualName = res.data.data[0].name;
                    isTicketVerified = true;
                    break; // ডেটা পেয়ে গেলে লুপ ব্রেক করে দিবে
                }
            }

            if (isTicketVerified) {
                return { isVerified: true, clientType: 'Ticket', exactUsername: actualName };
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