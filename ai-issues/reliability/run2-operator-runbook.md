# Run 2 operator runbook: narrow reliability release

Status: release preparation only. No merge/deploy is permitted until the runtime and previous deployed image are verified. Use the exact final release branch SHA recorded in the Run 2 handoff, not an assumed main or a mutable image tag. Do not deploy PR #3 wholesale.

## What is known, by access layer

| Layer | Evidence available in this Codex run | Limit |
| --- | --- | --- |
| DigitalOcean account | Owner supplied a successful infrastructure API observation: Droplet named websites, tor1, s-1vcpu-2gb-amd, 2 GB RAM, 1 vCPU | This observation is accepted as account-level evidence, not proof that iLoveSVG runs there. Current tool inventory/plugin search does not expose that connection in Codex, so it cannot be independently queried here |
| GitHub | Repository fetch and authenticated API reads work. Authenticated read-only hooks and deployments endpoints both return 200 with zero entries. Actions is enabled | Zero hooks/deployment records does not rule out external polling or a deployment platform. Main merge is not used as a discovery experiment |
| DNS/public HTTP | Both public names resolve to the observed edge address 172.64.80.1; HTTPS responds behind Cloudflare | Neither identifies the origin. No Cloudflare bypass or unrelated host scan is attempted |
| SSH/runtime | Local SSH config names GitHub only; no DigitalOcean/deployment credential is exposed by available environment variable names; no Docker CLI or usable WSL distribution is available locally | No verified origin hostname/login, shell/container access, process layout, proxy configuration, existing release manager or deployed image identity |
| Repository runtime | Dockerfile declares Node 20 Alpine. Local Node 20.20.2 reproduced a PNG fallback HTTP 500 from native WASM ESM import; Node 25 had worked | This proves a repository-runtime compatibility defect, not the historical phone incident or actual production Node version |

Private incident originals were not present at .tmp/iphone-incident or as a local incident archive at reconciliation. No private files were uploaded to GitHub, production or analytics. Physical iPhone access is absent. Do not infer DNG provenance from the screenshots.

## 1. Establish the actual target using read-only evidence

On an already authorized host/management connection, list services and locate the domain's routing configuration. Do not guess an IP or SSH login. If Docker is the established runtime, the following are read-only examples; use actual discovered container names:

```
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}'
docker inspect --format '{{.Name}} image={{.Image}} ref={{.Config.Image}} memory={{.HostConfig.Memory}} cpu={{.HostConfig.NanoCpus}}' SITE_CONTAINER
docker image inspect --format 'id={{.Id}} digests={{json .RepoDigests}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}' CURRENT_IMAGE_ID
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
```

Confirm the proxy routes www.ilovesvg.com to this exact service. Inspect only relevant upload/body/timeouts and forwarded-host/proto/origin policy in the existing proxy configuration. Keep full configuration, environment values, credentials and uploaded content private. Identify co-hosted websites and current health. Record image ID/digest, service definition/release ID, memory/CPU limits, application Node version, current compiled build and the established rollout/rollback commands privately. Record safe identifiers in the release record.

If any of these cannot be verified, stop the deployment lane and retain the pushed release PR. Do not increase server size, queue/concurrency or upload limits.

## 2. Build outside the shared one-core host

Use the isolated release branch and repository Dockerfile on the existing trusted build system. The technical CI workflow builds/tests Node 20 Alpine and labels its ephemeral image with the reviewed commit. No production secrets, raw photos or new registry credentials are required by CI. The updated .dockerignore excludes Git metadata, .tmp, tmp and logs; CI verifies synthetic context sentinels never enter the source image. Do not send the private originals as build context.

Use the site's established registry/artifact path only after that path and authentication are known. Do not introduce a new paid registry or rebuild heavy images on the shared Droplet without a measured resource plan. A passing CI image is compatibility evidence, not a production deployment.

## 3. Prove rollback before changing the service

Preserve the exact currently running image digest and release/service definition using the established manager. Verify that it remains available locally or in the current registry and can be selected without rebuilding. Preserve the existing environment, network, proxy, volumes, port mapping, health checks and restart policy; do not dump secrets into this repository.

Write the actual rollback command or manager action and recovery checks into the private operator record before rollout. f53292e is a source comparison point, not a verified production rollback image. If rollback cannot be executed with current access, deployment remains BLOCKED.

## 4. Validate the candidate at staging/local equivalence

Use the same image digest intended for rollout. Run the repository's typecheck/build/reliability, server-action, SEO/schema/routes and browser checks; force a compatible worker failure and verify real server fallback and SVG download. Check latest-source ownership, replacement, cancellation, alpha/orientation, ordinary JPEG metadata, and resource plateaus. The release must exclude the separate checkerboard quality candidate and all staged SEO/workflow/content changes.

Compare output hashes for known successful inputs. Keep 39 historical quality assertions as grouped prior evidence; do not turn them into 39 new release regressions or lower thresholds to hide them. Any new output discrepancy must be explained with same-source/settings/job evidence.

## 5. Controlled rollout and low-intensity verification

Only after all above fields exist, use the established deployment mechanism to promote the exact candidate image. Do not recreate the service with guessed configuration. Avoid running two heavy conversion replicas on the shared 2 GB host. Observe the configured health checks and co-hosted site health.

Verify the deployed image digest/revision from the runtime, then check public homepage, navigation, PNG/JPG upload-preview-download, one bounded oversized normalization, one forced compatible fallback, and representative SVG-to-PNG/PDF/editor utilities. Preserve route/canonical/schema/sitemap/robots and ad placeholder suppression. Use only small synthetic public smoke fixtures. Do not upload private phone originals or stress production with repeated huge images.

Compare host/container memory and CPU with the recorded baseline, verify one active native conversion and bounded waiters, inspect safe error/timeout counts, and confirm the co-hosted sites remain available. Record MERGED, DEPLOYED and PRODUCTION VERIFIED separately with exact SHAs/digests and observations.

## 6. Roll back on a verified regression

Use the previously written manager command/action to select the preserved old digest and unchanged service configuration. Verify site/co-host health and the original successful conversion corpus again. Do not compensate by increasing memory/concurrency, weakening origin checks or changing ads. Record the regression and actual rollback result; do not claim recovery from a successful command alone.

Weekly draft-only SEO preparation remains a separate installation decision after technical production verification. No content is approved or published by this runbook.
