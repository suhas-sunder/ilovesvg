import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const waitlistPath = "/pro-waitlist";
const accessKey = "f80d1c32-3a04-4523-9d54-a3292076e43b";
const consentText =
  "I agree to receive iLoveSVG Pro updates, early-access news, possible trial offers, and occasional product offers. I can unsubscribe anytime.";

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

function assertNotIncludes(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`${label}: must not include ${JSON.stringify(needle)}`);
  }
}

const nav = read("app/client/components/navigation/NavBar.tsx");
const footer = read("app/client/components/navigation/SiteFooter.tsx");
const routes = read("app/routes.ts");
const sitemap = read("app/routes/sitemap.tsx");
const routeCapabilities = read("app/client/lib/converter/routeCapabilities.ts");
const waitlist = read("app/routes/pro-waitlist.tsx");
const privacy = read("app/routes/privacy-policy.tsx");

assertIncludes(nav, "Go Pro", "header Go Pro CTA");
assertIncludes(nav, waitlistPath, "header Go Pro href");
assertIncludes(nav, "focus-visible", "header CTA focus state");
assertIncludes(nav, "cursor-pointer", "header CTA pointer cursor");

assertIncludes(footer, `to="${waitlistPath}"`, "footer waitlist link");
assertIncludes(footer, "Pro Waitlist", "footer waitlist label");

assertIncludes(
  routes,
  `route("pro-waitlist", "routes/pro-waitlist.tsx")`,
  "React Router route",
);
assertIncludes(sitemap, waitlistPath, "HTML sitemap waitlist link");
assertIncludes(routeCapabilities, '"pro-waitlist": "static"', "static route capability");

assertIncludes(waitlist, "iLoveSVG Pro Waitlist", "waitlist title");
assertIncludes(waitlist, "const canonical", "canonical");
assertIncludes(waitlist, "/pro-waitlist", "canonical path");
assertIncludes(waitlist, "Request early access to iLoveSVG Pro", "headline");
assertIncludes(waitlist, "saved custom presets", "custom presets positioning");
assertIncludes(waitlist, "reusable export settings", "reusable export settings positioning");
assertIncludes(waitlist, "Multi-preset comparison", "multi-preset comparison positioning");
assertIncludes(waitlist, "Batch rename templates", "batch rename templates positioning");
assertIncludes(waitlist, "possible trial invitations are optional", "trial offer opt-in wording");
assertIncludes(waitlist, "https://api.web3forms.com/submit", "Web3Forms endpoint");
assertIncludes(waitlist, accessKey, "Web3Forms access key");
assertIncludes(waitlist, "New iLoveSVG Pro waitlist signup", "subject");
assertIncludes(waitlist, "buildSubmissionLabel", "generated non-PII hidden name label");
assertIncludes(waitlist, 'type="hidden"', "hidden generated name field");
assertIncludes(waitlist, 'name="botcheck"', "Web3Forms honeypot");
assertIncludes(waitlist, "marketing_consent_text", "marketing consent text field");
assertIncludes(waitlist, consentText, "exact marketing consent copy");
assertIncludes(waitlist, "most_wanted_feature", "most wanted feature field");
assertIncludes(waitlist, "country_or_region", "country or region field");
assertIncludes(waitlist, "source_url", "source URL metadata");
assertIncludes(waitlist, "referrer_path", "referrer path metadata");
assertIncludes(waitlist, "submitted_at", "submitted timestamp metadata");
assertIncludes(waitlist, "Thanks, you’re on the waitlist.", "success copy");
assertIncludes(waitlist, "Something went wrong.", "error copy");
assertIncludes(waitlist, "aria-live", "accessible status region");
assertIncludes(waitlist, "required", "required field markers");
assertIncludes(waitlist, "maxLength", "field max length validation");

assertNotIncludes(waitlist, 'id="waitlist-name"', "visible name input removed");
assertNotIncludes(waitlist, 'label="Name"', "visible name label removed");

assertNotIncludes(waitlist.toLowerCase(), "navigator.geolocation", "no geolocation");
assertNotIncludes(waitlist.toLowerCase(), "pricing", "no pricing copy");
assertNotIncludes(waitlist.toLowerCase(), "unlimited", "no unlimited claims");
assertNotIncludes(waitlist.toLowerCase(), "ai conversion", "no AI conversion claims");

assertIncludes(privacy, "Waitlist and early-access requests", "privacy waitlist section title");
assertIncludes(privacy, "optional use case", "privacy waitlist optional use case");
assertIncludes(privacy, "consent preference", "privacy waitlist consent preference");
assertIncludes(privacy, "does not use browser geolocation for the waitlist", "privacy no waitlist geolocation");
assertIncludes(privacy, "does not store uploaded images or SVG conversion outputs", "privacy no waitlist outputs");

console.log("pro-waitlist-audit: ok");
