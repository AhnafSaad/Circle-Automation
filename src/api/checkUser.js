const axios = require('axios');

async function verifyClientFromAPI(extractedId, senderEmail) {
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
                const clientId = res.data.data.id; // ✅ CID — token create API-তে এটাই পাঠানো হবে
                return { isVerified: true, clientType: 'Radius', exactUsername: actualUsername, clientId: clientId };
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
            
            const mobileRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

            // 🎯 প্রধান টার্গেট: sender-এর email দিয়ে সবার আগে ভেরিফাই করা হবে
            // তারপর extractedId এর format অনুযায়ী বাকি ফিল্ডগুলো (fallback)
            let candidates = [];

            if (senderEmail && emailRegex.test(senderEmail)) {
                candidates.push({ field: "email", value: senderEmail });
            }

            if (mobileRegex.test(extractedId)) {
                candidates.push({ field: "mobile", value: extractedId });
            } else if (emailRegex.test(extractedId)) {
                // sender email এর সাথে একই হলে ডুপ্লিকেট কল এড়ানো হবে
                if (!senderEmail || extractedId.toLowerCase() !== senderEmail.toLowerCase()) {
                    candidates.push({ field: "email", value: extractedId });
                }
            } else {
                // 🚀 যদি মোবাইল বা ইমেইল না হয়, তবে প্রথমে companyname এরপর name (Owner Name) এ খুঁজবে
                candidates.push({ field: "companyname", value: extractedId });
                candidates.push({ field: "name", value: extractedId });
            }

            let actualName = null;
            let isTicketVerified = false;

            console.log(`🎫 [Ticket API] Candidates to try: ${candidates.map(c => `${c.field}="${c.value}"`).join(', ')}`);

            // লুপ চালিয়ে প্রতিটি candidate অনুযায়ী চেক করবে (sender email সবসময় প্রথমে)
            for (let { field, value } of candidates) {
                const ticketBody = { 
                    value: value, 
                    field: field, 
                    API_SECRET: ticketSecret 
                };

                // ⚠️ ফিক্স: প্রতিটা ফিল্ডের জন্য আলাদা try/catch, যাতে একটা ফিল্ড
                // fail করলেও (যেমন 4xx/5xx) বাকি ফিল্ডগুলো চেক হওয়া বন্ধ না হয়ে যায়
                try {
                    console.log(`   ↳ Trying field="${field}" value="${value}" ...`);
                    const res = await axios.post(ticketUrl, ticketBody, {
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    });

                    console.log(`   ↳ Response [${field}]: success=${res.data?.success}, matches=${res.data?.data?.length || 0}`);

                    // যদি এই ফিল্ডে ডেটা পাওয়া যায়
                    if (res.status === 200 && res.data && res.data.success && res.data.data && res.data.data.length > 0) {
                        // টিকিট এপিআইতে name মানে Owner Name
                        actualName = res.data.data[0].name;
                        isTicketVerified = true;
                        break; // ডেটা পেয়ে গেলে লুপ ব্রেক করে দিবে
                    }
                } catch (fieldError) {
                    const status = fieldError.response ? fieldError.response.status : 'Unknown';
                    const msg = fieldError.response ? JSON.stringify(fieldError.response.data) : fieldError.message;
                    console.log(`   ↳ ❌ Field "${field}" Error (Status ${status}): ${msg}`);
                    // এই ফিল্ড fail করলেও পরের ফিল্ডে (name) যাবে, লুপ থামবে না
                }
            }

            if (isTicketVerified) {
                console.log(`   ↳ ✅ Ticket API Matched! Owner: ${actualName}`);
                return { isVerified: true, clientType: 'Ticket', exactUsername: actualName, clientId: null }; // ⚠️ Ticket API-তে numeric CID নেই
            } else {
                console.log(`   ↳ ❌ Ticket API: No match found in any field.`);
            }

        } else {
            console.log(`⏭️ Skipped Ticket API (No URL provided)`);
        }
    } catch (e) {
        console.log(`❌ Ticket API Error: ${e.message}`);
    }

    return { isVerified: false, clientType: null, exactUsername: null, clientId: null };
}

module.exports = { verifyClientFromAPI };