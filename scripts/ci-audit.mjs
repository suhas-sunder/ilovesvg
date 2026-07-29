import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCliPath = process.env.npm_execpath || null;
const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), "ilovesvg-ci-audit-"),
);
const routeCoverageReportPath = path.join(
  temporaryRoot,
  "route-coverage-audit.json",
);

const staticChecks = [
  ["Existing npm test suite", ["test"]],
  ["CI configuration contract", ["run", "test:ci-configuration"]],
  ["Public trace presentation", ["run", "test:warning-translation"]],
  [
    "Server fallback lifecycle",
    ["run", "test:server-fallback-lifecycle"],
  ],
  ["Client lifecycle", ["run", "test:client-lifecycle"]],
  ["Output UX", ["run", "test:output-ux"]],
  ["Preset identity", ["run", "test:preset-identity"]],
  ["Navigation source", ["run", "test:navigation"]],
  ["Memory diagnostics", ["run", "test:memory-diagnostics"]],
  ["Bounded stores", ["run", "test:bounded-store"]],
  ["Route expansion integrity", ["run", "test:route-expansion"]],
  ["Production logging", ["run", "test:production-logging"]],
  ["Manifest bundle", ["run", "test:manifest-bundle"]],
];

const serverChecks = [
  [
    "Server fallback response correlation",
    ["run", "test:server-fallback-correlation"],
  ],
  ["Conversion actions", ["run", "test:conversion-actions"]],
  ["Public content and schema remediation", ["run", "test:public-content"]],
  ["Route coverage", ["run", "test:route-coverage"]],
  ["Schema", ["run", "test:schema"]],
  ["SEO", ["run", "test:seo"]],
  [
    "SVG-to-PNG preservation",
    ["run", "test:svg-to-png-preservation"],
  ],
];

let serverProcess = null;
let serverOutput = "";
let serverStartError = null;

try {
  if (process.env.ILOVESVG_CI_TYPECHECKED !== "1") {
    await runNpm("TypeScript typecheck", ["run", "typecheck"]);
  }

  if (process.env.ILOVESVG_CI_BUILT !== "1") {
    await runNpm("Production build", ["run", "build"]);
  }

  for (const [label, args] of staticChecks) {
    await runNpm(label, args);
  }

  const port = await reserveAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = startServer(port);
  await waitForServer(baseUrl);

  const serverEnvironment = {
    BASE_URL: baseUrl,
    ROUTE_COVERAGE_REPORT_PATH: routeCoverageReportPath,
    SVG_TO_PNG_PRESERVATION_SKIP_BROWSER: "1",
  };
  for (const [label, args] of serverChecks) {
    await runNpm(label, args, serverEnvironment);
  }

  console.log(
    `[ci-audit] passed ${staticChecks.length + serverChecks.length} repository checks`,
  );
} finally {
  try {
    await stopServer();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function runNpm(label, args, environment = {}) {
  console.log(`\n[ci-audit] ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(
      npmCliPath ? process.execPath : npmCommand,
      npmCliPath ? [npmCliPath, ...args] : args,
      {
        cwd: root,
        env: { ...process.env, ...environment },
        shell: !npmCliPath && process.platform === "win32",
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`,
        ),
      );
    });
  });
}

function reserveAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        address && typeof address === "object" ? address.port : undefined;
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (port) {
          resolve(port);
        } else {
          reject(new Error("Could not reserve an available CI server port."));
        }
      });
    });
  });
}

function startServer(port) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collectOutput = (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-32_768);
  };
  child.stdout.on("data", collectOutput);
  child.stderr.on("data", collectOutput);
  child.once("error", (error) => {
    serverStartError = error;
  });
  return child;
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverStartError) {
      throw new Error(`The CI server could not start: ${serverStartError.message}`);
    }
    if (serverProcess?.exitCode !== null) {
      throw new Error(
        `The CI server exited before becoming ready.\n${serverOutput}`,
      );
    }
    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      const html = await response.text();
      if (response.status === 200 && /iLoveSVG/i.test(html)) {
        return;
      }
    } catch {
      // The server may still be loading its production bundle.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `The CI server did not become ready within 30 seconds.\n${serverOutput}`,
  );
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  const exitPromise = new Promise((resolve) =>
    serverProcess.once("exit", () => resolve(true)),
  );
  serverProcess.kill("SIGTERM");
  const exited = await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (exited) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill.exe",
        ["/pid", String(serverProcess.pid), "/t", "/f"],
        { stdio: "ignore" },
      );
      killer.once("error", () => resolve());
      killer.once("exit", () => resolve());
    });
  } else {
    serverProcess.kill("SIGKILL");
  }
}
