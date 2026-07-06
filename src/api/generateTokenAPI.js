const axios = require('axios');

/**
 * @param {number|string} clientId 
 * @param {string} clientType 
 * @param {string} issueSummary 
 * @returns {Promise<string>} 
 */
async function generateTokenViaAPI(clientId, clientType, issueSummary) {
    try {
        if (!clientId) {
            console.log(`❌ clientId not found (clientType: ${clientType}) — cannot generate token.`);
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
            description: `${issueSummary} [Bot Generated]`
        };

        
        const res = await axios.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('🔎 [API] Raw response:', JSON.stringify(res.data));


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

            console.log('⚠️ API returned a successful response but no token ID was found. Check the extraction logic against the raw response above.');
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