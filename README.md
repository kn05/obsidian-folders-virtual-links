# Folder Virtual Links

Folder Virtual Links groups notes by folder in Obsidian's global graph. It adds
deterministic virtual links to the graph simulation without changing notes or
metadata.

Virtual links are not drawn and do not appear in hover relationships. Obsidian
still controls rendering, dragging, pan and zoom, filters, colors, and animation.

## How it clusters

Each folder group receives a connected sparse topology without a hub. A seeded
cycle connects the notes. Deterministic matching edges produce degree 3 by
default. Degree 4 is available for tighter clusters. See
[ADR 0001](docs/decisions/0001-folder-clustering-topology.md) for the topology.

Direct-parent grouping is the default. A numeric folder depth can combine nested
folders at a selected ancestor, and selected folder trees can be excluded. See
[ADR 0002](docs/decisions/0002-configurable-folder-membership.md) for membership
rules.

Virtual springs use Obsidian's current global link distance and link strength.
The worker has no per-link spring setting. The topology degree controls the added
attraction.

## Install with BRAT

1. Install and enable BRAT.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `kn05/obsidian-folders-virtual-links`.
4. Enable **Folder Virtual Links** in Community plugins.
5. Open or refresh the global graph view.

Under **Settings > Folder Virtual Links**:

- **Folder topology degree** chooses degree 3 or 4.
- **Folder grouping depth** keeps direct parents separate or groups notes at a
  selected ancestor depth.
- **Excluded folders** opens a searchable folder picker. Each selected folder
  and all of its subfolders are ignored.

Settings apply immediately. **Rebuild folder virtual links** reapplies the
current settings manually.

## Safety and scope

- Vault files and note contents are never read or written by the plugin.
- The metadata cache and backlink index are not modified.
- Only markdown nodes already selected by the native global graph are clustered.
- Folder membership follows the selected grouping depth and exclusions.
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
