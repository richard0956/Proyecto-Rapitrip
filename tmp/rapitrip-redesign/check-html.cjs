const {chromium}=require('../../e2e/node_modules/@playwright/test');
const fs=require('node:fs/promises');
const root='C:/Users/alexa/Proyecto RT';
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:920}});await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+root+'/output/rapitrip-diseno-sistemas/Rapitrip-presentacion-interactiva.html');await page.evaluate(()=>document.fonts.ready);await fs.mkdir(root+'/tmp/rapitrip-redesign/html-renders',{recursive:true});
const overflow=[],overlaps=[];
for(let i=0;i<28;i++){
 await page.evaluate(i=>show(i),i);await page.waitForTimeout(25);
 const defects=await page.evaluate(()=>{let s=document.querySelector('.slide.active'),r=s.getBoundingClientRect(),ts=[...s.querySelectorAll('.txt')];let overflow=ts.filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>({text:e.textContent.slice(0,75),actual:e.scrollHeight,available:e.clientHeight}));let overlaps=[];for(let a=0;a<ts.length;a++)for(let b=a+1;b<ts.length;b++){let A=ts[a].getBoundingClientRect(),B=ts[b].getBoundingClientRect();if(Math.min(A.right,B.right)-Math.max(A.left,B.left)>3&&Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top)>3)overlaps.push([ts[a].textContent.slice(0,35),ts[b].textContent.slice(0,35)])}return{overflow,overlaps}});
 if(defects.overflow.length)overflow.push({slide:i+1,...defects});if(defects.overlaps.length)overlaps.push({slide:i+1,pairs:defects.overlaps});
 await page.screenshot({path:root+'/tmp/rapitrip-redesign/html-renders/slide-'+(i+1)+'.png'});
}
await page.locator('#menuButton').click();await page.locator('#toc [data-slide="12"]').click();if(await page.locator('.counter').textContent()!=='13 / 28')throw Error('Menu failed');
await page.locator('.slide.active .expand').click();await page.locator('#zoomRange').fill('150');await page.keyboard.press('Escape');
await page.evaluate(()=>show(16));await page.locator('#walk').click();if(await page.locator('.walk-row').count()!==1)throw Error('Walkthrough failed');
await page.evaluate(()=>show(17));await page.locator('#permissionsButton').click();await page.locator('#roleSelect').selectOption('cajero');if(!(await page.locator('.permission-result').textContent()).includes('caja'))throw Error('Permission example failed');await page.keyboard.press('Escape');
await page.locator('#notesButton').click();if((await page.locator('#noteText').textContent()).length<15)throw Error('Notes failed');await page.keyboard.press('Escape');
await page.evaluate(()=>show(27));await page.locator('.slide.active .original').click();await page.waitForTimeout(80);if(!await page.locator('#zoom').evaluate(e=>e.classList.contains('open')))throw Error('Original diagram failed');await page.keyboard.press('Escape');
await page.evaluate(()=>show(0));await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/tmp/rapitrip-redesign/mobile.png'});await page.setViewportSize({width:1440,height:920});
await page.evaluate(()=>{show(0);document.querySelectorAll('a.jump').forEach(a=>a.removeAttribute('href'))});await page.emulateMedia({media:'print'});await page.pdf({path:root+'/output/rapitrip-diseno-sistemas/Rapitrip-Diseno-de-Sistemas.pdf',preferCSSPageSize:true,printBackground:true});
await fs.writeFile(root+'/tmp/rapitrip-redesign/html-validation.json',JSON.stringify({slides:28,errors,overflow,overlaps,interactions:'passed'},null,2));console.log(JSON.stringify({slides:28,errors,overflow,overlaps,interactions:'passed'}));
}finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
