const { GoogleGenerativeAI } = require('@google/generative-ai');

async function summarizeIssueWithAI(emailBody) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        
        const prompt = `You are a professional customer support assistant. Summarize the customer issue in a clear, professional manner. Keep it concise (2-3 sentences) and focus on the key problem reported. If no technical issue is specified, state 'not yet specified'.\n\nCustomer Email:\n${emailBody}`;
        
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) { 
        console.error("AI Summarization Error:", e.message);
        return "not yet specified"; 
    }
}
module.exports = { summarizeIssueWithAI };