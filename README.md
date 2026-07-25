# 🤖 AI-Powered Support Automation Bot

An intelligent, fully automated Node.js email support bot designed to streamline customer service operations. It reads incoming customer emails, intelligently extracts user IDs, verifies them against a Radius database, and uses AI to summarize the core issue before generating an automated support ticket.

## ✨ Key Features

* **Automated Email Processing:** Reads and processes incoming support emails using the Microsoft Graph API.
* **Smart ID Extraction & Caching:** Extracts user IDs (handling both English and Bengali keywords) and maps email addresses to verified IDs locally (`user-id-map.json`) for seamless future interactions.
* **Radius Authentication:** Automatically verifies customer IDs securely via Radius before processing tickets.
* **AI Issue Summarization:** Integrates with OpenAI (`gpt-4o-mini`) to read customer emails and generate concise summaries of their problems.
* **Auto-Reply & Ticketing:** Generates a unique support token via API and replies to the customer instantly with a branded email template.
* **24/7 Background Operation:** Designed to be deployed on an Ubuntu server via PM2 for uninterrupted service.

## 🛠️ Tech Stack

* **Runtime:** Node.js (v20)
* **AI Integration:** OpenAI API
* **Email API:** Microsoft Graph API
* **Process Manager:** PM2
