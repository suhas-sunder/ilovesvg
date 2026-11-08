import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "..");
const directory = path.join(root, "tmp/run2-apng-preparation");
await fs.mkdir(directory, { recursive: true });
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const code = ts.transpileModule(await fs.readFile(path.join(root,"app/client/lib/converter/prepareRasterUpload.ts"),"utf8"), { compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022} }).outputText;
const table = new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
const crc32=data=>{let crc=0xffffffff;for(const byte of data)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;};
function chunk(type,data){const tag=Buffer.from(type);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);tag.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([tag,data])),out.length-4);return out;}
function chunks(png){const result=[];for(let offset=8;offset+12<=png.length;){const size=png.readUInt32BE(offset);const type=png.toString("ascii",offset+4,offset+8);const data=png.subarray(offset+8,offset+8+size);assert.equal(png.readUInt32BE(offset+8+size),crc32(png.subarray(offset+4,offset+8+size)),`valid ${type} CRC`);result.push({type,data});offset+=size+12;}return result;}
async function apng(width,height){
 const frames=[];
 for(const color of ["rgb(240,20,30)","rgb(10,50,230)"]){
  frames.push(await sharp(Buffer.from(`<svg width="${width}" height="${height}"><path fill="${color}" d="M20 10H${width-20}V${height-10}H20Z"/></svg>`)).png().toBuffer());
 }
 const first=chunks(frames[0]),second=chunks(frames[1]);
 const ihdr=first.find(x=>x.type==="IHDR").data;
 assert.equal(ihdr[9],6,"RGBA source PNG");
 const animation=Buffer.alloc(8);animation.writeUInt32BE(2,0);animation.writeUInt32BE(0,4);
 const control=sequence=>{const data=Buffer.alloc(26);data.writeUInt32BE(sequence,0);data.writeUInt32BE(width,4);data.writeUInt32BE(height,8);data.writeUInt16BE(1,20);data.writeUInt16BE(1,22);return chunk("fcTL",data);};
 let sequence=2;
 const file=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("acTL",animation),control(0),...first.filter(x=>x.type==="IDAT").map(x=>chunk("IDAT",x.data)),control(1),...second.filter(x=>x.type==="IDAT").map(x=>{const data=Buffer.alloc(x.data.length+4);data.writeUInt32BE(sequence++,0);x.data.copy(data,4);return chunk("fdAT",data);}),chunk("IEND",Buffer.alloc(0))]);
 const parsed=chunks(file);
 assert.equal(parsed.find(x=>x.type==="acTL").data.readUInt32BE(0),2);
 assert.deepEqual(parsed.filter(x=>["fcTL","fdAT"].includes(x.type)).map(x=>x.data.readUInt32BE(0)),Array.from({length:sequence},(_,i)=>i));
 const decoded=await sharp(file).ensureAlpha().raw().toBuffer();
 const p=(20*width+40)*4;assert.deepEqual([...decoded.subarray(p,p+4)],[240,20,30,255],"independent PNG default frame decoder sees red first frame");
 return file;
}
const small=await apng(300,120),wide=await apng(9000,120);
await fs.writeFile(path.join(directory,"two-frame-small.png"),small);await fs.writeFile(path.join(directory,"two-frame-wide.png"),wide);
const report=[];
for(const name of ["chromium","firefox","webkit"]){
 const executablePath=process.env[`RASTER_${name.toUpperCase()}_EXECUTABLE`];
 const browser=await playwright[name].launch({headless:true,...(executablePath?{executablePath}:{})});
 try{
  for(const mobile of name==="firefox"?[false]:[false,true]){
   const context=await browser.newContext(mobile?{...playwright.devices["iPhone 13"],browserName:undefined}:{viewport:{width:1280,height:900}});
   try{
    const page=await context.newPage();await page.goto("about:blank");
    const result=await page.evaluate(async({code,small,wide})=>{
      const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));const module=await import(url);URL.revokeObjectURL(url);
      const file=(base64,name)=>new File([Uint8Array.from(atob(base64),x=>x.charCodeAt(0))],name,{type:"image/png"});
      const first=file(small,"two-frame-small.png"),large=file(wide,"two-frame-wide.png");
      const original=globalThis.createImageBitmap;
      let decodes=0;if(original)globalThis.createImageBitmap=(...args)=>{decodes++;return original(...args);};
      const unchanged=await module.prepareRasterUpload(first);const validDecodes=decodes;
      const badBytes=new Uint8Array(await large.arrayBuffer());new DataView(badBytes.buffer).setUint32(16,100000);new DataView(badBytes.buffer).setUint32(20,100000);
      let refused=false;try{await module.prepareRasterUpload(new File([badBytes],"declared-unsafe.png",{type:"image/png"}));}catch(error){refused=/memory/.test(error.message);}
      const refusedDecodes=decodes;
      const outputs=[];
      for(const mode of ["bitmap","html"]){
        if(mode==="bitmap"&&!original){outputs.push({mode,supported:false});continue;}
        if(mode==="html")globalThis.createImageBitmap=undefined;
        const prepared=await module.prepareRasterUpload(large);
        const outputUrl=URL.createObjectURL(prepared.file);const image=new Image();image.src=outputUrl;await image.decode();
        const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);
        const red=[...ctx.getImageData(100,30,1,1).data],alpha=[...ctx.getImageData(0,0,1,1).data];
        const bytes=new Uint8Array(await prepared.file.arrayBuffer());let animated=false;for(let off=8;off+12<=bytes.length;){const view=new DataView(bytes.buffer);const len=view.getUint32(off);if(String.fromCharCode(...bytes.subarray(off+4,off+8))==="acTL")animated=true;off+=len+12;}
        outputs.push({mode,supported:true,normalized:prepared.normalized,width:image.naturalWidth,height:image.naturalHeight,red,alpha,animatedOutput:animated,bytes:bytes.length});
        URL.revokeObjectURL(outputUrl);image.src="";canvas.width=canvas.height=0;
      }
      globalThis.createImageBitmap=original;
      return {unchanged:unchanged.file===first,validDecodes,refused,refusedDecodes,outputs};
    },{code,small:small.toString("base64"),wide:wide.toString("base64")});
    assert.equal(result.unchanged,true);assert.equal(result.validDecodes,0);assert.equal(result.refused,true);assert.equal(result.refusedDecodes,0);
    for(const out of result.outputs.filter(x=>x.supported)){assert.equal(out.normalized,true);assert.equal(out.width,8000);assert.equal(out.height,106);assert.deepEqual(out.red,[240,20,30,255]);assert.equal(out.alpha[3],0);assert.equal(out.animatedOutput,false);}
    report.push({browser:name,mobileEmulation:mobile,...result,status:"PASS"});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
}
await fs.writeFile(path.join(directory,"report.json"),JSON.stringify({fixture:{width:9000,height:120,frames:2,delaySeconds:1,bytes:wide.length},results:report},null,2));
console.log(JSON.stringify({configurations:report.length,normalizationPaths:report.flatMap(x=>x.outputs).filter(x=>x.supported).length,report:"tmp/run2-apng-preparation/report.json",results:report},null,2));
