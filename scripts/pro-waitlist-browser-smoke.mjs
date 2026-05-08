import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9252);
const runId = `${debugPort}-${process.pid}-${Date.now()}`;
const tmpDir = path.join(os.tmpdir(), "ilovesvg-pro-waitlist-browser-smoke", runId);
const profileDir = path.join(tmpDir, "profile");
const waitlistPath = "/pro-waitlist";
const viewportWidths = [320, 360, 390, 414, 768, 1024, 1280, 1440];

async function main() {
  await assertServerReachable();
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });

  const browser = spawn(
    browserPath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  const results = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    layouts: [],
    validation: null,
    success: null,
    error: null,
    consoleMessages: [],
  };

  try {
    await waitForCdp();

    for (const width of viewportWidths) {
      const client = await openPage(waitlistPath, width, 900);
      try {
        results.layouts.push(await checkLayout(client, width));
      } finally {
        await client.close().catch(() => {});
      }
    }

    const validationClient = await openPage(waitlistPath, 390, 900);
    try {
      results.validation = await checkValidation(validationClient);
    } finally {
      await validationClient.close().catch(() => {});
    }

    const successClient = await openPage(waitlistPath, 390, 900, "success");
    try {
      results.success = await checkSubmission(successClient, "success");
    } finally {
      await successClient.close().catch(() => {});
    }

    const errorClient = await openPage(waitlistPath, 390, 900, "error");
    try {
      results.error = await checkSubmission(errorClient, "error");
    } finally {
      await errorClient.close().catch(() => {});
    }

    const consoleClient = await openPage(waitlistPath, 390, 900);
    try {
      results.consoleMessages = await collectConsoleSignals(consoleClient);
    } finally {
      await consoleClient.close().catch(() => {});
    }
  } finally {
    browser.kill();
  }

  const failures = [
    ...results.layouts.filter((result) => !result.ok),
    ...(results.validation?.ok === false ? [results.validation] : []),
    ...(results.success?.ok === false ? [results.success] : []),
    ...(results.error?.ok === false ? [results.error] : []),
  ];
  const badConsoleMessages = results.consoleMessages.filter((message) =>
    /hydration|did not match|error|exception|uncaught/i.test(message) &&
    !/vite.*failed to connect to websocket/i.test(message) &&
    !/WebSocket closed without opened[\s\S]*@vite\/client/i.test(message),
  );
  if (badConsoleMessages.length) {
    failures.push({ ok: false, scenario: "console", messages: badConsoleMessages });
  }

  console.log(JSON.stringify(results, null, 2));

  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exit(1);
  }
}

