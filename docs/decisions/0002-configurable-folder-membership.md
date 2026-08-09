# ADR 0002: Configurable folder membership

- Status: Accepted
- Date: 2026-08-09
- Scope: Folder membership for virtual links in the global graph.

## Context

ADR 0001 assigns each visible note to its direct parent folder. That keeps every
nested folder separate, but some vaults use nested folders as one broader area.
Users also need to prevent selected folder trees from receiving virtual links.

The sparse topology and native graph integration from ADR 0001 remain suitable.
Only the function that assigns visible notes to folder groups needs to change.

## Decision

Add a folder grouping depth setting with these modes:

- **Direct parent**, the default, preserves the membership defined by ADR 0001.
- A numeric depth groups a note by the first N segments of its parent folder.
  Depth 1 groups all nested notes under their top-level folder. If a note's
  parent is shallower than N, its complete parent path is used.

Root notes remain in the root group in every mode.

Add an excluded-folders setting. Users select folders from the vault through a
search modal. A selected folder and every descendant folder are omitted from
folder membership before grouping depth is applied. The vault root is not an
exclusion option.

The deterministic sparse topology in ADR 0001 is then generated independently
for every resulting group. Exclusions and depth never add hidden graph nodes or
change note files, metadata, or native graph filters.

## Consequences

- Existing installations retain direct-parent behavior after upgrading.
- Numeric depth can connect visible notes across nested folders that share the
  selected ancestor.
- Excluding a parent makes redundant descendant exclusions unnecessary.
- Changing either setting rebuilds all open global graph views immediately.
- Folder contours remain deferred until the link-only result is evaluated.
