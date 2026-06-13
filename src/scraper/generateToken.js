const puppeteer = require('puppeteer');
const path = require('path');

let browserInstance = null; 

async function generateTokenViaScraping(exactUsername, clientType, issueSummary) {
    let page; 
    try {
        const sessionPath = path.join(__dirname, '../../puppeteer_session');
        
        if (!browserInstance || !browserInstance.connected) {
            browserInstance = await puppeteer.launch({ 
                headless: false, 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
                defaultViewport: null,
                userDataDir: sessionPath 
            });
            console.log("🚀 [Puppeteer] Background Browser Launched!");
        }
        
        page = await browserInstance.newPage();
        await page.setDefaultTimeout(180000); 

        let loginUrl, createUrl, panelUser, panelPass;

        if (clientType === 'Radius') {
            loginUrl = process.env.RADIUS_LOGIN_URL || 'https://billing.circlenetworkbd.net/admin/login';
            createUrl = process.env.RADIUS_CREATE_URL || 'https://billing.circlenetworkbd.net/admin/add-token';
            panelUser = process.env.RADIUS_USER;
            panelPass = process.env.RADIUS_PASS;
        }

        if (!panelUser || !panelPass) {
            console.log(`❌ Missing Login Credentials in .env`);
            if (page) await page.close();
            return "Failed";
        }

        console.log(`\n🤖 UI Automation Engine for: ${exactUsername}`);
        
        await page.goto(createUrl, { waitUntil: 'networkidle2' });

        if (page.url().includes('login')) {
            console.log("⚠️ Session not found/expired. Executing fresh login...");

            const emailSelector = '#form2Example11'; 
            const passSelector = '#form2Example22';
            const btnSelector = '#logInBtn';

            await page.waitForSelector(emailSelector);

            await page.click(emailSelector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(emailSelector, panelUser, { delay: 50 });

            await page.click(passSelector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(passSelector, panelPass, { delay: 50 });

            console.log("🔐 Logging in...");
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
                page.click(btnSelector)
            ]);
            console.log("✅ Login Successful! Session Saved permanently.");

            await page.goto(createUrl, { waitUntil: 'networkidle2' });
        } else {
            console.log("🎉 [SPEED-UP] Session active. Skipped login screen!");
        }

        const SEARCH_SELECTOR = 'input[placeholder="Search by customer user name"]';
        await page.waitForSelector(SEARCH_SELECTOR, { timeout: 10000 });
        
        await page.type(SEARCH_SELECTOR, exactUsername); 
        console.log(`Typing username: ${exactUsername}. Waiting for suggestion box...`);
        await new Promise(r => setTimeout(r, 2000)); 
        
        const suggestionBox = '#customer_list .customer_li';
        await page.waitForSelector(suggestionBox, { visible: true, timeout: 5000 }).catch(() => {});
        
        if (await page.$(suggestionBox)) {
            const isClicked = await page.evaluate((username) => {
                const listItems = Array.from(document.querySelectorAll('#customer_list .customer_li'));
                const targetUser = username.toLowerCase();
                for (let li of listItems) {
                    const text = li.innerText.toLowerCase();
                    const parts = text.split('userid:');
                    if (parts.length > 1) {
                        const extractedId = parts[1].trim().split(/\s+/)[0]; 
                        if (extractedId === targetUser) {
                            li.click();
                            return true;
                        }
                    }
                }
                if (listItems.length > 0) {
                    listItems[0].click();
                    return true;
                }
                return false;
            }, exactUsername);

            if (!isClicked) {
                console.log(`❌ No clickable suggestion found. Aborting.`);
                if (page) await page.close();
                return "Failed";
            }
            console.log("✅ Clicked suggestion box.");
            await new Promise(r => setTimeout(r, 2500)); 
        }

        await page.select('#tokenCategory', '1'); 
        await new Promise(r => setTimeout(r, 2000)); 

        await page.select('#tokenCode', '113'); 
        await new Promise(r => setTimeout(r, 1000));

        const finalDescription = `[Bot Generated] Issue: ${issueSummary}`;
        await page.type('#description', finalDescription);
        await new Promise(r => setTimeout(r, 500));

        await page.select('select[name="token_source"]', 'Mail');
        await new Promise(r => setTimeout(r, 500));

        await page.select('#token_type', 'Logical');
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("⚙️ Form filled. Clicking top 'Save' Button...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.trim() === 'Save');
            if (saveBtn) saveBtn.click();
        });
        
        console.log("⏳ Waiting 6 seconds for backend to save the token...");
        await new Promise(r => setTimeout(r, 6000)); 

        console.log("🔍 Filtering table to extract Token ID...");

        await page.evaluate(() => {
            const sel = document.querySelector('select[name="reseller_id"]') || document.querySelector('#reseller_id');
            if (sel) {
                sel.value = 'all';
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await new Promise(r => setTimeout(r, 1500)); 

        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const searchBtn = btns.find(b => b.innerText.trim() === 'Search');
            if (searchBtn) searchBtn.click();
        });
        await new Promise(r => setTimeout(r, 5000)); 

        const dtSearchBox = '#dataTabletoken_filter input'; 
        if (await page.$(dtSearchBox)) {
            await page.click(dtSearchBox, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(dtSearchBox, exactUsername); 
            await new Promise(r => setTimeout(r, 3000)); 
        }

        const scrapeResult = await page.evaluate(() => {
            const firstRow = document.querySelector('#dataTabletoken tbody tr:first-child') || document.querySelector('table tbody tr:first-child');
            if (!firstRow || firstRow.querySelector('.dataTables_empty')) return null;

            const tokenCell = firstRow.querySelector('td:nth-child(2)');
            if (!tokenCell) return null;

            const rawText = tokenCell.innerText.trim();
            const cleanMatch = rawText.match(/(\d+)/);
            return cleanMatch ? `TKN-${cleanMatch[1]}` : rawText;
        });

        if (page) {
            await page.close();
            console.log("🚫 Tab closed securely. Keeping main browser alive...");
        }

        if (scrapeResult) {
            console.log(`🎉 Successfully retrieved LATEST Token ID: ${scrapeResult}`);
            return scrapeResult;
        } else {
            console.log(`❌ Failed to extract Token ID from the table.`);
            return "Failed";
        }

    } catch (error) {
        console.error(`❌ [Puppeteer Error]: ${error.message}`);
        if (page) await page.close();
        return "Failed";
    }
}

module.exports = { generateTokenViaScraping };