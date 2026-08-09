# ADR 0001: Folder clustering with sparse virtual links

- Status: Accepted
- Date: 2026-08-09
- Scope: Global graph view only; folder contours are explicitly deferred.

## Context

The goal is to make notes in the same direct parent folder settle into a natural
cluster while preserving the core graph view's rendering, interaction, and
animation. Notes and Obsidian's metadata cache must remain unchanged.

Obsidian does not expose a supported graph-rendering API. The public Plugin API
can locate workspace views, but the graph renderer and its worker are internal.
Obsidian staff have also described the graph implementation as complex and not
currently exposed as an API. Existing graph extensions therefore wrap the
renderer's internal `setData` method.

The core worker accepts one global link distance and strength. It does not expose
per-link spring parameters. A virtual edge can therefore be sparse or omitted,
but cannot have a different spring constant without replacing or patching the
core worker.

## Decision

For every direct parent folder represented in the currently visible global graph:

1. Sort the member paths by a seeded hash and connect them in one Hamiltonian
   cycle. This guarantees connectivity without a hub.
2. Add deterministic, independently shuffled matching edges until every node has
   virtual degree 3 by default, or degree 4 when selected in settings.
3. If an odd node count makes a 3-regular graph impossible, one deterministic
   node receives degree 4. Small folders use the largest possible simple graph.
4. Reject self-links, duplicate links, and any pair already joined by a real link.

The result is an expander-style sparse topology: O(n) edges, balanced degree, no
privileged centroid note, deterministic output, and much shorter paths than a
plain ring. Random regular graphs are known to have logarithmic diameter with
high probability; short internal paths distribute the spring attraction across
the folder rather than producing a long chain.

The plugin wraps a global graph renderer's `setData` method. It passes a cloned,
augmented data object to the native renderer/worker, then removes the virtual
link objects from the foreground renderer immediately after the worker receives
them. The worker retains the springs, while the canvas, hover relationships,
backlinks, metadata cache, and vault files retain only real links.

## Why not the alternatives?

- Clique: O(n²) links and excessive compression.
- Star or virtual centroid: creates a high-degree hub and would require a fake
  rendered node or a custom force.
- Plain ring: O(n) links, but linear diameter tends to form ropes or arcs.
- Per-frame folder gravity: positions written in the renderer are overwritten by
  the worker and can drift out of sync with native pan/zoom and animation.
- A fully custom graph view: supports custom forces and contours, but forfeits the
  exact native graph feel that this project prioritizes.

## Compatibility boundary

This design deliberately uses an undocumented internal API. It must fail open:
if the renderer shape changes, the native graph still renders without virtual
links. Every release must be tested against the current public Obsidian build.

Virtual links use the core graph's global spring strength. Degree 3 is the safe
default because sparsity controls the total extra attraction. Degree 4 is an
opt-in stronger cluster. The graph's existing link distance and link strength
controls continue to affect both real and virtual links.

## Evidence

- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api) contains no
  supported graph renderer interface.
- [Obsidian staff response on the graph rendering API](https://forum.obsidian.md/t/graph-rendering-api/73378/2)
  explains why no graph API is currently available.
- [Nested Tags Graph](https://github.com/drPilman/obsidian-graph-nested-tags/blob/master/src/main.ts)
  demonstrates the established `renderer.setData` wrapping point.
- [Fruchterman and Reingold, Graph drawing by force-directed placement](https://doi.org/10.1002/spe.4380211102)
  describes edge attraction and node repulsion in force-directed layouts.
- [Noack, Modularity clustering is force-directed layout](https://doi.org/10.1103/PhysRevE.79.026102)
  connects attraction/repulsion energy models with community structure.
- [Shimizu, The Diameter of Dense Random Regular Graphs](https://doi.org/10.1137/1.9781611975031.126)
  summarizes the logarithmic-diameter result for fixed-degree random regular
  graphs.

## Consequences

- Native animation, dragging, zoom, filters, and color groups remain native.
- Only nodes already selected by the core graph are clustered; virtual links do
  not force hidden or filtered notes into view.
- Folder membership means the direct parent folder, not every ancestor folder.
- Contours remain a separate later decision after the link-only result is judged.
- Obsidian internal changes may require a compatibility release.
