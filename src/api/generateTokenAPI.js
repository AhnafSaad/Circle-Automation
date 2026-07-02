const axios = require('axios');

/**
 * Radius প্যানেলে টোকেন ক্রিয়েট করে সরাসরি API কল করে (No Puppeteer / No Scraping).
 *
 * Payload: { API_SECRET, clientId, description }
 *
 * @param {number|string} clientId - client-search API রেসপন্স থেকে পাওয়া numeric CID
 * @param {string} clientType - 'Radius' | 'Ticket'
 * @param {string} issueSummary - Gemini দিয়ে জেনারেট করা ইস্যু সামারি
 * @returns {Promise<string>} - সফল হলে টোকেন আইডি (যেমন "TKN-12345"), ব্যর্থ হলে "Failed"
 */
async function generateTokenViaAPI(clientId, clientType, issueSummary) {
    try {
        if (!clientId) {
            console.log(`❌ clientId পাওয়া যায়নি (clientType: ${clientType}) — টোকেন তৈরি করা সম্ভব নয়।`);
            return 'Failed';
        }

        const apiUrl = process.env.RADIUS_TOKEN_API_URL;
        const apiSecret = process.env.RADIUS_TOKEN_API_SECRET;

        if (!apiUrl || !apiSecret) {
            console.log('❌ Missing RADIUS_TOKEN_API_URL / RADIUS_TOKEN_API_SECRET in .env');
            return 'Failed';
        }

        console.log(`\n🌐 [API] Creating token for CID: ${clientId}`);

        const payload = {
            API_SECRET: apiSecret,
            clientId: clientId,
            description: `[Bot Generated] Issue: ${issueSummary}`
        };

        const res = await axios.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('🔎 [API] Raw response:', JSON.stringify(res.data));

        // ✅ HTTP status কোড strictly 200 না হলেও (201 ইত্যাদি) response body-তে success
        // থাকতে পারে, তাই body-র ভেতরের status/token existence দিয়ে যাচাই করা হচ্ছে
        const d = res.data?.data || res.data;
        const bodyIndicatesSuccess = res.data?.status === 'success' || res.data?.success === true;

        if (res.data && (bodyIndicatesSuccess || d?.token || d?.token_id || d?.tokenId)) {
            const rawToken =
                d?.token_id ??
                d?.tokenId ??
                d?.token ??
                d?.id ??
                res.data?.token_id ??
                res.data?.id;

            if (rawToken) {
                const match = String(rawToken).match(/(\d+)/);
                const finalToken = match ? `TKN-${match[1]}` : String(rawToken);
                console.log(`🎉 Successfully created token: ${finalToken}`);
                return finalToken;
            }

            console.log('⚠️ API সফল রেসপন্স দিয়েছে কিন্তু token ID খুঁজে পাওয়া যায়নি। উপরের Raw response দেখে extraction লজিক ঠিক করুন।');
            return 'Failed';
        }

        console.log('❌ Unexpected API response.');
        return 'Failed';

    } catch (error) {
        if (error.response) {
            console.error(`❌ [API Error] Status ${error.response.status}:`, JSON.stringify(error.response.data));
        } else {
            console.error(`❌ [API Error]: ${error.message}`);
        }
        return 'Failed';
    }
}

module.exports = { generateTokenViaAPI };
