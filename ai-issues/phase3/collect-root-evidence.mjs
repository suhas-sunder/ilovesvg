import {readFile,writeFile,copyFile} from 'node:fs/promises';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const grid=report=>({base:report.base,results:report.results.map(r=>({...r,violations:r.violations?.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,examples:v.nodes.slice(0,2)})),facts:r.facts?{h1:r.facts.h1,width:r.facts.width,canonical:r.facts.canonical,slots:r.facts.slots,keyboardStart:r.facts.keyboardStart}:undefined}))});
const report={exactTrackedTree:'7bc288cb5b4076101de77d8c1c042be901020417',integratedCommit:'abf58b7886338b6d1b07a0501cab7f3bc7eb1b8f',note:'The initial 5302 grid was a working build (first PNG fix present), not an exact-head proof. A–F content was unchanged; final 5303 retests use the immutable recorded tree.',initial:grid(await read('tmp/phase3/content/report.json')),decodedExamples:grid(await read('tmp/phase3/content-decoded-final/report.json')),final:grid(await read('tmp/phase3/content-final/report.json')),author:await read('tmp/phase3/author/report.json'),background:await read('tmp/phase3/background/report.json'),examples:await read('tmp/phase3/examples-final/report.json'),craft:await read('tmp/phase3/craft/report.json'),mobile:await read('tmp/phase3/mobile-corrected-baseline/report.json'),focusedTests:await read('tmp/phase3/focused-tests.json'),adComparison:await read('tmp/phase3/ad-stable-comparison.json')};
// Preserve actual ad states and first findings; omit hundreds of repeated navigation targets.
for(const label of ['before','after']){const r=await read(`tmp/phase3/ads-stable-${label}/report.json`);report['ads'+label]=grid(r);}
await writeFile('ai-issues/phase3/content-ad-results.json',JSON.stringify(report,null,2));
for(const engine of ['chromium','webkit'])await copyFile(`tmp/phase3/ads-stable-after/${engine}-1440-fill.png`,`ai-issues/phase3/screenshots/ad-mock-${engine}.png`);
const memory=await read('tmp/phase3/native-memory.log');
await writeFile('ai-issues/phase3/native-memory-results.json',JSON.stringify(memory,null,2));
const proof=await readFile('ai-issues/phase3/ci-runtime-proof.txt','utf8');await writeFile('ai-issues/phase3/ci-runtime-proof.txt',proof.replace(/\x1b\[[0-9;]*m/g,''));
