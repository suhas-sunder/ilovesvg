import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../app/client/lib/monetization/adPlaceholderSafety.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
// Import is SSR-safe; the browser code is a static string, not executed here.
const { AD_PLACEHOLDER_SAFETY_SCRIPT: bootstrap } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const marker = "data-ad-placeholders-suppressed";
function session(initial = null) {
  const attributes = new Map();
  const observers = [];
  let writes = 0;
  const root = {
    getAttribute: (key) => attributes.get(key) ?? null,
    setAttribute: (key, value) => { writes++; attributes.set(key, value); },
    querySelector: () => initial,
  };
  class Observer {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
    observe(target, options) { assert.equal(target, root); this.active = true; this.options = options; }
    disconnect() { this.active = false; }
  }
  const context = vm.createContext({ document: { documentElement: root }, MutationObserver: Observer });
  const run = () => vm.runInContext(bootstrap, context);
  return {
    run, observers, root,
    send(records) { for (const observer of observers) if (observer.active) observer.callback(records); },
    suppressed: () => root.getAttribute(marker) === "true",
    writes: () => writes,
  };
}
function slot(status = null, isAd = true) {
  return {
    status, nodeType: 1, firstElementChild: null,
    matches(selector) { return isAd && (selector === "ins.adsbygoogle" || this.status === "filled"); },
    getAttribute(key) { return key === "data-ad-status" ? this.status : null; },
  };
}
function transition(target, oldValue = null, attributeName = "data-ad-status") {
  return { target, type: "attributes", attributeName, oldValue };
}
const page = session();
page.run(); page.run();
assert.equal(page.observers.length, 1, "double installation cannot create duplicate observers");
assert.equal(page.observers[0].options.attributeOldValue, true);
for (const state of [null, "pending", "done", "unfilled", "unfill-optimized"]) {
  page.send([transition(slot(state))]);
  assert.equal(page.suppressed(), false, `${state} is not a fill marker`);
}
page.send([transition(slot("filled", false)), transition(slot(), "filled", "style")]);
assert.equal(page.suppressed(), false, "unrelated elements and attributes cannot trigger fill");
page.send([{ type: "childList", addedNodes: [slot(null, false)], removedNodes: [] }]);
assert.equal(page.suppressed(), false, "a pending iframe/ordinary node is not fill proof");

page.send([transition(slot("filled"))]);
assert.equal(page.suppressed(), true);
assert.equal(page.observers[0].active, false, "the observer disconnects permanently after fill");
assert.equal(page.root.__iloveSvgAdPlaceholderObserver, undefined, "observer reference is released");
for (let i = 0; i < 1000; i++) { page.send([transition(slot("unfilled"), "filled")]); page.run(); }
assert.equal(page.writes(), 1);
assert.equal(page.observers.length, 1);

const delayed = session(); delayed.run();
delayed.send([transition(slot("unfilled"), "filled")]);
assert.equal(delayed.suppressed(), true, "a delayed filled-to-unfilled transition retains fill evidence");
for (const key of ["addedNodes", "removedNodes"]) {
  const detached = session(); detached.run();
  detached.send([{ type: "childList", addedNodes: [], removedNodes: [], [key]: [slot("filled")] }]);
  assert.equal(detached.suppressed(), true, `${key} retains pre-populated/detached fill evidence`);
}
const existing = session(slot("filled")); existing.run();
assert.equal(existing.suppressed(), true, "already-present filled slots are detected at installation");
const fresh = session(); fresh.run();
assert.equal(fresh.suppressed(), false, "a new document starts a new session without cross-request SSR state");
console.log("Ad safety bootstrap: fill classification, delayed/removal records, idempotence, observer cleanup and document isolation passed.");
