require('dotenv').config();
const msal = require('@azure/msal-node');

// একাধিক অ্যাকাউন্টের টোকেন আলাদাভাবে ক্যাশ করে রাখার জন্য
const tokenCache = {}; 

async function getAccessToken(config) {
    const { name, tenantId, clientId, clientSecret } = config;

    if (!tenantId || !clientId || !clientSecret) {
        console.error(`❌ [${name}] OAuth Error: Missing Azure credentials in .env`);
        return null;
    }

    // টোকেন আগে থেকেই থাকলে এবং মেয়াদ থাকলে ক্যাশ থেকে রিটার্ন করবে
    if (tokenCache[name] && tokenCache[name].tokenExpiry > Date.now()) {
        return tokenCache[name].token;
    }

    const msalConfig = {
        auth: {
            clientId: clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            clientSecret: clientSecret,
        }
    };

    const cca = new msal.ConfidentialClientApplication(msalConfig);
    
    try {
        const response = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"], 
        });
        
        // সফল হলে ওই অ্যাকাউন্টের নামে টোকেন ক্যাশ করে রাখা
        tokenCache[name] = {
            token: response.accessToken,
            tokenExpiry: Date.now() + (3500 * 1000) 
        };
        return response.accessToken;
    } catch (error) {
        console.error(`\n❌ [${name}] AZURE AUTH FAILED Reason:`, error.message.split(' - ')[0]);
        return null;
    }
}

module.exports = { getAccessToken };