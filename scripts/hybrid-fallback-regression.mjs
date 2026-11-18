import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const source = await readFile(new URL('../app/client/lib/tracing/useHybridTraceFetcher.ts', import.meta.url), 'utf8');
const dedupeSource = await readFile(new URL('../app/client/lib/converter/inFlightConversionDedupe.ts', import.meta.url), 'utf8');
function compile(source, require) {
    const exports = {};
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'exports', js)(require, exports);
    return exports;
}
async function harness({ hash, attempt } = {}) {
    const slots = [];
    let cursor = 0, rendered, queued = false;
    const effects = [];
    const submissions = [];
    const cache = new Map();
    const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
    const schedule = () => { if (!queued) {
        queued = true;
        queueMicrotask(() => { queued = false; render(); });
    } };
    const react = {
        useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(slots[i].value, next)) {
                slots[i].value = next;
                schedule();
            } }]; },
        useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
        useCallback(callback) { cursor++; return callback; },
        useMemo(callback) { cursor++; return callback(); },
        useEffect(callback, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) {
            const old = slots[i];
            slots[i] = { deps, cleanup: old?.cleanup };
            effects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback(); });
        } },
    };
    const fetcher = { data: undefined, state: 'idle', submit(target) { submissions.push(target); fetcher.state = 'submitting'; schedule(); } };
    const dedupe = compile(dedupeSource, () => { throw Error('Unexpected import'); });
    const hook = compile(source, name => {
        if (name === 'react')
            return react;
        if (name === 'react-router')
            return { useFetcher: () => fetcher };
        if (name.endsWith('buildConversionCacheKey'))
            return { buildConversionCacheKeyForFile: hash ?? (async (file) => ({ key: file.name })) };
        if (name.endsWith('conversionCache'))
            return { lookupConversionCache: key => cache.get(key), writeConversionCache: (key, value) => cache.set(key, value) };
        if (name.endsWith('inFlightConversionDedupe'))
            return dedupe;
        if (name.endsWith('vtracerWorkerClient'))
            return { SERVER_FIRST_LAYERED_TRACE_REASON: 'server-first', tryTraceRasterInClient: attempt ?? (async () => ({ ok: false, reason: 'Browser unavailable' })) };
        throw Error(`Unexpected import ${name}`);
    });
    function render() { cursor = 0; rendered = hook.useHybridTraceFetcher({ routeId: 'png-to-svg-converter' }); for (const effect of effects.splice(0))
        effect(); }
    function submit(id = 'job-1', filename = 'input.png', metadata = {}) { const form = new FormData(); form.set('file', new File(['x'], filename, { type: 'image/png' })); form.set('clientRunId', id); for (const [key, value] of Object.entries(metadata)) form.set(key, value); rendered.submit(form); }
    render();
    return { submit, submissions, cache, get current() { return rendered; }, respond(data) { fetcher.data = data; fetcher.state = 'idle'; schedule(); }, unmount() { for (const slot of slots)
            slot?.cleanup?.(); } };
}
const tick = async () => { for (let i = 0; i < 15; i++)
    await new Promise(resolve => setImmediate(resolve)); };
