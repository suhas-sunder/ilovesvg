import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(root, "app", "utils", "boundedStore.ts");
const helperSource = await readFile(helperPath, "utf8");
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: helperPath,
  reportDiagnostics: true,
});

assert.deepEqual(
  transpiled.diagnostics ?? [],
  [],
  "boundedStore.ts should transpile without diagnostics",
);

const helperUrl = `data:text/javascript;base64,${Buffer.from(
  transpiled.outputText,
).toString("base64")}`;
const {
  BATCH_SESSION_STORE_MAX_ENTRIES,
  ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES,
  SHARED_RATE_LIMIT_STORE_MAX_ENTRIES,
  createRateLimitCapacityHeaders,
  getOrCreateBoundedStoreEntry,
  getOrCreateResetAtRateLimitEntry,
  pruneExpiredEntries,
} = await import(helperUrl);

assert.equal(SHARED_RATE_LIMIT_STORE_MAX_ENTRIES, 20_000);
assert.equal(ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES, 5_000);
assert.equal(BATCH_SESSION_STORE_MAX_ENTRIES, 2_000);

const now = 1_000_000;
const expiryStore = new Map([
  ["expired", { expiresAt: now }],
  ["active", { expiresAt: now + 1 }],
]);
const sessionExpired = (record, at) => record.expiresAt <= at;
assert.equal(pruneExpiredEntries(expiryStore, now, sessionExpired), 1);
assert.deepEqual([...expiryStore.keys()], ["active"]);
assert.equal(pruneExpiredEntries(expiryStore, now, sessionExpired), 0);

const fullStore = new Map([
  ["first", { count: 4, expiresAt: now + 5_000 }],
  ["second", { count: 2, expiresAt: now + 9_000 }],
]);
const firstBefore = structuredClone(fullStore.get("first"));
const existingAdmission = getOrCreateBoundedStoreEntry({
  store: fullStore,
  key: "first",
  now,
  maxEntries: 2,
  create: () => ({ count: 0, expiresAt: now + 10_000 }),
  isExpired: sessionExpired,
  getExpiresAt: (record) => record.expiresAt,
  pruneStride: 1,
});
assert.equal(existingAdmission.admitted, true);
assert.equal(existingAdmission.existing, true);
assert.deepEqual(fullStore.get("first"), firstBefore);
existingAdmission.value.count += 1;
assert.equal(fullStore.get("first").count, 5);
assert.equal(fullStore.size, 2);

const rejectedAdmission = getOrCreateBoundedStoreEntry({
  store: fullStore,
  key: "new-key",
  now,
  maxEntries: 2,
  create: () => ({ count: 0, expiresAt: now + 10_000 }),
  isExpired: sessionExpired,
  getExpiresAt: (record) => record.expiresAt,
  pruneStride: 1,
});
assert.equal(rejectedAdmission.admitted, false);
assert.equal(rejectedAdmission.retryAfterMs, 5_000);
assert.deepEqual([...fullStore.keys()], ["first", "second"]);

const pruneAtCapacityStore = new Map([
  ["expired", { expiresAt: now }],
  ["active", { expiresAt: now + 8_000 }],
]);
const admittedAfterPrune = getOrCreateBoundedStoreEntry({
  store: pruneAtCapacityStore,
  key: "new-key",
  now,
  maxEntries: 2,
  create: () => ({ expiresAt: now + 12_000 }),
  isExpired: sessionExpired,
  getExpiresAt: (record) => record.expiresAt,
  pruneStride: 1,
});
assert.equal(admittedAfterPrune.admitted, true);
assert.equal(admittedAfterPrune.pruned, 1);
assert.deepEqual([...pruneAtCapacityStore.keys()], ["active", "new-key"]);

const windows = [
  { name: "minute" },
  { name: "day" },
];
const partiallyActiveRateStore = new Map([
  [
    "active",
    {
      minute: { count: 0, resetAt: now },
      day: { count: 7, resetAt: now + 20_000 },
    },
  ],
]);
const partialAdmission = getOrCreateResetAtRateLimitEntry(
  partiallyActiveRateStore,
  "new-key",
  now,
  1,
  windows,
  () => ({
    minute: { count: 0, resetAt: now + 60_000 },
    day: { count: 0, resetAt: now + 86_400_000 },
  }),
);
assert.equal(partialAdmission.admitted, false);
assert.equal(partiallyActiveRateStore.get("active").day.count, 7);

partiallyActiveRateStore.get("active").day.resetAt = now;
const resetAtAdmission = getOrCreateResetAtRateLimitEntry(
  partiallyActiveRateStore,
  "new-key",
  now,
  1,
  windows,
  () => ({
    minute: { count: 0, resetAt: now + 60_000 },
    day: { count: 0, resetAt: now + 86_400_000 },
  }),
);
assert.equal(resetAtAdmission.admitted, true);
assert.equal(resetAtAdmission.pruned, 1);
assert.deepEqual([...partiallyActiveRateStore.keys()], ["new-key"]);

const windowStartStore = new Map([
  ["active", { windowStart: now - 59_999, count: 3 }],
]);
const windowStartAdmission = getOrCreateBoundedStoreEntry({
  store: windowStartStore,
  key: "new-key",
  now,
  maxEntries: 1,
  create: () => ({ windowStart: now, count: 0 }),
  isExpired: (record, at) => at >= record.windowStart + 60_000,
  getExpiresAt: (record) => record.windowStart + 60_000,
  pruneStride: 1,
});
assert.equal(windowStartAdmission.admitted, false);
windowStartStore.get("active").windowStart = now - 60_000;
assert.equal(
  getOrCreateBoundedStoreEntry({
    store: windowStartStore,
    key: "new-key",
    now,
    maxEntries: 1,
    create: () => ({ windowStart: now, count: 0 }),
    isExpired: (record, at) => at >= record.windowStart + 60_000,
    getExpiresAt: (record) => record.windowStart + 60_000,
    pruneStride: 1,
  }).admitted,
  true,
);

