import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {ROOT,P,slides,reference,sourcePdf} from './content.mjs';
process.on('uncaughtException',e=>{console.error(e.stack);process.exit(1)});
export const RT='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1110-973-0_26.1110.973.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=RT+'/node/node_modules';
const require=createRequire(RT+'/node/node_modules/package.json');
const {GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath(ROOT+'/tmp/rapitrip-redesign/reference/Lato-Regular.ttf','Lato');
GlobalFonts.registerFromPath(ROOT+'/tmp/rapitrip-redesign/reference/Lato-Bold.ttf','Lato');
GlobalFonts.registerFromPath(ROOT+'/tmp/rapitrip-redesign/reference/SourceSerif4-Regular.ttf','Source Serif 4');
const artifactRequire=createRequire(RT+'/node/node_modules/@oai/artifact-tool/package.json');
const {FontLibrary}=artifactRequire('skia-canvas');
FontLibrary.use('Lato',[ROOT+'/tmp/rapitrip-redesign/reference/Lato-Regular.ttf',ROOT+'/tmp/rapitrip-redesign/reference/Lato-Bold.ttf']);
FontLibrary.use('Source Serif 4',[ROOT+'/tmp/rapitrip-redesign/reference/SourceSerif4-Regular.ttf']);
const {PresentationFile,FileBlob}=await import(pathToFileURL(RT+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const p=await PresentationFile.importPptx(await FileBlob.load(reference));
const originals=[...p.slides.items];const made=[];
const assets={};
async function addImage(s,a){let file=a.path;if(!assets[file]){const b=await fs.readFile(file);assets[file]={blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:file.endsWith('.webp')?'image/webp':'image/png'};}s.images.add({...assets[file],position:{left:a.x,top:a.y,width:a.w,height:a.h},alt:a.alt??file.split('/').at(-1),fit:'contain'});}
function text(s,a){const sh=s.shapes.add({name:a.jump?'link_slide_'+a.jump:a.name??a.text.slice(0,65),geometry:a.fill?'roundRect':'textbox',position:{left:a.x,top:a.y,width:a.w,height:a.h},fill:a.fill??'none',line:{fill:'none',width:0},...(a.radius?{borderRadius:"rounded-full"}:{} )});sh.text=a.text;sh.text.style={typeface:a.font??'Lato',fontSize:a.size??24,color:a.color??P.ink,bold:!!a.heading,alignment:a.align??'left',verticalAlignment:a.fill?'middle':'top'};sh.text.insets=a.fill?{left:8,right:8,top:0,bottom:0}:0;return sh;}
function diagram(s,d){const ns=d.nodes.map((n)=>{const sh=s.shapes.add({name:n.text.split('\n')[0],geometry:'roundRect',position:{left:n.x,top:n.y,width:n.w,height:n.h},fill:n.fill,line:{fill:n.fill===P.forest?P.forest:P.line,width:1.4},borderRadius:"rounded-2xl"});const lines=n.text.split('\n');sh.text=lines.length===1?n.text:[{runs:[{run:lines[0],style:{fontSize:"25px",bold:false,color:n.fill===P.forest?P.white:P.ink}}]},...lines.slice(1).map(v=>({runs:[{run:v,style:{fontSize:"19px",color:n.fill===P.forest?P.mint:P.muted}}]}))];sh.text.style={typeface:'Lato',fontSize:25,alignment:'center',verticalAlignment:'middle',color:n.fill===P.forest?P.white:P.ink};sh.text.insets=8;if(lines.length>1)for(const v of lines.slice(1))sh.text.get(v).fontSize=19;return sh;});
 d.edges.forEach(e=>{if(e.custom&&e.points){for(let k=1;k<e.points.length;k++){let A=e.points[k-1],B=e.points[k];let line=s.shapes.add({geometry:'connector',kind:'straight',position:{left:Math.min(A[0],B[0]),top:Math.min(A[1],B[1]),width:Math.abs(B[0]-A[0]),height:Math.abs(B[1]-A[1])},line:{fill:P.green,width:2.2},head:k===e.points.length-1&&(B[0]<A[0]||B[1]<A[1])?{type:'triangle',width:'sm',length:'sm'}:undefined,tail:k===e.points.length-1&&B[0]>=A[0]&&B[1]>=A[1]?{type:'triangle',width:'sm',length:'sm'}:undefined});line.bringToFront();}return;}if(e.custom){s.shapes.add({geometry:'connector',kind:'straight',position:{left:e.x1,top:e.y1,width:e.x2-e.x1,height:e.y2-e.y1},line:{fill:P.green,width:2.5},tail:{type:'triangle',width:'sm',length:'sm'}});return;}const [i,j]=e,A=d.nodes[i],B=d.nodes[j];let dy=B.y-A.y,dx=B.x-A.x;const vertical=Math.abs(dy)>120; const conn=s.shapes.connect(ns[i],ns[j],{kind:'elbow',fromSide:vertical?(dy>0?'bottom':'top'):(dx>=0?'right':'left'),toSide:vertical?(dy>0?'top':'bottom'):(dx>=0?'left':'right'),line:{fill:P.green,width:2.2},tail:{type:'triangle',width:'sm',length:'sm'}});conn.bringToFront();});ns.forEach(n=>n.bringToFront());}
for(let i=0;i<slides.length;i++){
 const d=slides[i],s=originals[d.ref-1].duplicate();made.push(s.id);
 const keep=new Set(d.keepArt?Array.from({length:7},(_,k)=>'Shape '+k):['Shape 0','Shape 1']);for(const q of d.panels)keep.add(q.slot);
 for(const sh of [...s.shapes.items])if(!keep.has(sh.name))sh.delete();
 for(const im of [...s.images.items])im.delete();for(const c of [...s.charts.items])c.delete();
 for(const b of d.panels){let sh=s.shapes.items.find(x=>x.name===b.slot);if(sh){sh.position={left:b.x,top:b.y,width:b.w,height:b.h};sh.fill=b.fill;sh.line={fill:b.fill===P.white?P.line:'none',width:b.fill===P.white?1:0};}else{s.shapes.add({name:b.slot,geometry:'roundRect',position:{left:b.x,top:b.y,width:b.w,height:b.h},fill:b.fill,line:{fill:b.fill===P.white?P.line:'none',width:b.fill===P.white?1:0},borderRadius:"rounded-3xl",shadow:b.fill===P.white?'shadow-sm':undefined});}}
 if(d.cover){text(s,{text:d.section,x:85,y:95,w:700,h:28,size:15,color:P.green,font:'Lato'});text(s,{text:d.title,x:85,y:145,w:698,h:181,size:57,color:P.ink,font:'Source Serif 4'});}else{
 text(s,{text:d.section.toUpperCase(),x:85,y:68,w:1107,h:27,size:15,color:P.green});text(s,{text:d.title,x:85,y:107,w:1108,h:90,size:40,color:P.ink,font:'Source Serif 4'});
 text(s,{text:'Rapitrip · Diseño de Sistemas de Internet',x:85,y:659,w:860,h:25,size:14,color:P.muted});text(s,{text:(i+1)+' / '+slides.length,x:1105,y:659,w:90,h:25,size:14,color:P.muted,align:'right'});
 text(s,{text:'Índice',x:986,y:659,w:82,h:25,size:14,color:P.green,jump:3});
 }
 for(const a of d.text)text(s,a);
 for(const a of d.images)await addImage(s,a);
 if(d.nodes.length||d.edges.length)diagram(s,d);
 if(d.original){let count=d.original.length;for(let k=0;k<count;k++){let w=count===1?1040:count===2?500:335,x=count===1?120:count===2?110+k*555:110+k*361;await addImage(s,{path:ROOT+'/tmp/rapitrip-presentacion/assets/'+d.original[k],x,y:213,w,h:371,alt:d.original[k]});}text(s,{text:'Diagramas originales del entregable. Consultar con ampliación para revisar sus detalles.',x:111,y:581,w:1050,h:26,size:17,color:P.muted});}
 for(const a of d.links)text(s,{text:a.label,x:a.x,y:a.y,w:a.w,h:a.h,size:17,color:i===11&&a.x>800?P.lime:P.green,name:'external_'+a.url});
 s.speakerNotes.text=d.notes+'\n\nFuente técnica: '+sourcePdf+'. Páginas físicas '+d.pages+'.\nDiseño visual adaptado de: '+reference+'.';
}
p.slides.keep(made);p.slides.reorder(made);p.theme.defaultFont='Lato';
const dir=ROOT+'/tmp/rapitrip-redesign';await fs.mkdir(dir+'/renders',{recursive:true});
const wanted=process.env.SLIDES?process.env.SLIDES.split(',').map(Number):slides.map((_,i)=>i+1);
for(const n of wanted){const b=await p.export({slide:p.slides.items[n-1],format:'png',scale:1});await fs.writeFile(dir+'/renders/slide-'+n+'.png',new Uint8Array(await b.arrayBuffer()));}
await (await PresentationFile.exportPptx(p)).save(dir+'/draft.pptx');
await fs.writeFile(dir+'/content-check.ndjson',(await p.inspect({kind:'slide,textbox,shape,image',maxChars:1000000})).ndjson);
console.log(JSON.stringify({slides:p.slides.items.length,rendered:wanted.length,candidate:dir+'/draft.pptx'}));






