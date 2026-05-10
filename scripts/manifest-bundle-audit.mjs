import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const assetsDir = path.join(root, "build", "client", "assets");

const wrapperChunkPrefixes = [
  "png-to-svg-for-canva-",
  "jpg-to-svg-for-canva-",
  "logo-to-svg-for-canva-",
  "svg-to-png-for-canva-",
  "png-to-svg-for-figma-",
  "svg-to-png-for-figma-",
  "svg-to-png-for-etsy-",
  "svg-to-jpg-for-etsy-",
  "svg-to-png-for-shopify-",
  "svg-to-png-for-printify-",
  "svg-to-png-for-printful-",
  "svg-to-favicon-for-shopify-",
  "logo-to-favicon-for-shopify-",
  "png-to-ico-converter-",
  "svg-to-ico-converter-",
  "png-to-favicon-generator-",
  "jpg-to-favicon-generator-",
  "logo-to-favicon-generator-",
  "image-to-favicon-generator-",
  "svg-resizer-for-canva-",
  "svg-resizer-for-etsy-",
  "svg-resizer-for-figma-",
  "svg-resizer-for-glowforge-",
  "svg-resizer-for-shopify-",
  "svg-resizer-for-silhouette-",
  "svg-cleaner-for-figma-",
  "svg-cleaner-for-glowforge-",
  "svg-cleaner-for-silhouette-",
];

const fullManifestMarkers = [
  "ROUTE_MANIFEST",
  "/how-it-works/conversion-workflow",
  "Image To SVG For Glowforge",
];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const readAsset = (fileName) => fs.readFile(path.join(assetsDir, fileName), "utf8");

const entries = await fs.readdir(assetsDir, { withFileTypes: true }).catch(() => {
  throw new Error("Missing build/client/assets. Run npm run build before test:manifest-bundle.");
});

const jsFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name)
  .sort();

const routeManifestAssets = jsFiles.filter((fileName) =>
  /^routeManifest-[A-Za-z0-9_-]+\.js$/.test(fileName),
);
const routeMetaAssets = jsFiles.filter((fileName) =>
  /^routeMeta-[A-Za-z0-9_-]+\.js$/.test(fileName),
);

assert(
  routeManifestAssets.length === 0,
  `Full routeManifest client asset should not be emitted: ${routeManifestAssets.join(", ")}`,
);

const routeManifestImporters = [];

for (const fileName of jsFiles) {
  const source = await readAsset(fileName);
  if (source.includes("routeManifest-")) {
    routeManifestImporters.push(fileName);
  }
}

assert(
  routeManifestImporters.length === 0,
  `Client chunks import routeManifest: ${routeManifestImporters.join(", ")}`,
);

const wrapperChunks = new Map();
for (const prefix of wrapperChunkPrefixes) {
  const chunk = jsFiles.find((fileName) => fileName.startsWith(prefix));
  assert(chunk, `Missing wrapper client chunk for ${prefix}`);
  const source = await readAsset(chunk);
  assert(!source.includes("routeManifest-"), `${chunk} imports full routeManifest`);
  assert(!fullManifestMarkers.some((marker) => source.includes(marker)), `${chunk} contains full manifest data`);
  wrapperChunks.set(prefix.replace(/-$/, ""), chunk);
}

const routeMetaBytes = (
  await Promise.all(
    routeMetaAssets.map(async (fileName) => {
      const stat = await fs.stat(path.join(assetsDir, fileName));
      return stat.size;
    }),
  )
).reduce((total, size) => total + size, 0);

assert(
  routeMetaBytes <= 12000,
  `Lightweight routeMeta client chunk is unexpectedly large: ${routeMetaBytes} bytes`,
);

console.log(
  JSON.stringify(
    {
      checkedClientChunks: jsFiles.length,
      routeManifestClientAssets: routeManifestAssets.length,
      routeMetaClientAssets: routeMetaAssets,
      routeMetaBytes,
      wrapperChunks: Object.fromEntries(wrapperChunks),
    },
    null,
    2,
  ),
);
