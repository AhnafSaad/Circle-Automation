const axios = require('axios');

/**
 * Creates a new ticket via the API
 *
 * @param {string} ownerName - Ticket-search API থেকে পাওয়া owner name
 * @param {string} orderId - নির্ধারিত/কনফার্ম করা order_id
 * @param {string} softwareName - 'WCL' | 'ITES'
 * @param {string} issueSummary - Gemini দিয়ে জেনারেট করা ইস্যু সামারি
 * @returns {Promise<string>} - সফল হলে ticket ID, ব্যর্থ হলে "Failed"
 */
async function createTicketViaAPI(ownerName, orderId, softwareName, issueSummary) {
    try {
        const apiUrl = process.env.TICKET_CREATE_API_URL;
        const apiSecret = process.env.TICKET_API_SECRET;

        if (!apiUrl || !apiSecret) {
            console.log('⚠️ TICKET_CREATE_API_URL সেট করা নেই — ticket creation এখনো implement করা হয়নি।');
            return 'Failed';
        }

        console.log(`\n🎫 [API] Creating ticket for: ${ownerName} | software=${softwareName} order_id=${orderId}`);

        // ⚠️ TODO: actual field name কনফার্ম হওয়া পর্যন্ত এটা অনুমান
        const payload = {
            API_SECRET: apiSecret,
            name: ownerName,
            order_id: orderId,
            software_name: softwareName,
            description: `[Bot Generated] Issue: ${issueSummary}`
        };

        const res = await axios.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('🔎 [API] Raw response:', JSON.stringify(res.data));

        const d = res.data?.data || res.data;
        const rawTicketId = d?.ticket_id ?? d?.id ?? d?.ticketId;

        if (rawTicketId) {
            console.log(`🎉 Successfully created ticket: ${rawTicketId}`);
            return String(rawTicketId);
        }

        console.log('⚠️ Ticket ID খুঁজে পাওয়া যায়নি response-এ।');
        return 'Failed';

    } catch (error) {
        if (error.response) {
            console.error(`❌ [Ticket API Error] Status ${error.response.status}:`, JSON.stringify(error.response.data));
        } else {
            console.error(`❌ [Ticket API Error]: ${error.message}`);
        }
        return 'Failed';
    }
}

module.exports = { createTicketViaAPI };