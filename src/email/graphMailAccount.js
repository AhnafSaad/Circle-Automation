const axios = require('axios');
const { getAccessToken } = require('../api/getOutlookToken');

function createGraphMailAccount(config) {
    const { user, name, mode } = config;

    async function fetchUnreadEmails(callback) {
        const token = await getAccessToken(config);
        if (!token) return;

        try {
            // 🔥 মাইক্রোসফটের সার্ভার গ্লিচ এড়াতে $filter ছাড়াই টপ ১০টি মেইল আনছি
            const response = await axios.get(
                `https://graph.microsoft.com/v1.0/users/${user}/mailFolders/inbox/messages?$top=10`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 🔥 সার্ভারের বদলে আমরা নিজেরা কোড দিয়ে আনরিড (Unread) মেইলগুলো ফিল্টার করছি
            const unreadMessages = response.data.value.filter(msg => msg.isRead === false);

            for (const msg of unreadMessages) {
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
            const errorDetails = error.response?.data?.error?.message || error.message || "Network/Server issue";
            console.error(`❌ [${name}] Graph API Fetch Error:`, errorDetails);
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
        const token = await getAccessToken(config);
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
        }, 30000); 
    }

    return {
        name,
        startEmailListener,
        sendReplyEmail,
        mode
    };
}

module.exports = { createGraphMailAccount };