# Project instructions

- This repository builds an Obsidian plugin intended for installation with BRAT.
- Never write to `/home/alice/vaults/main` or to any note in that vault. Read-only
  inspection is allowed when it is needed for validation.
- Keep folder clustering code together under `src/folder-clustering`.
- Do not add folder contours until the link-only result has been evaluated.
- The accepted clustering algorithm is recorded in
  `docs/decisions/0001-folder-clustering-topology.md`; change it through a new ADR.
- Every repository change must finish with a successful build and a GitHub release.
  Release tags must exactly match `manifest.json` and must attach `main.js`,
  `manifest.json`, and `styles.css` for BRAT.
