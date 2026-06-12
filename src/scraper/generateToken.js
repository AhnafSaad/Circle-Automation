const puppeteer = require('puppeteer'); 

async function generateTokenViaScraping(exactUsername, clientType, issueSummary) {
    let browser;
    try {
        console.log(`🤖 Starting UI Automation Engine for: ${exactUsername}`);
        
        browser = await puppeteer.launch({ 
            headless: false, // 💡 প্রোডাকশনে ব্যাকগ্রাউন্ডে চালানোর সময় এটিকে true করে দেবেন
            userDataDir: './data/browser_session', // সেশন সেভ রাখার জন্য
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'] 
        });

        const page = await browser.newPage();
        await page.setDefaultTimeout(60000); // 60 seconds timeout

        // ==========================================
        // 🔐 ধাপ ১: স্মার্ট লগইন লজিক (Session checking)
        // ==========================================
        console.log("Checking session and login status...");
        await page.goto('https://billing.circlenetworkbd.net/admin/login', { waitUntil: 'networkidle2' });

        if (page.url().includes('login')) {
            console.log("Executing fresh login...");
            if (await page.$('#form2Example11')) {
                await page.click('#form2Example11', { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type('#form2Example11', process.env.RADIUS_USER);
            }
            if (await page.$('#form2Example22')) {
                await page.click('#form2Example22', { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type('#form2Example22', process.env.RADIUS_PASS);
            }
            if (await page.$('#logInBtn')) {
                await page.click('#logInBtn');
                await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
            }
        } else {
            console.log("✅ Session active. Skipping login screen.");
        }

        // ==========================================
        // 🎫 ধাপ ২: টোকেন ক্রিয়েট পেজ এবং স্মার্ট অটো-ফিল
        // ==========================================
        console.log("Navigating to Add Token page...");
        await page.goto('https://billing.circlenetworkbd.net/admin/add-token', { waitUntil: 'networkidle2' });
        
        const SEARCH_SELECTOR = 'input[placeholder="Search by customer user name"]';
        await page.waitForSelector(SEARCH_SELECTOR, { timeout: 10000 });
        
        await page.type(SEARCH_SELECTOR, exactUsername); 
        console.log(`Typing exact username: ${exactUsername}. Waiting for suggestion box...`);
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
                // যদি ১০০% ম্যাচ না পায়, তবে প্রথম অপশন ক্লিক করবে
                if (listItems.length > 0) {
                    listItems[0].click();
                    return true;
                }
                return false;
            }, exactUsername);

            if (!isClicked) {
                console.log(`❌ No clickable suggestion found for: ${exactUsername}. Aborting.`);
                await browser.close();
                return "Failed";
            }
            console.log("Clicked suggestion box. Proceeding to form...");
            await new Promise(r => setTimeout(r, 2500)); 
        } else {
            console.log(`❌ No suggestion box appeared for: ${exactUsername}. Aborting.`);
            await browser.close();
            return "Failed";
        }

        // ==========================================
        // 🔘 ধাপ ৩: ড্রপডাউন ও ফর্ম ফিলাপ 
        // ==========================================
        await page.select('#tokenCategory', '1'); 
        console.log("Token Category 'Problem' selected. Loading sub-codes...");
        await new Promise(r => setTimeout(r, 2000)); 

        await page.select('#tokenCode', '113'); 
        await new Promise(r => setTimeout(r, 1000));

        // এআই জেনারেট করা সামারি এখানে বসবে
        await page.type('#description', issueSummary);
        await new Promise(r => setTimeout(r, 500));

        await page.select('select[name="token_source"]', 'Mail');
        await new Promise(r => setTimeout(r, 500));

        await page.select('#token_type', 'Logical');
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Form filled. Clicking top 'Save' Button...");
        
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.trim() === 'Save');
            if (saveBtn) saveBtn.click();
        });
        
        console.log("Waiting 6 seconds for backend to save the token...");
        await new Promise(r => setTimeout(r, 6000)); 

        // ==========================================
        // 📋 🎯 ধাপ ৪: ফিল্টারিং ও একদম নিচ থেকে লাস্ট টোকেন গ্র্যাব
        // ==========================================
        console.log("Processing the lower section of the page to grab the Token...");

        // ১. Reseller 'All' সিলেক্ট করা
        await page.evaluate(() => {
            const sel = document.querySelector('select[name="reseller_id"]') || document.querySelector('#reseller_id');
            if (sel) {
                sel.value = 'all';
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await new Promise(r => setTimeout(r, 1500)); 

        // ২. DataTables আপডেট করার জন্য 'Search' বাটনে ক্লিক করা
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const searchBtn = btns.find(b => b.innerText.trim() === 'Search');
            if (searchBtn) searchBtn.click();
        });
        await new Promise(r => setTimeout(r, 5000)); 

        // ৩. DataTables এর সার্চ বক্সে আপনার এডমিন নাম লেখা
        const dtSearchBox = '#dataTabletoken_filter input'; 
        const adminNameForSearch = process.env.ADMIN_NAME || 'Ahnaf Sadik Saad';
        
        if (await page.$(dtSearchBox)) {
            await page.click(dtSearchBox, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(dtSearchBox, adminNameForSearch); 
            await new Promise(r => setTimeout(r, 3000)); 
        }

        // ৪. টেবিলের একদম শেষের লাইন (Bottom Row) থেকে লাস্ট টোকেন গ্র্যাব করা
        const scrapeResult = await page.evaluate(() => {
            const lastRow = document.querySelector('#dataTabletoken tbody tr:last-child') || document.querySelector('table tbody tr:last-child');
            
            if (!lastRow || lastRow.querySelector('.dataTables_empty')) return null;

            // ২ নম্বর কলাম (Token#)
            const tokenCell = lastRow.querySelector('td:nth-child(2)');
            if (!tokenCell) return null;

            const rawText = tokenCell.innerText.trim();
            
            // TKN- সহ শুধু নাম্বারটুকু আলাদা করা
            const cleanMatch = rawText.match(/(\d+)/);
            return cleanMatch && cleanMatch[1] ? `TKN-${cleanMatch[1]}` : rawText;
        });
        
        if (scrapeResult) {
            console.log(`🎉 Successfully retrieved LATEST Token ID: ${scrapeResult}`);
            await browser.close();
            return scrapeResult;
        } else {
            console.log(`⚠️ Failed to retrieve Token ID from the bottom of the table.`);
            await browser.close();
            return "Failed";
        }

    } catch (error) {
        console.error(`❌ [Puppeteer Error]: ${error.message}`);
        if (browser) await browser.close();
        return "Failed";
    }
}

module.exports = { generateTokenViaScraping };