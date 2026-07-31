if (
  process.env.ILOVESVG_MEMORY_AUDIT_IPC !== "1" ||
  typeof process.send !== "function" ||
  typeof global.gc !== "function"
) {
  throw new Error(
    "The native-memory server wrapper requires its private IPC channel and --expose-gc.",
  );
}

process.on("message", (message) => {
  if (message !== "ilovesvg-memory-audit-gc") return;
  try {
    global.gc();
    global.gc();
    process.send?.({
      event: "ilovesvg-memory-audit-gc-complete",
      memory: process.memoryUsage(),
    });
  } catch {
    process.send?.({ event: "ilovesvg-memory-audit-gc-complete" });
  }
});

await import("../server.js");
