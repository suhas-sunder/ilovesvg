import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const routes = [
    "png-to-svg-converter", "jpg-to-svg-converter", "jpeg-to-svg-converter",
    "webp-to-svg-converter", "logo-to-svg-converter", "scan-to-svg-converter",
    "image-to-svg-outline", "photo-to-svg-outline",
];
const failures = [];
function runEffect(callback, data) {
    const observed = { timers: 0, error: null, info: null, history: [] };
    const context = {
        fetcher: { data },
        file: null, settings: {}, activePreset: "test",
        setErr: value => { observed.error = value; },
        setInfo: value => { observed.info = value; },
        setTimeout: () => { observed.timers++; return 1; }, clearTimeout: () => { },
        findSubmittedTrace: () => null,
        retryTimeoutRef: { current: null },
        latestPlanRef: { current: { requestId: "request-1", presetId: "line", settings: {} } },
        lastAcceptedRequestIdRef: { current: "" },
        pendingOutputSettingsRef: { current: {} }, pendingReplaceStampRef: { current: null },
        getPresetLabel: id => id, createClientRequestId: () => "new-request",
        setHistory: update => { observed.history = update(observed.history); },
        setUpdatingOutputStamp: () => { },
    };
    // Execute the actual effect callback against controlled input/state. This
    // catches accidental deletion of co-located result handling as well as retries.
    const javascript = ts.transpileModule(`const callback = ${callback};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("context", `with (context) { ${javascript}; return callback(); }`)(context);
    return observed;
}
for (const route of routes) {
    const source = await readFile(new URL(`../app/routes/${route}.tsx`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(`${route}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const effects = [];
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "React.useEffect") {
            const text = node.getText(ast);
            if (text.includes("retryAfterMs") && text.includes("fetcher.data") && text.includes("setInfo("))
                effects.push(node);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(effects.length, 1, `${route} has one server recovery effect`);
    const callback = effects[0].arguments[0].getText(ast);
    for (const code of ["BUSY", "RATE_LIMITED"]) {
        const observed = runEffect(callback, {
            error: "Please wait before trying again.", retryAfterMs: 12500, code,
        });
        if (observed.timers)
            failures.push(`${route}/${code}: scheduled ${observed.timers} automatic retries`);
        if (!observed.error)
            failures.push(`${route}/${code}: hid the server rejection`);
        if (!/13/.test(observed.error || ""))
            failures.push(`${route}/${code}: missing rounded-up Retry-After guidance`);
    }
    assert.ok(!source.includes("We'll retry automatically."), `${route} server message must match manual recovery`);
    if (route === "image-to-svg-outline") {
        const observed = runEffect(callback, {
            svg: "<svg><path d='M0 0h10v10z'/></svg>", width: 10, height: 10,
            requestId: "request-1", presetId: "line", layers: [],
        });
        assert.equal(observed.history.length, 1, "outline success must still create a history result");
        assert.equal(observed.history[0].requestId, "request-1");
        assert.equal(observed.history[0].width, 10);
        assert.match(observed.history[0].svg, /path/);
    }
}
assert.deepEqual(failures, [], "busy/rate-limited conversions must preserve Retry-After and avoid background retry storms");
console.log(`Server retry regression passed: ${routes.length} routes, BUSY/429 responses, no automatic submissions, outline result history preserved.`);
