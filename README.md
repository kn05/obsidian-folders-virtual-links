# Folder Virtual Links

Folder Virtual Links makes notes in the same folder settle into natural clusters
inside Obsidian's native global graph view. It adds deterministic virtual springs
to the graph simulation without writing links into notes or changing the metadata
cache.

The virtual links are not drawn and do not appear as hover relationships. The
native graph still owns rendering, dragging, pan/zoom, filters, colors, and its
fluid layout animation.

## How it clusters

Each direct parent folder receives a connected, hub-free sparse topology. A
seeded cycle guarantees connectivity, and deterministic matching edges bring the
folder topology to degree 3 by default. Degree 4 is available in settings for a
stronger pull. See [ADR 0001](docs/decisions/0001-folder-clustering-topology.md)
for the algorithm choice and rejected alternatives.

Virtual springs use Obsidian's current global link distance and link strength.
The internal worker does not expose a separate per-link spring strength, so the
plugin controls the additional attraction through sparse degree instead.

## Install with BRAT

1. Install and enable BRAT.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `kn05/obsidian-folders-virtual-links`.
4. Enable **Folder Virtual Links** in Community plugins.
5. Open or refresh the global graph view.

Use **Settings → Folder Virtual Links → Folder topology degree** to choose
degree 3 or 4. The command **Rebuild folder virtual links** restarts the graph
with the current setting.

## Safety and scope

- Vault files and note contents are never read or written by the plugin.
- The metadata cache and backlink index are not modified.
- Only markdown nodes already selected by the native global graph are clustered.
- Folder membership is the direct parent folder.
- Local graph views and folder contours are not changed.

## Compatibility

Obsidian does not provide a public graph-renderer API, so this plugin uses a small,
guarded integration with the native renderer. If that internal shape changes, the
plugin fails open and leaves the native graph unmodified. Compatibility is tested
against the current public Obsidian release for each plugin release.

## Development

```bash
npm install
npm test
npm run build
```

The BRAT release assets are `main.js`, `manifest.json`, and `styles.css`.
