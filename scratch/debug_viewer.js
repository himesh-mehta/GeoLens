const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:3000/viewer?area=custom-24.4034-79.7603', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log("Navigation finished.");
  } catch (err) {
    console.error("Navigation error:", err.message);
  }

  await browser.close();
})();
