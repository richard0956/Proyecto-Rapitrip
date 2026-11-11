import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build,root,slides} from './deck.mjs';
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1105-1297-0_26.1105.1297.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const {Presentation,PresentationFile}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const skill='C:/Users/alexa/.codex/plugins/cache/openai-primary-runtime/presentations/26.1105.12137/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const p=Presentation.create({slideSize:{width:1280,height:720}});
const images={};
for(const file of [root+'/apps/store/public/brand/logo-completo.webp',...slides.flatMap(s=>(s.images??[]).map(n=>root+'/tmp/rapitrip-presentacion/assets/'+n))]){const b=await fs.readFile(file);images[file]={data:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),type:file.endsWith('.webp')?'image/webp':'image/png'};}
build(p,images);
const candidatePath=root+'/tmp/rapitrip-presentacion/candidate.pptx';
await (await PresentationFile.exportPptx(p)).save(candidatePath);
await fs.mkdir(root+'/tmp/rapitrip-presentacion/final-renders',{recursive:true});
for(let i=0;i<p.slides.items.length;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(root+'/tmp/rapitrip-presentacion/final-renders/slide-'+(i+1)+'.png',new Uint8Array(await b.arrayBuffer()));}
console.log('Draft exported');
// This Windows sandbox does not permit hard links. Preserve exclusive publication
// and let the finalizer verify the copied bytes against its validated hash.
const originalLink=fs.link.bind(fs);
fs.link=async (src,dest)=>{try{return await originalLink(src,dest);}catch(e){if(e.code!=='EPERM'||path.resolve(dest)!==path.resolve(root+'/output/presentacion-rapitrip/Rapitrip.pptx')||!src.endsWith('.validated'))throw e;return fs.copyFile(src,dest,1);}};
const result=await finalizePresentation({workspaceDir:root,candidatePath,finalPath:root+'/output/presentacion-rapitrip/Rapitrip.pptx',explicitTotalSlideCount:slides.length,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:root+'/tmp/rapitrip-presentacion/validation-entrega.json'});
fs.link=originalLink;
console.log(JSON.stringify(result,null,2));


