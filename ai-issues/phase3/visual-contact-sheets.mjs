import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
const folder=process.env.FOLDER||'tmp/phase3/content';
await mkdir('ai-issues/phase3/screenshots',{recursive:true});
for(const id of (process.env.PACKAGE?[process.env.PACKAGE]:['A','B','C','D','E','F']))for(const engine of ['chromium','webkit']){
 const tiles=[];
 for(const [i,width]of [320,375,390,430,768,1024,1440,1920].entries()){
  const image=await sharp(`${folder}/${id}-${engine}-${width}-content.jpg`).resize({width:360,height:1035,fit:'contain',background:'#e2e8f0'}).png().toBuffer();
  const title=Buffer.from(`<svg width="360" height="25"><rect width="360" height="25" fill="#fff"/><text x="8" y="18" font-size="16">${id} ${engine} ${width}px</text></svg>`);
  tiles.push({input:image,left:i%4*360,top:Math.floor(i/4)*1060+25},{input:title,left:i%4*360,top:Math.floor(i/4)*1060});
 }
 await sharp({create:{width:1440,height:2120,channels:3,background:'#e2e8f0'}}).composite(tiles).jpeg({quality:82}).toFile(`ai-issues/phase3/screenshots/${id}-${engine}.jpg`);
}
