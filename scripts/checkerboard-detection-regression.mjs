import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname,"..");
const reportDirectory = path.join(root,"tmp/run2-checkerboard-corpus");
await fs.mkdir(reportDirectory,{recursive:true});
function compile(source){
  const output={};
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","exports",js)(name=>name.endsWith("conversionModules.server")?{getSharp:async()=>sharp}:{},output);
  return output.neutralizeTransparencyCheckerboard;
}
const baselineRef=process.env.CHECKER_BASELINE_REF || "origin/main";
const before=compile(execFileSync("git",["show",`${baselineRef}:app/utils/imagePreprocess.server.ts`],{cwd:root,encoding:"utf8"}));
const after=compile(await fs.readFile(path.join(root,"app/utils/imagePreprocess.server.ts"),"utf8"));
const svg=async text=>sharp(Buffer.from(text)).png().toBuffer();
const opaqueArt=(background,details='')=>`<svg width="320" height="240">${background}<rect x="70" y="60" width="180" height="120" fill="#b42110"/><path d="M90 100H230M130 80V160" stroke="white" stroke-width="7"/>${details}</svg>`;
const cases=[];
for(const [id,bg]of [
  ["two-solid-bands",'<path fill="#f8f8f8" d="M0 0H320V120H0Z"/><path fill="#dedede" d="M0 120H320V240H0Z"/>'],
  ["four-neutral-quadrants",'<rect width="320" height="240" fill="#f8f8f8"/><path fill="#dedede" d="M160 0H320V120H160ZM0 120H160V240H0Z"/>'],
  ["horizontal-stripes",'<defs><pattern id="b" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f8f8f8"/><rect width="20" height="10" fill="#dedede"/></pattern></defs><rect width="320" height="240" fill="url(#b)"/>'],
  ["neutral-gradient",'<defs><linearGradient id="g"><stop stop-color="#dedede"/><stop offset="1" stop-color="#f8f8f8"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/>'],
  ["opaque-logo-with-white-details",'<rect width="320" height="240" fill="#f8f8f8"/><rect x="15" y="15" width="290" height="210" rx="16" fill="#dedede"/>'],
])cases.push({id,input:await svg(opaqueArt(bg)),kind:"preserve"});
cases.push({id:"ui-mockup",input:await fs.readFile(path.join(root,"tests/fixtures/IMG_8487.PNG")),kind:"preserve"});
cases.push({id:"transparent-logo",input:await svg(opaqueArt('')),kind:"preserve"});
for (const cell of [4, 10, 20]) {
  const bands = Buffer.alloc(320 * 240 * 4);
  for (let y = 0; y < 240; y++) for (let x = 0; x < 320; x++) {
    const offset = (y * 320 + x) * 4;
    const neutral = Math.floor((x + y) / cell) % 2 ? 222 : 248;
    bands[offset] = bands[offset + 1] = bands[offset + 2] = neutral;
    bands[offset + 3] = 255;
  }
  cases.push({id:`diagonal-stripes-${cell}`,input:await sharp(bands,{raw:{width:320,height:240,channels:4}}).png().toBuffer(),kind:"preserve"});
}
const noise=Buffer.alloc(320*240*4);
let seed=76543;
for(let i=0;i<noise.length;i+=4){seed=(seed*1664525+1013904223)>>>0;noise[i]=80+(seed%170);noise[i+1]=70+((seed>>>8)%180);noise[i+2]=60+((seed>>>16)%190);noise[i+3]=255;}
cases.push({id:"deterministic-photographic-texture",input:await sharp(noise,{raw:{width:320,height:240,channels:4}}).blur(1).png().toBuffer(),kind:"preserve"});
for(const cell of [4,8,10,20,40]){
  const period=cell*2;
  const checker=`<defs><pattern id="b" width="${period}" height="${period}" patternUnits="userSpaceOnUse"><rect width="${period}" height="${period}" fill="#f8f8f8"/><path fill="#dedede" d="M0 0H${cell}V${cell}H0ZM${cell} ${cell}H${period}V${period}H${cell}Z"/></pattern></defs><rect width="320" height="240" fill="url(#b)"/>`;
  const input=await svg(opaqueArt(checker));
  cases.push({id:`checker-${cell}`,input,kind:"remove"});
  if(cell===10){
    cases.push({id:"checker-jpeg",input:await sharp(input).jpeg({quality:88}).toBuffer(),kind:"remove"});
    cases.push({id:"checker-rescaled",input:await sharp(input).resize(833,625,{fit:"fill"}).png().toBuffer(),kind:"remove"});
    cases.push({id:"checker-offset-crop",input:await sharp(input).extract({left:3,top:7,width:310,height:230}).png().toBuffer(),kind:"remove"});
  }
}
const pixels=async input=>sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const opaqueShare=({data,info})=>{let opaque=0;for(let i=3;i<data.length;i+=info.channels)if(data[i]>=245)opaque++;return opaque/(info.width*info.height);};
const rows=[];
for(const fixture of cases){
  const start=performance.now();
  const old=await before(fixture.input),candidate=await after(fixture.input);
  const source=await pixels(fixture.input),legacy=await pixels(old),next=await pixels(candidate);
  if(fixture.kind==="preserve")assert.deepEqual(candidate,fixture.input,`${fixture.id}: ambiguous ordinary input must remain byte-for-byte unchanged`);
  else {
    assert.deepEqual(next.data,legacy.data,`${fixture.id}: established checkerboard removal must preserve exact decoded output`);
    assert.ok(opaqueShare(next)<opaqueShare(source)*0.6,`${fixture.id}: checker background must actually be removed`);
  }
  rows.push({id:fixture.id,kind:fixture.kind,sourceOpaqueShare:opaqueShare(source),legacyOpaqueShare:opaqueShare(legacy),candidateOpaqueShare:opaqueShare(next),sourceBytes:fixture.input.length,legacyBytes:old.length,candidateBytes:candidate.length,elapsedMs:Math.round(performance.now()-start),candidateSha256:createHash("sha256").update(candidate).digest("hex")});
}
await fs.writeFile(path.join(reportDirectory,"report.json"),JSON.stringify(rows,null,2));
console.log(JSON.stringify({cases:rows.length,preserved:rows.filter(x=>x.kind==="preserve").length,checkerParity:rows.filter(x=>x.kind==="remove").length,totalMs:rows.reduce((n,x)=>n+x.elapsedMs,0),report:"tmp/run2-checkerboard-corpus/report.json"},null,2));
