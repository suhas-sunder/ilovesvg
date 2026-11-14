// Static first-party code, installed before the asynchronous ad script and
// before hydration. No interpolated user input, storage, requests, or SSR state.
// AdSense documents data-ad-status="filled" as the creative fill signal:
// https://support.google.com/adsense/answer/10762946
export const AD_PLACEHOLDER_SAFETY_SCRIPT = String.raw`
(() => {
  const root = document.documentElement;
  const latch = "data-ad-placeholders-suppressed";
  const observerKey = "__iloveSvgAdPlaceholderObserver";
  if (root.getAttribute(latch) === "true" || root[observerKey]) return;

  const slotSelector = "ins.adsbygoogle";
  const filledSelector = slotSelector + '[data-ad-status="filled"]';
  function containsFill(node) {
    return node.nodeType === 1 && (node.matches(filledSelector) ||
      (node.firstElementChild && node.querySelector(filledSelector)));
  }
  function suppress() {
    root.setAttribute(latch, "true");
    observer.disconnect();
    delete root[observerKey];
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.attributeName === "data-ad-status" &&
          record.target.matches(slotSelector) &&
          (record.oldValue === "filled" || record.target.getAttribute("data-ad-status") === "filled")) {
        suppress();
        return;
      }
      if (record.type === "childList") {
        // Also retain fill evidence from pre-populated or detached slots.
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (containsFill(node)) { suppress(); return; }
        }
      }
    }
  });
  root[observerKey] = observer;
  observer.observe(root, {
    subtree: true, childList: true, attributes: true,
    attributeOldValue: true, attributeFilter: ["data-ad-status"]
  });
  if (root.querySelector(filledSelector)) suppress();
})();
`;
