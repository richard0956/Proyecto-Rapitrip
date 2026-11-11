const {chromium}=require('../../e2e/node_modules/@playwright/test');
const fs=require('node:fs/promises');
const root='C:/Users/alexa/Proyecto RT';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('file:///'+root+'/output/presentacion-rapitrip/Rapitrip-interactiva.html');await page.evaluate(()=>document.fonts.ready);
 await fs.mkdir(root+'/tmp/rapitrip-presentacion/html-renders',{recursive:true});
 const overflow=[];
 for(let i=1;i<=26;i++){
  await page.evaluate(i=>{show(i)},i-1);await page.waitForTimeout(40);
  const issues=await page.evaluate(()=>{let s=document.querySelector('.slide.active');return [...s.querySelectorAll('div:not(.diagram):not(.step):not(.gallery),a')].filter(x=>!x.closest('.gallery')).flatMap(x=>{let a=x.getBoundingClientRect(),b=s.getBoundingClientRect();if(a.right>b.right+1||a.bottom>b.bottom+1||a.left<b.left-1)return[x.textContent.slice(0,70)];return[]})});if(issues.length)overflow.push({slide:i,issues});
  await page.screenshot({path:root+'/tmp/rapitrip-presentacion/html-renders/slide-'+i+'.png'});
 }
 await page.evaluate(()=>show(0));await page.getByRole('button',{name:'Índice',exact:true}).click();await page.locator('#toc [data-go="12"]').click();if(await page.locator('#counter').textContent()!=='13 / 26')throw Error('TOC failed');
 await page.getByRole('button',{name:'Ampliar diagrama',exact:true}).click();await page.locator('#zoomRange').fill('150');await page.keyboard.press('Escape');
 await page.evaluate(()=>show(15));await page.locator('#walkthrough').click();if(await page.locator('.progress-step.current').count()!==1)throw Error('Walkthrough failed');await page.keyboard.press('ArrowRight');
 await page.evaluate(()=>show(16));await page.locator('#permission').click();await page.locator('#roleSelect').selectOption('cashier');if(!(await page.locator('#permissionResult').textContent()).includes('caja'))throw Error('Permission example failed');await page.keyboard.press('Escape');
 await page.locator('#notesButton').click();if(!(await page.locator('#notesText').textContent()).length)throw Error('Notes failed');await page.keyboard.press('Escape');
 await page.evaluate(()=>show(25));await page.locator('[data-original="entidad-relacion.png"]').click();await page.waitForTimeout(100);if(!await page.locator('#zoom').evaluate(e=>e.classList.contains('open')))throw Error('Original zoom failed');await page.keyboard.press('Escape');
 await page.evaluate(()=>show(0));await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/tmp/rapitrip-presentacion/html-mobile.png'});
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>show(0));await page.emulateMedia({media:'print'});await page.pdf({path:root+'/output/presentacion-rapitrip/Rapitrip-diapositivas.pdf',printBackground:true,preferCSSPageSize:true});
 console.log(JSON.stringify({slides:26,errors,overflow,interactiveChecks:'passed'}));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
