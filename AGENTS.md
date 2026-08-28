# AGENTS.md — Todo Dark Factory

Bun monorepo (`apps/*`) driven by a Bachkator "dark factory": GitHub issues
tagged `factory` become a **single PR per item** — plan, implementation, demo
video, and the whole discussion live on that PR — with a `/approve` comment
gating every lane transition. Humans observe (and approve); agents ship.

## Single-PR lifecycle

```
issue (label: factory)
  └─ planner opens PR #N (commit 1: the plan)      → ⏸ ask
/approve plan
  └─ implementer continues ON the PR branch:
     code + tests + narrated demo video pushed
     publicly to S3                                 → 🛠 🧪 🎬 feed
/approve implement
  └─ merger verifies, publishes, announces          → 🚀
/approve merge
  └─ release: squash-merge → LOCAL deploy → ✅
/approve deploy.staging
```

## Feedback loop (use bach targets, not scripts)

Everything a human or agent needs runs through bach targets:

| Intent | Command |
| --- | --- |
| What is the factory doing? | `bach factory status todo` |
| Queue + lifecycles | `bach factory list todo --status all` |
| Give feedback / reject a stage | comment `/deny <reason>` on the item PR — the item is retried with your reason injected into the next plan (up to 3 rejections, then it fails with the last reason) |
| Approve a stage | comment `/approve <phase>` (plan, implement, merge, deploy.staging) on the item PR — bare `/approve` flowsthrough every remaining stage |
| Inspect an item | `bach factory inspect todo <item-id>` |
| Run tests | `bach run group/ci` (= `bun test` per app, JUnit quality gates) |
| Re-prove a deployment | `bach run pipeline/verify_lane` |
| Config sanity | `bach validate` |

**Agents mine feedback too**: the planner reads issue + PR comments as
requirements; the implementer reads PR comments as corrections and addresses
each one. Rejecting with a reason is therefore actionable — write what you
want changed, not just "no".

## Repository map

```
Bachfile              factory + lanes + quality gates (agents do the work)
apps/server           Bun + TypeScript todo HTTP API (SQLite via bun:sqlite)
apps/web              React + Vite SPA consuming the API
e2e/                  Playwright harness (authored by implementer agents)
plans/factory/        planner-authored Plan per work item
prompts/              agent contracts: planner, implementer, merger, reviewers
scripts/factory/      commit-msg validator only — all other work is agents
.bach/                Bach-owned state — never edit or commit it manually
```

## Commands

```sh
bach list                       # every target in the factory graph
bach run group/ci               # unit tests across apps
bach run pipeline/release_lane  # approved merge -> LOCAL deploy -> evidence
bach run pipeline/verify_lane   # re-proof of deployment + demo
bach validate                   # config sanity before pushing
bach factory status todo        # daemon lease + queue health
```

## Approval gates

Four gates, all on the item PR (polled by `bach-github-approval-provider`):
`plan`, `implement`, `merge`, `deploy.staging`. CLI equivalent if ever needed:

```sh
bach factory approve todo <item-id> --phase <phase>
```

## Commit instructions

Conventional Commits — `<type>(<scope>): <subject>`; types: `feat fix chore
docs refactor test perf ci`; scopes: `server web factory deps docs e2e`;
imperative, lowercase, no trailing period, ≤72 chars. One logical change per
commit; agents push their work branch (`bach/work/...`) to the `github`
remote, never to `main`. Validate a subject with:

```sh
printf 'feat(server): add crud routes\n' > /tmp/msg.txt
sh scripts/factory/commit-msg.sh /tmp/msg.txt   # COMMIT MSG OK
```

Never commit secrets, `dist/`, `data/`, `node_modules/`, `.bach/`, or env files.

## Work expectations

- Plan first, this file second, then code.
- Feature = tests beside sources + (when user-visible) a paced
  `e2e/<feature>.spec.ts` per the narrated-demo skill + the recorded,
  narrated `demo-artifacts/demo.mp4` pushed publicly to S3 by you.
- Deployments are LOCAL; the only cloud egress is the public demo video.
- Honest reports: `blocked` beats fake `passed`.
