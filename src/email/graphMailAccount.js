const axios = require('axios');
const { getAccessToken } = require('../api/getOutlookToken');

function createGraphMailAccount(config) {
    const { user, name, mode } = config;

    async function fetchUnreadEmails(callback) {
        const token = await getAccessToken(config); // 🔥 নির্দিষ্ট অ্যাকাউন্টের কনফিগ পাঠানো হচ্ছে
        if (!token) return;

        try {
            const response = await axios.get(
                `https://graph.microsoft.com/v1.0/users/${user}/mailFolders/inbox/messages?$filter=isRead eq false&$top=10`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const messages = response.data.value;
            for (const msg of messages) {
                const emailData = {
                    id: msg.id,
                    sender: msg.sender?.emailAddress?.address,
                    subject: msg.subject,
                    text: msg.body?.content || msg.bodyPreview,
                    date: msg.receivedDateTime
                };

                await markAsRead(msg.id, token);
                await callback(emailData);
            }
        } catch (error) {
            console.error(`❌ [${name}] Graph API Fetch Error:`, error.response?.data?.error?.message || error.message);
        }
    }

    async function markAsRead(messageId, token) {
        try {
            await axios.patch(
                `https://graph.microsoft.com/v1.0/users/${user}/messages/${messageId}`,
                { isRead: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error(`❌ [${name}] Failed to mark read:`, error.message);
        }
    }

    async function sendReplyEmail(to, subject, htmlBody) {
        const token = await getAccessToken(config); // 🔥 টোকেন ফেচ
        if (!token) return;

        try {
            await axios.post(
                `https://graph.microsoft.com/v1.0/users/${user}/sendMail`,
                {
                    message: {
                        subject: subject,
                        body: { contentType: "HTML", content: htmlBody },
                        toRecipients: [{ emailAddress: { address: to } }]
                    },
                    saveToSentItems: "true"
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`✅ [${name}] Reply sent to ${to} via Graph API`);
        } catch (error) {
            console.error(`❌ [${name}] Send Reply Error:`, error.response?.data?.error?.message || error.message);
        }
    }

    function startEmailListener(callback) {
        console.log(`📡 [${name}] Starting Graph API Polling for ${user}...`);
        setInterval(() => {
            fetchUnreadEmails(callback);
        }, 15000); 
    }

    return {
        startEmailListener,
        sendReplyEmail,
        mode
    };
}

module.exports = { createGraphMailAccount };