async function checkLayout(client, width) {
  if (width < 1024) {
    await evaluate(client, `(() => {
      document.querySelector('button[aria-label="Open menu"]')?.click();
      return true;
    })()`);
    await delay(250);
  }

  const state = await evaluate(client, `(() => {
    const visible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden";
    };
    const proLinks = Array.from(document.querySelectorAll('a[href="/pro-waitlist"]'));
    const visibleProLinks = proLinks.filter(visible);
    const form = document.querySelector('form');
    const formRect = form?.getBoundingClientRect();
    const checkbox = document.querySelector('input[type="checkbox"]:not([name="botcheck"])');
    const honeypot = document.querySelector('input[name="botcheck"]');
    const honeypotStyle = honeypot ? window.getComputedStyle(honeypot) : null;
    const visibleNameFields = Array.from(document.querySelectorAll('input[name="name"]')).filter(visible);
    const hiddenName = document.querySelector('input[type="hidden"][name="name"]');
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || "";
    return {
      width: window.innerWidth,
      title: document.title,
      h1: document.querySelector('h1')?.textContent || "",
      canonical,
      proLinkCount: proLinks.length,
      visibleProLinkCount: visibleProLinks.length,
      formTop: formRect ? Math.round(formRect.top) : null,
      formVisible: visible(form),
      visibleNameFieldCount: visibleNameFields.length,
      hasHiddenGeneratedName: Boolean(hiddenName && /^Waitlist Signup wls_[a-z0-9]+$/.test(hiddenName.value)),
      marketingChecked: Boolean(checkbox?.checked),
      honeypotHidden: Boolean(honeypot && honeypotStyle?.display === "none"),
      hasCountryValue: Boolean(document.querySelector('#waitlist-country')?.value),
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);

  return {
    scenario: "layout",
    width,
    ...state,
    ok:
      state.title === "iLoveSVG Pro Waitlist" &&
      state.h1.includes("Request early access to iLoveSVG Pro") &&
      state.canonical === "https://www.ilovesvg.com/pro-waitlist" &&
      state.proLinkCount >= 2 &&
      state.visibleProLinkCount >= 1 &&
      state.formVisible &&
      state.formTop !== null &&
      state.formTop < 640 &&
      state.visibleNameFieldCount === 0 &&
      state.hasHiddenGeneratedName === true &&
      state.marketingChecked === false &&
      state.honeypotHidden === true &&
      state.hasCountryValue === false &&
      !state.overflow,
  };
}

async function checkValidation(client) {
  await evaluate(client, `(() => {
    document.querySelector('form')?.requestSubmit();
    return true;
  })()`);

  const state = await waitForValue(
    client,
    () => `(() => ({
      status: document.querySelector('#waitlist-status')?.textContent?.trim() || "",
      emailError: document.querySelector('#waitlist-email-error')?.textContent?.trim() || "",
      hasVisibleNameInput: Boolean(Array.from(document.querySelectorAll('input[name="name"]')).find((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })),
      buttonDisabled: Boolean(document.querySelector('button[type="submit"]')?.disabled),
    }))()`,
    5000,
    (value) => value?.status.includes("Please fix"),
  );

  return {
    scenario: "validation",
    ...state,
    ok:
      state.status.includes("Please fix") &&
      state.emailError.includes("Enter your email") &&
      state.hasVisibleNameInput === false &&
      state.buttonDisabled === false,
  };
}

async function checkSubmission(client, mode) {
  await fillWaitlistForm(client);
  await evaluate(client, `(() => {
    document.querySelector('form')?.requestSubmit();
    return true;
  })()`);

  const expectedText =
    mode === "success"
      ? "Thanks, you’re on the waitlist."
      : "Something went wrong.";

  const state = await waitForValue(
    client,
    () => `(() => ({
      status: document.querySelector('#waitlist-status')?.textContent?.trim() || "",
      buttonText: document.querySelector('button[type="submit"]')?.textContent?.trim() || "",
      buttonDisabled: Boolean(document.querySelector('button[type="submit"]')?.disabled),
      payload: window.__waitlistPayloads?.[0] || null,
      emailValue: document.querySelector('#waitlist-email')?.value || "",
      marketingChecked: Boolean(document.querySelector('input[type="checkbox"]:not([name="botcheck"])')?.checked),
    }))()`,
    8000,
    (value) => value?.status.includes(expectedText),
  );

  const payload = state.payload || {};
  const expectsReset = mode === "success";

  return {
    scenario: `${mode}-submission`,
    ...state,
    ok:
      state.status.includes(expectedText) &&
      state.buttonDisabled === false &&
      payload.access_key === "f80d1c32-3a04-4523-9d54-a3292076e43b" &&
      payload.subject === "New iLoveSVG Pro waitlist signup" &&
      payload.form_type === "pro_waitlist" &&
      payload.page_source === "pro-waitlist" &&
      /^Waitlist Signup wls_[a-z0-9]+$/.test(payload.name || "") &&
      payload.marketing_consent === "yes" &&
      payload.marketing_consent_text?.includes("possible trial offers") &&
      typeof payload.submitted_at === "string" &&
      payload.source_url?.endsWith("/pro-waitlist") &&
      payload.referrer_path === "" &&
      payload.most_wanted_feature === "Batch rename templates" &&
      payload.country_or_region === "Canada" &&
      payload.message === "Batch presets would help." &&
      (expectsReset
        ? state.emailValue === "" && state.marketingChecked === false
        : state.emailValue.trim() === "test@example.com"),
  };
}

async function fillWaitlistForm(client) {
  await evaluate(client, `(() => {
    const setValue = (selector, value) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error("Missing form field: " + selector);
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      descriptor.set.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setValue('#waitlist-email', ' test@example.com ');
    setValue('#waitlist-use-case', 'Batch SVG conversion');
    setValue('#waitlist-expected-usage', 'Large batches');
    setValue('#waitlist-most-wanted', 'Batch rename templates');
    setValue('#waitlist-country', ' Canada ');
    setValue('#waitlist-message', ' Batch presets would help. ');
    const checkbox = document.querySelector('input[type="checkbox"]:not([name="botcheck"])');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await delay(250);
}

async function collectConsoleSignals(client) {
  const messages = [];
  client.onEvent((message) => {
    if (message.method === "Runtime.consoleAPICalled") {
      messages.push(
        (message.params.args || [])
          .map((arg) => arg.value || arg.description || "")
          .join(" ")
          .trim(),
      );
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails || {};
      messages.push(
        [
          details.text || "Runtime exception",
          details.exception?.description || "",
          details.url || "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  });
  await client.send("Runtime.enable");
  await reload(client);
  await delay(1500);
  return messages.filter(Boolean);
}

async function openPage(pathname, width, height, mockMode = null) {
  const url = `${baseUrl}${pathname}`;
  const target = await createCdpTarget("about:blank");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });

  if (mockMode) {
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: createFetchMockSource(mockMode),
    });
  }

  await client.navigate(url);
  return client;
}

function createFetchMockSource(mode) {
  const success = mode === "success";
  return `
    (() => {
      const originalFetch = window.fetch.bind(window);
      window.__waitlistPayloads = [];
      window.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.includes("api.web3forms.com/submit")) {
          try {
            window.__waitlistPayloads.push(JSON.parse(init.body || "{}"));
          } catch {
            window.__waitlistPayloads.push({});
          }
          return new Response(JSON.stringify({ success: ${success ? "true" : "false"} }), {
            status: ${success ? 200 : 500},
            headers: { "Content-Type": "application/json" }
          });
        }
        return originalFetch(input, init);
      };
    })();
  `;
}

async function reload(client) {
  await client.send("Page.reload", { ignoreCache: true });
  await waitForValue(
    client,
    () => `(() => document.readyState)()`,
    20_000,
    (state) => state === "interactive" || state === "complete",
  );
  await delay(500);
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30_000).unref?.();
    });
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await waitForValue(
      this,
      () => `(() => document.readyState)()`,
      20_000,
      (state) => state === "interactive" || state === "complete",
    );
    await delay(500);
  }

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory());
    if (isReady(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
  if (browserInfo.webSocketDebuggerUrl) {
    try {
      const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        browserWs.addEventListener("open", resolve, { once: true });
        browserWs.addEventListener("error", reject, { once: true });
      });
      const browserClient = new CdpClient(browserWs);
      const { targetId } = await browserClient.send("Target.createTarget", {
        url,
        newWindow: false,
        background: false,
      });
      await browserClient.close().catch(() => {});
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const targets = await cdpJson("/json/list");
        const target = targets.find((candidate) => candidate.id === targetId);
        if (target?.webSocketDebuggerUrl) return target;
        await delay(150);
      }
    } catch {
      // Fall through to /json/new.
    }
  }

  return cdpJson(`/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
}

async function waitForCdp() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await cdpJson("/json/version");
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("Timed out waiting for browser CDP endpoint.");
}

async function cdpJson(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function assertServerReachable() {
  const response = await fetch(`${baseUrl}${waitlistPath}`);
  if (!response.ok) {
    throw new Error(`Waitlist URL ${baseUrl}${waitlistPath} returned ${response.status}`);
  }
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No Chromium-family browser executable found for Pro waitlist browser smoke.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
