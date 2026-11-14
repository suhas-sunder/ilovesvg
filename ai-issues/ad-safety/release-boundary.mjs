import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Creates disposable Git objects only. No branch, index, worktree, queue or
// production state is changed. Prior replay heads are evidence, not releases.
const [candidate, priorEvidence] = process.argv.slice(2);
assert.match(candidate || '', /^[a-f0-9]{40}$/);
assert.ok(priorEvidence, 'Provide the prior Phase3 release-sequence-evidence.json');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const foundation = 'c5cfeb0a7018b5d2ff50f9f9b99502d647f320c4';
const main = 'f53292e1551a714c884103d1e0bc5e5c2172f1f1';
const prior = JSON.parse(readFileSync(priorEvidence, 'utf8')).correctedReleaseSequence;
assert.equal(prior.complete, true);
assert.equal(prior.records.length, 8);
assert.equal(git('merge-base', candidate, foundation), foundation);
const adApplicationFiles = new Set([
  'app/app.css',
  'app/root.tsx',
  'app/client/components/ads/AdsenseDelayed.tsx',
  'app/client/lib/monetization/adPlaceholderSafety.ts',
]);
const changed = (a, b, ...paths) => git('diff', '--name-only', a, b, '--', ...paths).split('\n').filter(Boolean);
const assertApplicationBoundary = (a, b) => {
  const differences = changed(a, b, 'app', 'public', 'package.json', 'package-lock.json', 'server.js');
  assert.ok(differences.every(path => adApplicationFiles.has(path)), `Unexpected application difference: ${differences}`);
  return differences;
};
const applicationChanges = assertApplicationBoundary(foundation, candidate);
const narrowFiles = changed(foundation, candidate);
assert.ok(narrowFiles.every(path => adApplicationFiles.has(path) ||
  path === '.github/workflows/reliability-release.yml' ||
  path === 'scripts/ad-placeholder-safety-test.mjs' ||
  path === 'ai-issues/PHASE3-AD-SAFETY-REMEDIATION.md' ||
  path.startsWith('ai-issues/ad-safety/')), `Unexpected narrow candidate file: ${narrowFiles}`);
const expected = [125,125,126,126,126,126,126,127];
const bootstrap = git('show', `${candidate}:app/client/lib/monetization/adPlaceholderSafety.ts`);
const protectedCss = git('show', `${candidate}:app/app.css`).split('@theme')[0];
const records = [];
let current = candidate;
for (let index = 0; index < prior.records.length; index++) {
  const row = prior.records[index];
  let tree = git('rev-parse', `${current}^{tree}`);
  if (index) {
    const merge = spawnSync('git', ['merge-tree', '--write-tree', current, row.head], { encoding: 'utf8' });
    assert.equal(merge.status, 0, `Merge conflict at ${row.id}: ${merge.stdout}\n${merge.stderr}`);
    tree = merge.stdout.split(/\r?\n/)[0];
    assert.match(tree, /^[a-f0-9]{40}$/);
    current = execFileSync('git', ['commit-tree', tree, '-p', current, '-p', row.head], {
      input: `Disposable ad safety boundary replay: ${row.id}\n`, encoding: 'utf8',
    }).trim();
  }
  const differences = assertApplicationBoundary(row.head, current);
  assert.equal(git('show', `${current}:app/client/lib/monetization/adPlaceholderSafety.ts`), bootstrap);
  assert.equal(git('show', `${current}:app/app.css`).split('@theme')[0], protectedCss);
  assert.match(git('show', `${current}:app/root.tsx`), /<script dangerouslySetInnerHTML=\{\{ __html: AD_PLACEHOLDER_SAFETY_SCRIPT \}\} \/>/);
  const sitemap = git('show', `${current}:public/sitemap.xml`);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(new Set(urls).size, expected[index]);
  assert.equal(urls.some(url => url.endsWith('/author/suhas-sunder')), index >= 2);
  assert.equal(urls.some(url => url.endsWith('/svg-sprite-generator')), index === 7);
  assert.equal(git('show', `${current}:public/robots.txt`), git('show', `${row.head}:public/robots.txt`));
  assert.equal(git('show', `${current}:app/data/routeManifest.ts`), git('show', `${row.head}:app/data/routeManifest.ts`));
  const paths = git('ls-tree', '-r', '--name-only', current, '--', 'public/examples').split('\n').filter(Boolean);
  assert.equal(paths.length > 0, index >= 4);
  if (index) assert.match(git('show', `${current}:app/client/components/ads/AdsenseDelayed.tsx`), /role="group"/);
  records.push({ id: row.id, validatedPhase3Reference: row.head, replayHead: current, tree,
    applicationDifferences: differences, sourceIndexableCount: urls.length,
    noFutureAuthorOrSpriteExposure: true, examplesBeginAtC: true,
    routeManifestAndRobotsPreserved: true, laterRoleGroupPreserved: index > 0,
    structuralChecksPassed: true, safetyBootstrapAndCssPreserved: true, exactHeadCiClaimed: false });
}
assert.deepEqual(changed(main, candidate, 'public/sitemap.xml', 'public/robots.txt', 'app/data/routeManifest.ts'), []);
const result = { status: 'VALIDATED LOCALLY', scope: 'Git structure/source boundary only; no runtime or production claim',
  main, foundation, candidate, ancestry: git('rev-list', '--reverse', `${foundation}..${candidate}`).split('\n'),
  narrowFiles, applicationChanges, commitsCreatedAreDisposable: true, queuesChanged: false,
  productionStateChanged: false, exactFutureHeadsRequireRevalidation: true, records };
writeFileSync('ai-issues/ad-safety/release-boundary-results.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ candidate, transitions: records.length, sourceIndexableCounts: records.map(row=>row.sourceIndexableCount), finalReplay: current, passed: true }));
