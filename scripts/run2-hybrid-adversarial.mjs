import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Reuse the existing executable hook harness; exercise combinations absent from
// the initial regression suite without making the worker/server mocks bigger.
const source = await readFile(new URL('../app/client/lib/tracing/useHybridTraceFetcher.ts', import.meta.url), 'utf8');
const dedupeSource = await readFile(new URL('../app/client/lib/converter/inFlightConversionDedupe.ts', import.meta.url), 'utf8');
const suite = await readFile(new URL('./hybrid-fallback-regression.mjs', import.meta.url), 'utf8');
const prefix = suite.slice(suite.indexOf('function deferred()'), suite.indexOf('globalThis.window = {}'))
  .replace(/^const source = .*\r?\n/m, '').replace(/^const dedupeSource = .*\r?\n/m, '')
  .replace('const submissions = [];', 'const submissions = []; const observed = [];')
  .replace("rendered = hook.useHybridTraceFetcher({ routeId: 'png-to-svg-converter' });", "rendered = hook.useHybridTraceFetcher({ routeId: 'png-to-svg-converter' }); observed.push(rendered.data);")
  .replace('return { submit, submissions, cache,', 'return { submit, submissions, cache, observed, get queuedOutcomeCount() { return slots.filter(slot => Array.isArray(slot?.current)).reduce((count,slot) => count + slot.current.length, 0); },');
const harness = eval(`${prefix}\nharness;`);
const tick = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)); };
globalThis.window = {};
const failures = [];

let resolveAttempt;
const attempt = new Promise(resolve => { resolveAttempt = resolve; });
const joined = await harness({ attempt: () => attempt });
joined.submit('producer', 'same.png'); await tick();
joined.submit('consumer', 'same.png'); await tick();
resolveAttempt({ ok: false, reason: 'Worker initialization unavailable' }); await tick();
if (joined.submissions.length !== 1) failures.push({ test: 'join-before-browser-failure', expectedPosts: 1, actualPosts: joined.submissions.length, error: joined.current.data?.error, activeJobs: joined.current.activeClientJobs });
joined.respond({ svg: '<svg/>', width: 2, height: 2, clientRunId: 'producer' }); await tick();
assert.equal(joined.current.data.clientRunId, 'consumer');
assert.equal(joined.current.activeClientJobs, 0);
joined.unmount();

const replacement = await harness();
replacement.submit('old', 'old.png'); await tick();
assert.equal(replacement.submissions.length, 1);
replacement.submit('new', 'new.png'); await tick();
assert.equal(replacement.submissions.length, 2);
assert.equal(replacement.current.data.clientRunId, 'old', 'superseded error retains original job ownership');
assert.match(replacement.current.data.error, /earlier server conversion.*replaced/);
// React Router's single fetcher supersedes its earlier server request. The old
// request may never deliver data after cancellation; only the new result arrives.
replacement.respond({ svg: '<svg/>', width: 2, height: 2, clientRunId: 'new', engineUsed: 'potrace' }); await tick();
if (replacement.current.activeClientJobs !== 0) failures.push({ test: 'server-fallback-replacement', expectedActiveJobs: 0, actualActiveJobs: replacement.current.activeClientJobs, outputOwner: replacement.current.data?.clientRunId });
replacement.respond({ svg: '<svg>old</svg>', width: 5, height: 5, clientRunId: 'old' }); await tick();
assert.equal(replacement.current.data.clientRunId, 'new', 'late superseded server response cannot replace the newest result');
replacement.unmount();

const threeConsumers = await harness();
threeConsumers.submit('one', 'three-shared.png'); await tick();
threeConsumers.submit('two', 'three-shared.png'); await tick();
threeConsumers.submit('three', 'three-shared.png'); await tick();
threeConsumers.respond({ svg:'<svg/>', width:2, height:2, clientRunId:'one' }); await tick();
for (const id of ['one','two','three']) {
  assert.ok(threeConsumers.observed.some(data => data?.svg && data.clientRunId === id), `shared consumer ${id} must publish its owned success to route history`);
}
threeConsumers.unmount();

const supersededGroup = await harness();
supersededGroup.submit('group-one', 'group.png'); await tick();
supersededGroup.submit('group-two', 'group.png'); await tick();
supersededGroup.submit('replacement', 'different.png'); await tick();
for (const id of ['group-one','group-two']) {
  assert.ok(supersededGroup.observed.some(data => data?.error && data.clientRunId === id), `superseded consumer ${id} must publish its owned error to route history`);
}
supersededGroup.respond({svg:'<svg/>',width:2,height:2,clientRunId:'replacement'}); await tick();
assert.equal(supersededGroup.current.data.clientRunId,'replacement');
assert.equal(supersededGroup.current.activeClientJobs,0);
supersededGroup.unmount();