const dayMs = 86_400_000;
const lastSeenStore = new Map([["base64", { lastSeen: now - dayMs }]]);
const lastSeenExpired = (record, at) => at - record.lastSeen > dayMs;
assert.equal(pruneExpiredEntries(lastSeenStore, now, lastSeenExpired), 0);
assert.equal(pruneExpiredEntries(lastSeenStore, now + 1, lastSeenExpired), 1);

const activeSessionStore = new Map([
  ["session", { count: 2, expiresAt: now + 10_000 }],
]);
const activeSessionAdmission = getOrCreateBoundedStoreEntry({
  store: activeSessionStore,
  key: "session",
  now,
  maxEntries: 1,
  create: () => ({ count: 0, expiresAt: now + 20 * 60_000 }),
  isExpired: sessionExpired,
  getExpiresAt: (record) => record.expiresAt,
});
assert.equal(activeSessionAdmission.admitted, true);
assert.equal(activeSessionAdmission.value.count, 2);
assert.equal(activeSessionAdmission.value.expiresAt, now + 10_000);

const boundedStore = new Map();
for (let index = 0; index < 20; index += 1) {
  getOrCreateBoundedStoreEntry({
    store: boundedStore,
    key: `key-${index}`,
    now,
    maxEntries: 3,
    create: () => ({ expiresAt: now + 10_000 }),
    isExpired: sessionExpired,
    getExpiresAt: (record) => record.expiresAt,
    pruneStride: 1,
  });
  assert.ok(boundedStore.size <= 3);
}
assert.deepEqual([...boundedStore.keys()], ["key-0", "key-1", "key-2"]);

const capacityHeaders = createRateLimitCapacityHeaders(
  [
    {
      limit: 120,
      limitHeader: "X-RateLimit-Limit-Minute",
      remainingHeader: "X-RateLimit-Remaining-Minute",
    },
  ],
  1_500,
);
assert.equal(capacityHeaders.get("Retry-After"), "2");
assert.equal(capacityHeaders.get("X-RateLimit-Limit-Minute"), "120");
assert.equal(capacityHeaders.get("X-RateLimit-Remaining-Minute"), "0");

assert.throws(
  () =>
    getOrCreateBoundedStoreEntry({
      store: new Map(),
      key: "invalid",
      now,
      maxEntries: 0,
      create: () => ({}),
      isExpired: () => false,
      getExpiresAt: () => now,
    }),
  /positive safe integer/,
);

const sharedResetAtFiles = [
  "cricut-svg-converter.tsx",
  "drawing-to-svg-converter.tsx",
  "icon-to-svg-converter.tsx",
  "image-to-layered-svg-for-cricut.tsx",
  "image-to-svg-for-cricut.tsx",
  "image-to-svg-outline.tsx",
  "jpeg-to-svg-converter.tsx",
  "jpeg-to-svg-for-cricut.tsx",
  "jpg-to-svg-converter.tsx",
  "jpg-to-svg-for-cricut.tsx",
  "layered-svg-for-cricut.tsx",
  "sketch-to-svg-for-cricut.tsx",
];
const routeResetAtFiles = [
  "drawing-to-svg-for-cricut.tsx",
  "emoji-to-svg-converter.tsx",
  "jpg-to-layered-svg-for-cricut.tsx",
];

for (const fileName of sharedResetAtFiles) {
  const source = await readFile(path.join(root, "app", "routes", fileName), "utf8");
  assert.match(source, /getOrCreateResetAtRateLimitEntry\(/);
  assert.match(source, /SHARED_RATE_LIMIT_STORE_MAX_ENTRIES/);
}
for (const fileName of routeResetAtFiles) {
  const source = await readFile(path.join(root, "app", "routes", fileName), "utf8");
  assert.match(source, /getOrCreateResetAtRateLimitEntry\(/);
  assert.match(source, /ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES/);
}

const genericCoverage = new Map([
  ["app/utils/backendSecurity.server.ts", "SHARED_RATE_LIMIT_STORE_MAX_ENTRIES"],
  ["app/routes/black-and-white-image-to-svg-for-cricut.tsx", "ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES"],
  ["app/routes/base64-to-svg.tsx", "ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES"],
  ["app/routes/base64-to-svg-for-cricut.tsx", "ROUTE_RATE_LIMIT_STORE_MAX_ENTRIES"],
]);
for (const [relativePath, limitName] of genericCoverage) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  assert.match(source, /getOrCreateBoundedStoreEntry\(/);
  assert.ok(source.includes(limitName));
}

const homeSource = await readFile(path.join(root, "app", "routes", "home.tsx"), "utf8");
assert.match(homeSource, /BATCH_SESSION_STORE_MAX_ENTRIES/);
assert.match(homeSource, /session\.expiresAt <= now/);
assert.doesNotMatch(
  homeSource,
  /pruneExpiredEntries\(store, now/,
  "ordinary active-session continuation should not scan the full session store",
);
assert.doesNotMatch(
  [
    await readFile(path.join(root, "app", "utils", "backendSecurity.server.ts"), "utf8"),
    ...await Promise.all(
      [...sharedResetAtFiles, ...routeResetAtFiles].map((fileName) =>
        readFile(path.join(root, "app", "routes", fileName), "utf8"),
      ),
    ),
  ].join("\n"),
  /const record = store\.get\(key\) \?\? createFreshRateLimitRecord\(now\)/,
);

console.log(
  "bounded-store audit passed: expiration, active retention, fail-closed capacity, window stability, session TTL, hard bounds, and insertion coverage",
);
