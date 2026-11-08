import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import ts from 'typescript';
const source = await readFile(new URL('../app/client/lib/converter/prepareRasterUpload.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { prepareRasterUpload, readRasterHeader } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const jpeg = await sharp({ create: { width: 300, height: 200, channels: 3, background: 'red' } }).jpeg().toBuffer();
const comment = Buffer.alloc(60004, 65); comment[0] = 255; comment[1] = 254; comment.writeUInt16BE(60002, 2);
const ordinary = Buffer.concat([jpeg.subarray(0,2), ...Array(5).fill(comment), jpeg.subarray(2)]);
const metadata = await sharp(ordinary).metadata();
assert.equal(metadata.width, 300); assert.equal(metadata.height, 200);
const file = new File([ordinary], 'metadata.jpg', { type: 'image/jpeg' });
let message = null;
try { const prepared = await prepareRasterUpload(file); assert.equal(prepared.file, file); } catch (error) { message = error.message; }
console.log(JSON.stringify({ bytes:file.size, independentlyDecodedDimensions:[metadata.width,metadata.height], preparationError:message }));
assert.equal(message, null, 'a supported ordinary JPEG with large legal metadata should retain its successful path');
class ProbedFile extends File {
  bytesRead = 0;
  reads = 0;
  slice(start, end, type) {
    const part = super.slice(start, end, type);
    this.bytesRead += part.size;
    this.reads++;
    return part;
  }
}
const largeMetadata = new ProbedFile([ordinary], 'metadata.jpg', {type:'image/jpeg'});
assert.deepEqual(await readRasterHeader(largeMetadata), {width:300,height:200,mime:'image/jpeg'});
assert.ok(largeMetadata.bytesRead <= 256 * 1024, 'metadata payloads must be skipped, not read in full');
assert.ok(largeMetadata.bytesRead < ordinary.length / 10, 'large metadata should need only a small header probe');

const oriented = await sharp(jpeg).withMetadata({orientation:6}).jpeg().toBuffer();
const segments = [];
let cursor = 2;
while (cursor + 4 <= oriented.length && oriented[cursor + 1] !== 0xda) {
  const length = oriented.readUInt16BE(cursor + 2);
  segments.push({kind:oriented[cursor+1],data:oriented.subarray(cursor,cursor+length+2)});
  cursor += length + 2;
}
const exif = segments.find(part=>part.kind===0xe1 && part.data.subarray(4,10).toString()==='Exif\0\0');
assert.ok(exif, 'fixture must contain real EXIF orientation');
const relocated = [oriented.subarray(0,2)];
for (const part of segments) {
  if (part === exif) continue;
  relocated.push(part.data);
  if (part.kind===0xc0) relocated.push(exif.data);
}
relocated.push(oriented.subarray(cursor));
const lateExif = Buffer.concat(relocated);
const decoded = await sharp(lateExif).rotate().toBuffer({resolveWithObject:true});
assert.deepEqual([decoded.info.width, decoded.info.height], [200,300]);
assert.deepEqual(await readRasterHeader(new File([lateExif],'oriented.jpg',{type:'image/jpeg'})), {width:200,height:300,mime:'image/jpeg'});

const manySegments = new ProbedFile([jpeg.subarray(0,2), ...Array(513).fill(Buffer.from([255,254,0,2])), jpeg.subarray(2)], 'many.jpg',{type:'image/jpeg'});
await assert.rejects(readRasterHeader(manySegments), /safely read/);
assert.ok(manySegments.bytesRead <= 256*1024, 'segment count rejection stays bounded');
const paddedMarker = Buffer.concat([Buffer.alloc(256,255), Buffer.from([1])]);
const manyFillBytes = new ProbedFile([jpeg.subarray(0,2), ...Array(511).fill(paddedMarker), jpeg.subarray(2)], 'fill.jpg',{type:'image/jpeg'});
await assert.rejects(readRasterHeader(manyFillBytes), /metadata.*safely/);
assert.ok(manyFillBytes.reads <= 2048, 'fill-byte inspection must bound asynchronous reads globally');
console.log('PASS bounded JPEG segment skipping, preserved original file, late EXIF orientation and metadata scan budget.');
const webpExif = await sharp({create:{width:9000,height:120,channels:4,background:'red'}}).webp().withMetadata({orientation:6}).toBuffer();
const webpHeader = await readRasterHeader(new File([webpExif],'oriented.webp',{type:'image/webp'}));
assert.equal(webpHeader.hasExif, true, 'WebP extended header must identify EXIF without decoding');
await assert.rejects(prepareRasterUpload(new File([webpExif],'oriented.webp',{type:'image/webp'})), /correct orientation/);
const validWebpExif = new File([await sharp(jpeg).webp().withMetadata({orientation:6}).toBuffer()],'valid.webp',{type:'image/webp'});
assert.equal((await prepareRasterUpload(validWebpExif)).file, validWebpExif, 'valid WebP metadata and bytes remain untouched');
console.log('PASS over-limit EXIF WebP rejects before decoding; ordinary EXIF WebP remains unchanged.');
