import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const logJson = async path => { const text = await readFile(path, 'utf8'); return JSON.parse(text.slice(text.indexOf('{'))); };
const conversion = [];
for (const engine of ['chromium','webkit']) for (const family of ['conversion','photo']) {
  const report = await read(`tmp/ad-safety/${family}-${engine}/report.json`);
  assert.ok(report.results.every(row => row.status === 'pass'));
  assert.ok(report.comparisons.every(row => row.sameSVG && row.sameBrowserPreviewPixels && row.sameRestoredPixels && row.sameStructure && row.sameEngine));
  conversion.push(report);
}
const navigation = { baseline: await logJson('tmp/ad-safety/navigation-baseline.log'), corrected: await logJson('tmp/ad-safety/navigation-browser-audit.log') };
const normalized = row => JSON.parse(JSON.stringify(row, (key,value) => key === 'consoleErrors' ? undefined : typeof value === 'string' ? value.replace(/http:\/\/127\.0\.0\.1:532[01]/g,'<LOCAL>') : value));
const navComparison = [];
for (const kind of ['mobile','desktop']) for (let i=0;i<navigation.baseline[kind].length;i++) {
  const before = normalized(navigation.baseline[kind][i]), after = normalized(navigation.corrected[kind][i]);
  navComparison.push({kind,width:before.width,sameMeasuredValues:JSON.stringify(before)===JSON.stringify(after),baselineFailure:before.failure,correctedFailure:after.failure,differingFields:Object.keys(before).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]))});
}
const focused = await read('tmp/ad-safety/focused-tests.json');
const exportLog = await readFile('tmp/ad-safety/converter-export-compression-smoke.log','utf8');
const exportResult = JSON.parse(exportLog.slice(exportLog.indexOf('\n{')+1));
const evidence = {
  releaseHead:'ea88da59e1d662bf41579821b6c496a64e905003',baseline:'c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4',
  stagedIntegration:'336c7a7a0043cb1bb6c1328ee225fb061e59d81a',
  mandatory:{node:'20.20.2',typecheck:'passed',build:'passed',npmTest:'passed',serverSyntax:'passed',bootstrapUnit:'passed',startup:'passed'},
  focused,
  focusedNote:'converter-export-compression initial Node20 runner failed because WebSocket is unavailable; Node25 harness rerun against the same Node20 server passed. No production runtime version changed.',
  conversionHarness:{source:'ai-issues/phase3/conversion-corpus.mjs',revision:'4d9e72d1372af2bdd2dff0edc0c51fbf7a074648',builds:['foundation','candidate'],network:'All off-origin requests blocked by Playwright route interception'},
  conversion,
  browserSuites:{monetization:await logJson('tmp/ad-safety/monetization-browser-smoke.log'),accessibility:await logJson('tmp/ad-safety/accessibility-smoke.log'),exportCompression:exportResult},
  navigation,navComparison,
  browserSuiteNote:'Existing assertions unchanged; offline-browser-runner adds only an unavailable outbound proxy with localhost bypass. Navigation reports network console failures in both baseline and corrected runs; preserve failures and compare measured behavior separately.',
  nativeMemory:await read('tmp/ad-safety/memory.log'),
  stagedLocal:{typecheck:'passed',build:'passed',npmTest:'passed',seo:'passed',schema:'passed',routes:'passed',monetization:'passed',serverSyntax:'passed',diffCheck:'passed'}
};
await writeFile('ai-issues/ad-safety/regression-results.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({downloadPairs:conversion.reduce((n,r)=>n+r.comparisons.length,0),navigation:navComparison}));
