# Changelog

## 0.3.0 - 2026-08-09

- Add deterministic, labeled folder contours to the native global graph.
- Follow native graph animation, dragging, pan, zoom, filters, folder depth, and
  exclusions without a separate animation loop.
- Add a setting to show or hide contours independently of virtual links.

## 0.2.0 - 2026-08-09

- Add configurable direct-parent or numeric-depth folder grouping.
- Add a searchable folder picker for excluding folder subtrees.
- Preserve direct-parent behavior when migrating existing settings.

## 0.1.1 - 2026-08-09

- Stop topology matching attempts from changing shared adjacency data.
- Restore renderer methods when graph views close.
- Avoid duplicate refreshes when rebuilding open graphs.
- Add formatting and type-aware lint checks.
- Shorten settings text and document contribution rules.

## 0.1.0 - 2026-08-09

- Add deterministic degree-3 and degree-4 folder clustering topologies.
- Feed virtual links into the native global graph worker while removing them from
  foreground rendering and hover relationships.
- Preserve native graph filters, controls, animation, and real link metadata.
- Add BRAT-compatible release assets and compatibility guards for Obsidian 1.13.4.