globalThis.window = {};
const failed = await harness();
failed.submit();
await tick();
assert.equal(failed.submissions.length, 1, 'initial browser failure submits one fallback');
failed.respond({ error: 'Unsupported input', code: 'UNSUPPORTED_FORMAT', clientRunId: 'job-1' });
await tick();
assert.equal(failed.submissions.length, 1, 'permanent server error must not resubmit the expensive request');
assert.equal(failed.current.data.error, 'Unsupported input');
assert.equal(failed.current.data.code, 'UNSUPPORTED_FORMAT');
assert.equal(failed.current.activeClientJobs, 0);
failed.unmount();
const hashing = deferred();
let attempts = 0;
const canceled = await harness({ hash: () => hashing.promise, attempt: async () => { attempts++; return { ok: false, reason: 'Browser unavailable' }; } });
canceled.submit();
canceled.current.cancelClientJob('job-1');
hashing.resolve({ key: 'pending-hash' });
await tick();
assert.equal(attempts, 0, 'cancellation while hashing must prevent tracing');
assert.equal(canceled.submissions.length, 0, 'cancellation while hashing must prevent server fallback');
assert.equal(canceled.current.activeClientJobs, 0);
canceled.unmount();
const pending = await harness();
pending.submit();
await tick();
pending.current.cancelClientJob('job-1');
await tick();
assert.equal(pending.current.activeClientJobs, 0, 'cancellation must release a pending server cache waiter');
pending.respond({ svg: '<svg/>', width: 1, height: 1, clientRunId: 'job-1' });
await tick();
assert.equal(pending.current.data, undefined, 'a canceled server response must not become output');
pending.unmount();
const success = await harness();
success.submit();
await tick();
success.respond({ svg: '<svg/>', width: 1, height: 1, clientRunId: 'job-1', engineUsed: 'potrace' });
await tick();
assert.equal(success.current.data.svg, '<svg/>');
assert.equal(success.current.data.clientRunId, 'job-1');
assert.equal(success.current.activeClientJobs, 0);
assert.equal(success.submissions.length, 1);
assert.equal(success.cache.size, 1);
success.unmount();
console.log('Hybrid fallback regression passed: terminal server errors, early cancellation, pending cancellation, late response suppression, successful cache ownership.');
const legacyCanceled = await harness();
legacyCanceled.submit();
await tick();
legacyCanceled.current.cancelClientJob('job-1');
legacyCanceled.current.cancelClientJob('unrelated-browser-job');
await tick();
legacyCanceled.respond({ svg: '<svg/>', width: 1, height: 1 });
await tick();
assert.equal(legacyCanceled.current.data, undefined, 'canceling another job must not unhide a canceled legacy server result');
legacyCanceled.unmount();
const noCache = await harness({ hash: async () => null });
noCache.submit();
await tick();
assert.equal(noCache.submissions.length, 1);
noCache.current.cancelClientJob('job-1');
noCache.respond({ svg: '<svg/>', width: 1, height: 1 });
await tick();
assert.equal(noCache.current.data, undefined, 'uncached server cancellation must suppress a legacy response');
noCache.unmount();
const joined = await harness();
joined.submit('original-job');
await tick();
joined.submit('joined-job');
await tick();
assert.equal(joined.submissions.length, 1, 'identical pending conversions share one server request');
joined.current.cancelClientJob('original-job');
joined.respond({ svg: '<svg/>', width: 1, height: 1, clientRunId: 'original-job' });
await tick();
assert.equal(joined.current.data.clientRunId, 'joined-job', 'canceling original consumer preserves ownership of joined successful result');
assert.equal(joined.current.activeClientJobs, 0);
joined.unmount();
const joinedError = await harness();
joinedError.submit('original-job');
await tick();
joinedError.submit('joined-job');
await tick();
joinedError.respond({ error: 'Please wait', code: 'BUSY', retryAfterMs: 12345, clientRunId: 'original-job' });
await tick();
assert.equal(joinedError.current.data.clientRunId, 'joined-job', 'deduplicated server error belongs to current consumer');
assert.equal(joinedError.current.data.retryAfterMs, 12345, 'server Retry-After metadata must survive terminal error handling');
assert.equal(joinedError.submissions.length, 1);
joinedError.unmount();
console.log('Hybrid legacy and shared-consumer regression passed.');

for (const status of [400, 403, 413, 415, 429, 500, 502, 503, 504]) {
    const handled = await harness();
    handled.submit();
    await tick();
    handled.respond({ error: `Handled server status ${status}`, code: `STATUS_${status}`, status, retryAfterMs: status === 429 ? 12000 : undefined, clientRunId: 'job-1' });
    await tick();
    assert.equal(handled.submissions.length, 1, `handled ${status} must not submit another fallback`);
    assert.equal(handled.current.data.status, status);
    assert.equal(handled.current.data.error, `Handled server status ${status}`);
    assert.equal(handled.current.data.retryAfterMs, status === 429 ? 12000 : undefined);
    assert.equal(handled.current.activeClientJobs, 0);
    handled.unmount();
}
console.log('Handled server error table passed: 400/403/413/415/429/500/502/503/504 are terminal; Retry-After survives.');

const ownedResponse = await harness();
ownedResponse.submit('consumer-1', 'owned.png', {requestId:'request-1',presetId:'outline'});
await tick();
ownedResponse.respond({svg:'<svg/>',width:1,height:1,engineUsed:'potrace',clientRunId:'consumer-1',requestId:'request-1',presetId:'outline'});
await tick();
assert.equal(ownedResponse.current.data.requestId,'request-1','mapped server success must retain route request identity');
assert.equal(ownedResponse.current.data.presetId,'outline');
ownedResponse.submit('consumer-2', 'owned.png', {requestId:'request-2',presetId:'outline'});
await tick();
assert.equal(ownedResponse.current.data.requestId,'request-2','cache hit must use current consumer request identity');
assert.equal(ownedResponse.current.data.clientRunId,'consumer-2');
assert.equal(ownedResponse.submissions.length,1);
ownedResponse.unmount();
const ownedClient = await harness({attempt:async()=>({ok:true,result:{svg:'<svg/>',width:1,height:1,engineUsed:'vtracer'}})});
ownedClient.submit('client-owned','owned-client.png',{requestId:'client-request',presetId:'color'});
await tick();
assert.equal(ownedClient.current.data.requestId,'client-request','browser success must retain request identity');
assert.equal(ownedClient.current.data.presetId,'color');
ownedClient.unmount();
const ownedJoin = await harness();
ownedJoin.submit('first-consumer','shared.png',{requestId:'first-request',presetId:'outline'});
await tick();
ownedJoin.submit('second-consumer','shared.png',{requestId:'second-request',presetId:'outline'});
await tick();
ownedJoin.respond({svg:'<svg/>',width:1,height:1,engineUsed:'potrace',requestId:'first-request'});
await tick();
assert.equal(ownedJoin.current.data.requestId,'second-request','shared result must use each consumer original FormData identity');
assert.equal(ownedJoin.submissions.length,1);
ownedJoin.unmount();
console.log('Route request identity regression passed: server, client, cache, and deduplicated consumers.');
