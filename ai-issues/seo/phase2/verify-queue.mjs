import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
const trustedSha = '5c8dcd49f5b5d081d27054a670777c009d8b3802';
const trustedDir = resolve('tmp/phase2/trusted-pr10');
await mkdir(trustedDir, { recursive: true });
for (const file of ['weekly-seo-plan.mjs', 'content-release-boundary.mjs']) {
  await writeFile(resolve(trustedDir, file), execFileSync('git', ['show', `${trustedSha}:scripts/${file}`]));
}
const { selectWeeklyCandidate } = await import(pathToFileURL(resolve(trustedDir, 'weekly-seo-plan.mjs')).href);
const { assertCandidateDiff, assertIndexableBudget, assertNoStagedExposure } = await import(pathToFileURL(resolve(trustedDir, 'content-release-boundary.mjs')).href);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const queue=JSON.parse(await readFile('ai-issues/seo/release-queue.json','utf8'));
const history=JSON.parse(await readFile('ai-issues/seo/release-history.json','utf8'));
assert.deepEqual(history.releases,[]);
assert.equal(selectWeeklyCandidate(queue,history,new Date('2026-11-13T17:00:00Z')),null);
assert.equal(selectWeeklyCandidate(queue,history,new Date('2026-11-16T17:00:00Z')),null);
const result=[];
for(const [index,candidate] of queue.candidates.entries()){
  assert.equal(candidate.ownerApproved,false);assert.equal(candidate.approvedForSchedule,false);assert.equal(candidate.plannedWeek,null);assert.equal(candidate.actualPublicationDate,null);
  assert.equal(git('rev-parse',candidate.branch),candidate.reviewedSha);
  assert.equal(git('merge-base',candidate.reviewedSha,candidate.baseSha),candidate.baseSha);
  const files=git('diff','--name-only',candidate.baseSha,candidate.reviewedSha).split('\n');
  assertCandidateDiff(candidate,files);
  assertIndexableBudget(candidate,git('show',`${candidate.baseSha}:app/data/routeManifest.ts`),git('show',`${candidate.reviewedSha}:app/data/routeManifest.ts`));
  const future=[];
  for(const later of queue.candidates.slice(index+1))for(const change of later.changes.filter(change=>change.kind==='new-page')){
    const probe=spawnSync('git',['grep','-l','-F','--',change.url,candidate.reviewedSha,'--','app','public'],{encoding:'utf8'});
    assert.equal(probe.status,1,`Future URL ${change.url} leaked into ${candidate.id}`);future.push(change.url);
  }
  result.push({id:candidate.id,sha:candidate.reviewedSha,base:candidate.baseSha,exactAllowlist:true,indexableBudget:true,futureNewPageExposure:false,checkedFutureUrls:future});
}
assert.throws(()=>assertNoStagedExposure([['app/routes.ts',git('show',queue.candidates.at(-1).reviewedSha+':app/routes.ts')]],queue),/Unpublished/);
const report={plannerSelectsNothing:true,historyEmpty:true,ownerApprovalsFalse:true,wholeStackCorrectlyRejected:true,candidates:result,note:'Uses unchanged PR10 trusted assertion functions. No simulated publication dates or approvals persisted. Later stacked candidates remain blocked until predecessor publication/deployment is genuinely recorded.'};
await writeFile('ai-issues/seo/phase2/queue-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
