import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies';
const {PresentationFile,FileBlob}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const p=await PresentationFile.importPptx(await FileBlob.load('C:/Users/alexa/Downloads/PETI Rapitrip presentación de defensa.pptx'));
const dir='C:/Users/alexa/Proyecto RT/tmp/rapitrip-redesign/reference';
await fs.writeFile(dir+'/inspect.ndjson',(await p.inspect({kind:'slide,textbox,shape,image,layout',maxChars:1000000})).ndjson);
for(let i=0;i<p.slides.items.length;i++){
 const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(dir+'/slide-'+(i+1)+'.png',new Uint8Array(await b.arrayBuffer()));
}
console.log('Rendered',p.slides.items.length,'reference slides');
