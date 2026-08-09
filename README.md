# Folder Virtual Links

Folder Virtual Links groups notes from the same folder in Obsidian's global graph.
It adds deterministic virtual links to the graph simulation without changing notes
or metadata.

Virtual links are not drawn and do not appear in hover relationships. Obsidian
still controls rendering, dragging, pan and zoom, filters, colors, and animation.

## How it clusters

Each direct parent folder receives a connected sparse topology without a hub. A
seeded cycle connects the notes. Deterministic matching edges produce degree 3 by
default. Degree 4 is available for tighter clusters. See
[ADR 0001](docs/decisions/0001-folder-clustering-topology.md) for the algorithm.

Virtual springs use Obsidian's current global link distance and link strength.
The worker has no per-link spring setting. The topology degree controls the added
attraction.

## Install with BRAT

1. Install and enable BRAT.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `kn05/obsidian-folders-virtual-links`.
4. Enable **Folder Virtual Links** in Community plugins.
5. Open or refresh the global graph view.

Use **Settings > Folder Virtual Links > Folder topology degree** to choose degree
3 or 4. **Rebuild folder virtual links** applies the current setting.

## Safety and scope

- Vault files and note contents are never read or written by the plugin.
- The metadata cache and backlink index are not modified.
- Only markdown nodes already selected by the native global graph are clustered.
- Folder membership is the direct parent folder.
- Local graph views and folder contours are not changed.

## Compatibility

Obsidian has no public graph renderer API. This plugin uses a guarded integration
with the native renderer. If the renderer interface changes, the plugin leaves
the native graph data unchanged.

## Development

```bash
npm install
npm test
npm run build
```

The BRAT release assets are `main.js`, `manifest.json`, and `styles.css`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for code and release conventions.
