const puppeteer = require('puppeteer');

async function generateTokenViaScraping(userId, clientType, issueSummary) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    let token = "Failed";

    try {
        if (clientType === 'Radius') {
            await page.goto(process.env.RADIUS_CREATE_URL, { waitUntil: 'networkidle2' });
            
            // TODO: স্ক্রিনশট থেকে এই সিলেক্টরগুলো আপডেট করতে হবে
            await page.type('#id_field', userId); 
            await page.type('#description_field', issueSummary); 
            await page.click('#submit_btn');
            
            await page.waitForSelector('#token_output', { timeout: 15000 });
            token = await page.$eval('#token_output', el => el.innerText.trim());

        } else if (clientType === 'Ticket') {
            await page.goto(process.env.TICKET_CREATE_URL, { waitUntil: 'networkidle2' });
            
            // TODO: স্ক্রিনশট থেকে এই সিলেক্টরগুলো আপডেট করতে হবে
            await page.type('#ticket_id_field', userId);
            await page.type('#ticket_desc_field', issueSummary); 
            await page.click('#create_ticket_btn');
            
            await page.waitForSelector('#ticket_output', { timeout: 15000 });
            token = await page.$eval('#ticket_output', el => el.innerText.trim());
        }
    } catch (err) { 
        console.error(`Scraper Error (${clientType}):`, err.message); 
    } finally {
        await browser.close();
    }

    return token;
}

module.exports = { generateTokenViaScraping };

