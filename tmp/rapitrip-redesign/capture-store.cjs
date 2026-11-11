const {chromium}=require('../../e2e/node_modules/@playwright/test');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const p=await b.newPage({viewport:{width:1440,height:980},deviceScaleFactor:1});await p.goto('http://127.0.0.1:3101',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(4000);await p.screenshot({path:'C:/Users/alexa/Proyecto RT/tmp/rapitrip-redesign/reference/tienda.png',clip:{x:120,y:10,width:1200,height:600}});console.log((await p.locator('body').innerText()).slice(0,1100));await b.close()})().catch(e=>{console.error(e);process.exitCode=1});