const svgReplacement = await harness();
svgReplacement.submit('old-raster', 'raster.png'); await tick();
svgReplacement.submit('new-svg', 'replacement.svg'); await tick();
svgReplacement.respond({ svg: '<svg/>', width: 2, height: 2, clientRunId: 'new-svg' }); await tick();
assert.equal(svgReplacement.current.activeClientJobs, 0, 'direct SVG submission also settles superseded raster waiter');
svgReplacement.unmount();

let releaseSharedAttempt;
const sharedAttempt = new Promise(resolve => { releaseSharedAttempt = resolve; });
const canceledProducer = await harness({ attempt: () => sharedAttempt });
canceledProducer.submit('canceled-producer', 'shared.png'); await tick();
canceledProducer.submit('remaining-consumer', 'shared.png'); await tick();
canceledProducer.current.cancelClientJob('canceled-producer');
releaseSharedAttempt({ ok: false, reason: 'Worker failed' }); await tick();
assert.equal(canceledProducer.submissions.length, 1, 'remaining shared consumer retains supported fallback after producer consumer canceled');
canceledProducer.respond({ svg: '<svg/>', width: 2, height: 2, clientRunId: 'canceled-producer' }); await tick();
assert.equal(canceledProducer.current.data.clientRunId, 'remaining-consumer');
assert.equal(canceledProducer.observed.some(data => data?.svg && data.clientRunId === 'canceled-producer'), false, 'canceled producer response must never surface even transiently to route history');
assert.equal(canceledProducer.current.activeClientJobs, 0);
canceledProducer.unmount();

let releaseOldHash;
const oldHash = new Promise(resolve => { releaseOldHash = resolve; });
const hashOrder = await harness({ hash: file => file.name === 'slow.png' ? oldHash : Promise.resolve({key:file.name}) });
hashOrder.submit('old-slow', 'slow.png');
hashOrder.submit('new-fast', 'fast.png'); await tick();
releaseOldHash({key:'slow.png'}); await tick();
assert.equal(hashOrder.submissions.length, 1, 'out-of-order old hash cannot submit stale different-source fallback');
hashOrder.respond({ svg:'<svg/>', width:2, height:2, clientRunId:'new-fast' }); await tick();
assert.equal(hashOrder.current.data.clientRunId, 'new-fast');
assert.equal(hashOrder.current.activeClientJobs, 0);
hashOrder.unmount();

const compiledDedupe = {};
new Function('exports', ts.transpileModule(dedupeSource, { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText)(compiledDedupe);
let releaseCanceledProducer;
const canceledWork = compiledDedupe.acquireInFlightConversion('cancel-retry', () => new Promise(resolve => { releaseCanceledProducer = resolve; }));
await tick();
canceledWork.cancel();
const retry = compiledDedupe.acquireInFlightConversion('cancel-retry', async () => ({svg:'fresh'}));
assert.equal(retry.shared, false, 'immediate retry must not join an already-aborted producer');
assert.equal(retry.signal.aborted, false);
assert.equal((await retry.promise).svg, 'fresh');
releaseCanceledProducer({svg:'old'}); await canceledWork.promise;
retry.release();
assert.equal(compiledDedupe.getInFlightConversionCountForTests(), 0);

// Hold only mock React renders; native promise settlement still occurs. This
// verifies cancellation/unmount after a result settles but before publication.
for (const action of ['cancel', 'unmount']) {
  const queued = await harness({ attempt:async()=>({ok:true,result:{svg:'<svg/>',width:2,height:2,engineUsed:'vtracer'}}) });
  const scheduled = [], originalQueueMicrotask = globalThis.queueMicrotask;
  globalThis.queueMicrotask = callback => scheduled.push(callback);
  try {
    queued.submit(`queued-${action}`,`${action}.png`); await tick();
    assert.equal(queued.queuedOutcomeCount, 1, 'settled result is retained only until its publication render');
    if (action === 'cancel') queued.current.cancelClientJob(`queued-${action}`);
    else queued.unmount();
    for (let guard=0; scheduled.length && guard<20; guard++) scheduled.shift()();
    assert.equal(queued.queuedOutcomeCount, 0, `${action} releases queued SVG references`);
    assert.equal(queued.observed.some(data => data?.svg), false, `${action} before publication must not expose the queued result`);
  } finally { globalThis.queueMicrotask = originalQueueMicrotask; queued.unmount(); }
}

console.log(JSON.stringify({ failures }, null, 2));
assert.deepEqual(failures, [], 'deduplicated browser failure and server replacement must settle without stale results or hangs');
