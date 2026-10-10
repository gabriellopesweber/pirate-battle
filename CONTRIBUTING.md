# Contributing

## Plans become issues before code

Every approved plan becomes trackable GitHub issues before implementation starts. A plan that
lives only in a conversation disappears; what remains is commits without the *why*.

| Plan size | Structure |
|---|---|
| Up to ~3 deliverables | **one issue**, plan in the body, task checklist |
| 4+ deliverables | **epic** issue + native **sub-issues**, plan file in `docs/plans/in-progress/` |

Every item in a plan file names its issue as soon as the issue exists. When an epic closes, its
plan file moves to `docs/plans/done/` with the status block rewritten.

### Priority is consequence, not effort

| Label | Meaning |
|---|---|
| `p1` | the game is not playable, not deployed, or a mandatory rule is broken |
| `p2` | a scored requirement that will be checked explicitly |
| `p3` | polish — improves the impression, nobody fails without it |

### The epic records what the plan *became*

An epic body has four sections, in order: **Goal** (the states to make impossible),
**Deliverables**, **Divergences** (what was done differently and why — written when decided), and
**Found along the way** (defects the plan did not foresee, each with its own issue). It closes only
with the last two written.

## Workflow

`main` is the default branch and is deployed to production.

1. Pick an issue and open a branch from `main` linked to it:
   `gh issue develop <n> --checkout --base main`
2. Commit in small steps, staging files explicitly (never `git add .`)
3. Open a PR into `main` with `Closes #<n>`; CI must pass
4. Merge and delete the branch

CI runs on pull requests only, against the PR merged into the current `main` — it does not run
again after the merge. So a PR must be **up to date with `main`** when it is merged: if `main`
moved after the last CI run, update the branch and let CI run again first.

**Documentation-only changes** (plans, `docs/`, this file) go straight to `main` — no issue, no PR.
Documentation that accompanies a code change goes in the same PR as the code.

A defect found while working on something else gets its own issue — never a silent fix inside
another deliverable.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`,
`chore:`, `refactor:`, `perf:`. Imperative mood, subject under 72 characters, a body explaining
*why* when it is not obvious.

## Before opening a PR

```bash
pnpm check        # lint + typecheck + unit + build
pnpm test:e2e     # when player-visible behaviour changed
```
