# ADR 0003: Native graph folder contours

- Status: Accepted
- Date: 2026-08-09
- Scope: Global graph view folder-area rendering after the link-only evaluation.

## Context

The sparse virtual links from ADR 0001 make notes in the same configured folder
group settle together without changing vault files. After evaluating that
link-only result, the remaining goal is to make each group's visual territory
explicit while preserving the native graph's animation, dragging, pan, zoom,
filters, and node interactions.

Obsidian still exposes no supported graph-rendering API. Its internal graph
renderer does expose live node coordinates and renders PIXI display objects
under a shared world-space container. It also calls `renderCallback` for every
native graph frame while the simulation or interaction is active.

## Decision

Add one non-interactive PIXI layer at the back of the native global graph's
world-space container. For every currently visible folder group:

1. Read the current positions of the group's visible Markdown nodes.
2. Compute their convex hull and expand it by a fixed visual padding. Expansion
   samples a circle around the hull vertices, producing a circle for one node,
   a capsule for two nodes, and a rounded convex contour for larger groups.
3. Draw a deterministic folder-colored border and translucent fill, with the
   folder path at the contour's upper edge.
4. Update geometry immediately before the native `renderCallback`, so contours
   follow worker animation and dragging while inheriting native pan and zoom
   from the shared container.

Folder membership, grouping depth, exclusions, and the root group are exactly
the same as for virtual links. Contours are enabled by default and can be
disabled independently. They never participate in physics or pointer events.

## Why a padded convex hull?

- A bounding rectangle is robust but represents sparse diagonal groups poorly.
- A concave hull or density-field contour can avoid unrelated nodes more
  precisely, but introduces sensitive tuning, heavier per-frame work, and
  possible self-intersections or disconnected islands.
- A padded convex hull is deterministic, fast, visually stable during motion,
  and sufficient when the accepted virtual-link topology has already made
  folder groups compact.

If evaluation shows that overlapping or strongly concave groups are common, a
future ADR can replace only the contour geometry without changing the accepted
clustering topology.

## Compatibility boundary

The layer depends on the undocumented `renderer.hanger`, live node `x`/`y`
coordinates, and `renderer.renderCallback`. The bridge must validate those
members and fail open: an incompatible renderer continues to show the native
graph and virtual-link clustering without contours.

The layer is removed and the wrapped callback is restored when a graph closes
or the plugin unloads. If another plugin has wrapped the callback after this
plugin, deactivation leaves that wrapper in place and makes this plugin's
wrapper a pass-through.

## Consequences

- Contours track native graph motion without a second animation loop.
- Pan and zoom require no coordinate conversion because the contour layer shares
  the native graph's world transform.
- Geometry work is limited to frames the native renderer already requests, and
  unchanged groups reuse their previous graphics.
- Convex contours may include unrelated nodes when folder groups interleave.
- The feature has the same internal-API compatibility risk as virtual links and
  must be tested against the current public Obsidian desktop build.
