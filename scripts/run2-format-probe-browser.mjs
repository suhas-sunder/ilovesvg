import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const source = await readFile(new URL('../app/client/lib/converter/prepareRasterUpload.ts', import.meta.url), 'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const webp=await sharp({create:{width:9000,height:120,channels:3,background:'red'}}).webp().withMetadata({orientation:6}).toBuffer();
const smallWebp=await sharp({create:{width:120,height:60,channels:3,background:'red'}}).webp().withMetadata({orientation:6}).toBuffer();
assert.equal((await sharp(webp).metadata()).orientation,6);
const {info:rotatedInfo}=await sharp(webp).autoOrient().png().toBuffer({resolveWithObject:true});
assert.deepEqual([rotatedInfo.width,rotatedInfo.height],[120,9000]);
const raw=Buffer.alloc(9000*240*3);for(let p=0;p<9000*240;p++)raw[p*3+(p<9000*120?0:2)]=255;
const animated=await sharp(raw,{raw:{width:9000,height:240,channels:3,pageHeight:120}}).webp({lossless:true,loop:0,delay:[100,100]}).toBuffer();
const red=await sharp({create:{width:9000,height:120,channels:4,background:'red'}}).png().toBuffer();
const blue=await sharp({create:{width:9000,height:120,channels:4,background:'blue'}}).png().toBuffer();
function chunk(kind,data){const name=Buffer.from(kind),body=Buffer.concat([name,data]);let crc=0xffffffff;for(const byte of body){crc^=byte;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}const size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,body,sum]);}
function idat(png){const chunks=[];for(let offset=8;offset+12<=png.length;){const length=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8);if(kind==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=12+length;}return Buffer.concat(chunks);}
function frame(sequence){const data=Buffer.alloc(26);data.writeUInt32BE(sequence);data.writeUInt32BE(9000,4);data.writeUInt32BE(120,8);data.writeUInt16BE(1,20);data.writeUInt16BE(10,22);return data;}
const animationControl=Buffer.alloc(8);animationControl.writeUInt32BE(2);const sequence=Buffer.alloc(4);sequence.writeUInt32BE(2);
const apng=Buffer.concat([red.subarray(0,8),chunk('IHDR',red.subarray(16,29)),chunk('acTL',animationControl),chunk('fcTL',frame(0)),chunk('IDAT',idat(red)),chunk('fcTL',frame(1)),chunk('fdAT',Buffer.concat([sequence,idat(blue)])),chunk('IEND',Buffer.alloc(0))]);
const browserName=process.env.RUN2_PROBE_BROWSER||'chromium'; const browser=await pw[browserName].launch({headless:true,...(process.env['RASTER_'+browserName.toUpperCase()+'_EXECUTABLE']?{executablePath:process.env['RASTER_'+browserName.toUpperCase()+'_EXECUTABLE']}: {})});
try{
 const page=await browser.newPage();
 const result=await page.evaluate(async({code,webp,smallWebp,animated,apng})=>{
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));const module=await import(url);URL.revokeObjectURL(url);
  const make=(encoded)=>new File([Uint8Array.from(atob(encoded),x=>x.charCodeAt(0))],'probe.webp',{type:'image/webp'});
  const oriented=make(webp),header=await module.readRasterHeader(oriented),bitmap=await createImageBitmap(oriented);const decoded=[bitmap.width,bitmap.height];bitmap.close();
  const saved=createImageBitmap;let orientedError=null,orientedDecodes=0,orientedPrepares=0,ordinaryPreserved=false;
  globalThis.createImageBitmap=(...args)=>{orientedDecodes++;return saved(...args);};
  try{
   try{await module.prepareRasterUpload(oriented,()=>orientedPrepares++);}catch(e){orientedError=e.message;}
   const ordinary=make(smallWebp),result=await module.prepareRasterUpload(ordinary,()=>orientedPrepares++);
   ordinaryPreserved=result.file===ordinary && result.normalized===false && result.header.hasExif===true;
  }finally{globalThis.createImageBitmap=saved;}
  const first=await module.prepareRasterUpload(make(animated));globalThis.createImageBitmap=undefined;const second=await module.prepareRasterUpload(make(animated));globalThis.createImageBitmap=saved;
  const makePng=()=>new File([Uint8Array.from(atob(apng),x=>x.charCodeAt(0))],'animated.png',{type:'image/png'});
  const pngFirst=await module.prepareRasterUpload(makePng());globalThis.createImageBitmap=undefined;const pngSecond=await module.prepareRasterUpload(makePng());globalThis.createImageBitmap=saved;
  async function color(file){const b=await saved(file),c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d');ctx.drawImage(b,0,0);b.close();return[...ctx.getImageData(10,10,1,1).data];}
  return {header,decoded,orientedError,orientedDecodes,orientedPrepares,ordinaryPreserved,animation:{bitmapColor:await color(first.file),htmlColor:await color(second.file),outputTypes:[first.file.type,second.file.type],headers:[first.header,second.header]},apng:{bitmapColor:await color(pngFirst.file),htmlColor:await color(pngSecond.file),headers:[pngFirst.header,pngSecond.header]}};
 },{code,webp:webp.toString('base64'),smallWebp:smallWebp.toString('base64'),animated:animated.toString('base64'),apng:apng.toString('base64')});
 assert.match(result.orientedError,/Export it as PNG or JPEG with the correct orientation/);
 assert.equal(result.header.hasExif,true);
 assert.equal(result.orientedDecodes,0);
 assert.equal(result.orientedPrepares,0);
 assert.equal(result.ordinaryPreserved,true);
 assert.deepEqual(result.decoded,[9000,120]);
 for(const kind of ['animation','apng']){
  assert.deepEqual(result[kind].bitmapColor,[255,0,0,255]);
  assert.deepEqual(result[kind].htmlColor,[255,0,0,255]);
  assert.deepEqual(result[kind].headers,[{width:8000,height:106,mime:'image/png'},{width:8000,height:106,mime:'image/png'}]);
 }
 console.log(JSON.stringify({browser:browserName,...result},null,2));
}finally{await browser.close();}
