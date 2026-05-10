import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const assetsDir = path.join(root, "build", "client", "assets");

const routeMetaFamilies = [
  {
    key: "canvaFigma",
    assetPrefix: "canvaFigma-",
    maxBytes: 4000,
    routePrefixes: [
      "png-to-svg-for-canva-",
      "jpg-to-svg-for-canva-",
      "logo-to-svg-for-canva-",
      "svg-to-png-for-canva-",
      "png-to-svg-for-figma-",
      "svg-to-png-for-figma-",
    ],
    routePaths: [
      "/png-to-svg-for-canva",
      "/jpg-to-svg-for-canva",
      "/logo-to-svg-for-canva",
      "/svg-to-png-for-canva",
      "/png-to-svg-for-figma",
      "/svg-to-png-for-figma",
    ],
  },
  {
    key: "marketplaceExport",
    assetPrefix: "marketplaceExport-",
    maxBytes: 4000,
    routePrefixes: [
      "svg-to-png-for-etsy-",
      "svg-to-jpg-for-etsy-",
      "svg-to-png-for-shopify-",
      "svg-to-png-for-printify-",
      "svg-to-png-for-printful-",
    ],
    routePaths: [
      "/svg-to-png-for-etsy",
      "/svg-to-jpg-for-etsy",
      "/svg-to-png-for-shopify",
      "/svg-to-png-for-printify",
      "/svg-to-png-for-printful",
    ],
  },
  {
    key: "faviconExport",
    assetPrefix: "faviconExport-",
    maxBytes: 5000,
    routePrefixes: [
      "svg-to-favicon-for-shopify-",
      "logo-to-favicon-for-shopify-",
      "png-to-ico-converter-",
      "svg-to-ico-converter-",
      "png-to-favicon-generator-",
      "jpg-to-favicon-generator-",
      "logo-to-favicon-generator-",
      "image-to-favicon-generator-",
    ],
    routePaths: [
      "/svg-to-favicon-for-shopify",
      "/logo-to-favicon-for-shopify",
      "/png-to-ico-converter",
      "/svg-to-ico-converter",
      "/png-to-favicon-generator",
      "/jpg-to-favicon-generator",
      "/logo-to-favicon-generator",
      "/image-to-favicon-generator",
    ],
  },
  {
    key: "svgPlatformTools",
    assetPrefix: "svgPlatformTools-",
    maxBytes: 5000,
    routePrefixes: [
      "svg-resizer-for-canva-",
      "svg-resizer-for-etsy-",
      "svg-resizer-for-figma-",
      "svg-resizer-for-glowforge-",
      "svg-resizer-for-shopify-",
      "svg-resizer-for-silhouette-",
      "svg-cleaner-for-figma-",
      "svg-cleaner-for-glowforge-",
      "svg-cleaner-for-silhouette-",
    ],
    routePaths: [
      "/svg-resizer-for-canva",
      "/svg-resizer-for-etsy",
      "/svg-resizer-for-figma",
      "/svg-resizer-for-glowforge",
      "/svg-resizer-for-shopify",
      "/svg-resizer-for-silhouette",
      "/svg-cleaner-for-figma",
      "/svg-cleaner-for-glowforge",
      "/svg-cleaner-for-silhouette",
    ],
  },
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
const routeMetaMonolithAssets = jsFiles.filter((fileName) =>
  /^routeMeta-[A-Za-z0-9_-]+\.js$/.test(fileName),
);
const createManifestMetaAssets = jsFiles.filter((fileName) =>
  /^createManifestMeta-[A-Za-z0-9_-]+\.js$/.test(fileName),
);

assert(
  routeManifestAssets.length === 0,
  `Full routeManifest client asset should not be emitted: ${routeManifestAssets.join(", ")}`,
);

const routeManifestImporters = [];
const routeMetaMonolithImporters = [];

for (const fileName of jsFiles) {
  const source = await readAsset(fileName);
  if (source.includes("routeManifest-")) {
    routeManifestImporters.push(fileName);
  }
  if (source.includes("routeMeta-")) {
    routeMetaMonolithImporters.push(fileName);
  }
}

assert(
  routeManifestImporters.length === 0,
  `Client chunks import routeManifest: ${routeManifestImporters.join(", ")}`,
);

assert(
  routeMetaMonolithAssets.length === 0,
  `Global routeMeta client asset should not be emitted: ${routeMetaMonolithAssets.join(", ")}`,
);
assert(
  routeMetaMonolithImporters.length === 0,
  `Client chunks import global routeMeta asset: ${routeMetaMonolithImporters.join(", ")}`,
);

const familyMetaAssets = new Map();
for (const family of routeMetaFamilies) {
  const matches = jsFiles.filter((fileName) => fileName.startsWith(family.assetPrefix));
  assert(
    matches.length === 1,
    `Expected one ${family.key} route metadata asset, found ${matches.length}: ${matches.join(", ")}`,
  );

  const fileName = matches[0];
  const source = await readAsset(fileName);
  const stat = await fs.stat(path.join(assetsDir, fileName));
  assert(stat.size <= family.maxBytes, `${fileName} is unexpectedly large: ${stat.size} bytes`);
  assert(!source.includes("routeManifest-"), `${fileName} imports full routeManifest`);
  assert(
    !fullManifestMarkers.some((marker) => source.includes(marker)),
    `${fileName} contains full manifest data`,
  );

  familyMetaAssets.set(family.key, { fileName, bytes: stat.size });
}

for (const family of routeMetaFamilies) {
  const familyAsset = familyMetaAssets.get(family.key);
  const familySource = await readAsset(familyAsset.fileName);
  const unrelatedPaths = routeMetaFamilies
    .filter((otherFamily) => otherFamily.key !== family.key)
    .flatMap((otherFamily) => otherFamily.routePaths);

  assert(
    family.routePaths.every((routePath) => familySource.includes(routePath)),
    `${familyAsset.fileName} is missing one or more ${family.key} route paths`,
  );
  assert(
    !unrelatedPaths.some((routePath) => familySource.includes(routePath)),
    `${familyAsset.fileName} contains unrelated family metadata`,
  );
}

const familyAssetsByFileName = new Map(
  [...familyMetaAssets.entries()].map(([familyKey, asset]) => [asset.fileName, familyKey]),
);
const wrapperChunks = new Map();
for (const family of routeMetaFamilies) {
  const expectedFamilyAsset = familyMetaAssets.get(family.key);
  const otherFamilyAssets = [...familyMetaAssets.values()].filter(
    (asset) => asset.fileName !== expectedFamilyAsset.fileName,
  );
  const unrelatedPaths = routeMetaFamilies
    .filter((otherFamily) => otherFamily.key !== family.key)
    .flatMap((otherFamily) => otherFamily.routePaths);

  for (const prefix of family.routePrefixes) {
    const chunk = jsFiles.find((fileName) => fileName.startsWith(prefix));
    assert(chunk, `Missing wrapper client chunk for ${prefix}`);
    const source = await readAsset(chunk);
    assert(!source.includes("routeManifest-"), `${chunk} imports full routeManifest`);
    assert(
      !fullManifestMarkers.some((marker) => source.includes(marker)),
      `${chunk} contains full manifest data`,
    );
    assert(
      source.includes(expectedFamilyAsset.fileName),
      `${chunk} should import ${expectedFamilyAsset.fileName}`,
    );
    assert(
      !otherFamilyAssets.some((asset) => source.includes(asset.fileName)),
      `${chunk} imports unrelated route metadata family`,
    );
    assert(
      !unrelatedPaths.some((routePath) => source.includes(routePath)),
      `${chunk} contains unrelated route metadata path`,
    );
    wrapperChunks.set(prefix.replace(/-$/, ""), {
      chunk,
      family: family.key,
      familyAsset: expectedFamilyAsset.fileName,
    });
  }
}

const familyMetaBytes = Object.fromEntries(
  [...familyMetaAssets.entries()].map(([familyKey, asset]) => [
    familyKey,
    { asset: asset.fileName, bytes: asset.bytes },
  ]),
);

for (const asset of createManifestMetaAssets) {
  const stat = await fs.stat(path.join(assetsDir, asset));
  assert(stat.size <= 2500, `${asset} is unexpectedly large: ${stat.size} bytes`);
}

console.log(
  JSON.stringify(
    {
      checkedClientChunks: jsFiles.length,
      routeManifestClientAssets: routeManifestAssets.length,
      routeMetaMonolithClientAssets: routeMetaMonolithAssets,
      createManifestMetaClientAssets: createManifestMetaAssets,
      familyMetaAssets: familyMetaBytes,
      familyAssetOwners: Object.fromEntries(familyAssetsByFileName),
      wrapperChunks: Object.fromEntries(wrapperChunks),
    },
    null,
    2,
  ),
);
