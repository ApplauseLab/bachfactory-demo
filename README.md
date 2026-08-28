# Todo Dark Factory

A Bachkator-powered **dark factory**: GitHub issues go in at one end, verified — narrated demo video included — features come out the other end, and humans only touch two approval gates.

```
GitHub issue (label: factory)
        │  bach-github-issue-trigger polls every minute
        ▼
┌─────────────────────────────────────────────────────────────┐
│ workflow "ship"                                             │
│                                                             │
│  plan ──► [GATE 1: plan approval] ──► implement ──► review  │
│                                            │                │
│             merge phase                    ▼                │
│   demo_lane: build item → record ITS feature video →        │
│              narrate → public S3 upload → open PR w/ link   │
│                                            │                │
│             deploy phase                   ▼                │
│   [GATE 2: PR approved + deploy.staging approval]           │
│   release_lane: squash-merge PR → LOCAL deploy → evidence   │
│                                                             │
│  verify phase: re-prove manifest + live video URL           │
└─────────────────────────────────────────────────────────────┘
```

## Principles

- **Humans observe; agents ship.** Exactly two gates: plan approval and deploy approval.
- **Everything deploys locally.** The only cloud egress is each work item's public demo video on S3.
- **One video per feature.** Every work item authors its own paced Playwright spec; the factory records, narrates, publishes, and links that exact video in the item's PR.
- **Zero mystery logic in HCL.** Every lane step is a documented script under `scripts/factory/`; the Bachfile only wires targets, gates, and phases.
- **Honest skips.** Lanes degrade gracefully before apps exist (`SKIPPED`) but never fake success.

## Prerequisites

| Tool | Why | Check |
| --- | --- | --- |
| `bach` | factory control plane | `bach --version` |
| `bach-github-issue-trigger` | polls GitHub issues as Work Item intake | installed at `~/.local/bin/bach-github-issue-trigger` |
| `gh` (authed) | issues / PRs / merges | `gh auth status` |
| `bun` | monorepo runtime + test runner | `bun --version` |
| `opencode` | planner/implementer/reviewer providers | `opencode --version` |
| `ffmpeg`, `ffprobe`, `python3` | demo recording/narration/merge | `ffmpeg -version` |
| AWS CLI + bucket | **optional** — public video hosting; without `s3_bucket` set, uploads skip | `aws sts get-caller-identity` |
| Snitch (Kokoro) | optional narration voice; silent cut otherwise | port `4766` |

## Layout

See [`AGENTS.md`](AGENTS.md) for the repository map and lane-script table.

## Operating the factory

```sh
export GITHUB_TOKEN="$(gh auth token)"     # trigger provider token_env
export DARK_FACTORY_S3_BUCKET="my-bucket"  # optional; skip when unset

# intake is automatic, but you can also file items by hand:
bach factory submit todo \
  --title "Ship the health endpoint" \
  --body "GET /health must answer {status:ok}." \
  --label factory

bach factory start todo --yes      # the lights go out; agents take over
bach factory status todo           # lease + lifecycle counts

# when an item parks waiting_approval, look then act:
plans/factory/<item>.md            # read the authored plan
bach factory approve todo <id> --phase plan

open <pr-url>                      # review the diff + demo video, approve on GitHub
bach factory approve todo <id> --phase deploy.staging
```

Artifacts per item land under `dist/`: `<slug>-demo.mp4`, `demo-url.txt`,
`pr-url.txt`, `deploy-manifest.json`. Run history lives in `.bach/runs/`
(`bach runs list`, `bach logs <run-id>`).

## Quality gates

| Gate | Enforced by | Fails when |
| --- | --- | --- |
| API unit tests | `quality/shell.server_test` (JUnit) | any failed test |
| Web unit tests | `quality/shell.web_test` (JUnit) | any failed test |
| Architecture review | reviewer agent | open error-severity finding |
| Security review | reviewer agent | open error-severity finding |
| Post-implementation CI | policy `required_targets: shell.server_test` inside workspace | red suite before review starts |
| Demo record | `fail_when E2E FAILED` | specs red / no video captured |
| Evidence | `verify-evidence.sh` | no deploy manifest or dead video URL |

## Local development

```sh
bun install
bach run group/ci                 # both unit gates
bun test apps/server              # direct single app
bach run pipeline/demo_lane       # rehearse the full demo pipeline manually
```

Commits follow Conventional Commits (validator: `scripts/factory/commit-msg.sh`). See AGENTS.md rules 1–7.
