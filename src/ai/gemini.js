const { GoogleGenerativeAI } = require('@google/generative-ai');

async function summarizeIssueWithAI(emailBody) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash"}); 
        
        const prompt = `Extract ONLY the core technical issue from the following customer email. 
        Rules:
        1. Maximum 40 characters long.
        2. 2 to 8 words only.
        3. NO full sentences. NO conversational fillers (e.g., "The customer...", "User issue is...").
        4. Just output the exact problem (e.g., "Router connection issue", "Slow internet").
        5. If no technical issue is mentioned, output exactly "Not specified".
        
        Customer Email:
        ${emailBody}`;;
        
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) { 
        console.error("AI Summarization Error:", e.message);
        return "not yet specified"; 
    }
}
module.exports = { summarizeIssueWithAI };


