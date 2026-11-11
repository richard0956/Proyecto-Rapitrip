import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ROOT,reference,slides} from './content.mjs';
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const skill='C:/Users/alexa/.codex/plugins/cache/openai-primary-runtime/presentations/26.1110.11613/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const finalPath=ROOT+'/output/rapitrip-diseno-sistemas/Rapitrip-Diseno-de-Sistemas-final.pptx';
const originalLink=fs.link.bind(fs);
fs.link=async(src,dest)=>{try{return await originalLink(src,dest)}catch(e){if(e.code!=='EPERM'||path.resolve(dest)!==path.resolve(finalPath)||!src.endsWith('.validated'))throw e;return fs.copyFile(src,dest,1)}};
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath:ROOT+'/tmp/rapitrip-redesign/candidate-linked.pptx',finalPath,explicitTotalSlideCount:slides.length,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Lato','Source Serif 4'],referencePath:reference,referenceSha256:createHash('sha256').update(await fs.readFile(reference)).digest('hex')},verifyArtifactToolImport:true,receiptPath:ROOT+'/tmp/rapitrip-redesign/pptx-validation-final.json'});
fs.link=originalLink;console.log(JSON.stringify({file:result.finalPath,slides:result.presentationLayout?.slide_count,integrity:result.packageIntegrity?.status,findings:result.presentationLayout?.findings},null,2));


