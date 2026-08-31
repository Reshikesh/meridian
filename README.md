# Meridian v1 — handoff for the owner

Everything Claude Code needs is in this folder. You do four things.

1. **Add the mockup.** Export `Meridian Redesign.dc.html` from Claude Design into `design/` (see `design/README.md`).
2. **Start Phase 0.** Open a terminal in this folder, start Claude Code, paste the Phase 0 prompt from `docs/BUILD-PLAN.md`. Approve or correct its plan, then let it build.
3. **Check each checkpoint yourself.** The checks are written per phase in `docs/BUILD-PLAN.md`; report problems as a numbered list using the template at the end of that file. Say "phase N accepted" when it passes.
4. **After Phase 5**, give your friend `dist/meridian-v1.zip` and `dist/README-for-tester.md`.

What the files are:

- `CLAUDE.md` — read automatically by Claude Code every session: stack, constraints, working rules.
- `docs/DECISIONS.md` — the 22 product decisions, final.
- `docs/MERIDIAN-SPEC-v1.1.md` — the spec extracted from the mockup, with the agreed corrections applied.
- `docs/QUALITY-BAR.md` — what "professional quality" means here, as pass/fail checks.
- `docs/BUILD-PLAN.md` — the six phases, prompts, acceptance, checkpoints.
- `docs/DECISION-LOG.md` — Claude Code records its technical choices here.
- `design/` — screenshots, deck, and (once you add it) the mockup.
- `data/` — where exported workbooks live.

Rules of thumb while building: one phase per session; plan before code; never accept "done" without opening `index.html` yourself in Chrome and Firefox; when in doubt, ask Claude Code to compare the screen with the reference screenshot side by side.
