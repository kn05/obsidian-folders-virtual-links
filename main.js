"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FolderVirtualLinksPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/folder-clustering/constants.ts
var DEFAULT_SETTINGS = {
  topologyDegree: 3
};
var TOPOLOGY_ATTEMPTS = 512;

// src/folder-clustering/topology.ts
var EDGE_SEPARATOR = "\0";
function edgeKey(left, right) {
  return left < right ? `${left}${EDGE_SEPARATOR}${right}` : `${right}${EDGE_SEPARATOR}${left}`;
}
function hash32(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function compareBySalt(left, right, salt) {
  const hashDifference = hash32(`${salt}:${left}`) - hash32(`${salt}:${right}`);
  return hashDifference || left.localeCompare(right);
}
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = state + 1831565813 >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled(values, seed) {
  const result = [...values];
  const random = createRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = value;
  }
  return result;
}
function addEdge(edges, adjacency, source, target) {
  var _a, _b, _c;
  if (source === target || ((_a = adjacency.get(source)) == null ? void 0 : _a.has(target))) return false;
  (_b = adjacency.get(source)) == null ? void 0 : _b.add(target);
  (_c = adjacency.get(target)) == null ? void 0 : _c.add(source);
  edges.push({ source, target });
  return true;
}
function clique(paths) {
  const edges = [];
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      edges.push({ source: paths[left], target: paths[right] });
    }
  }
  return edges;
}
function makeStubs(paths, adjacency, targetDegree, parityNode) {
  var _a, _b;
  const stubs = [];
  for (const path of paths) {
    const goal = targetDegree + (path === parityNode ? 1 : 0);
    const deficit = goal - ((_b = (_a = adjacency.get(path)) == null ? void 0 : _a.size) != null ? _b : 0);
    for (let count = 0; count < deficit; count += 1) stubs.push(path);
  }
  return stubs;
}
function addStubPairs(edges, baseAdjacency, stubs, seed) {
  const candidateAdjacency = /* @__PURE__ */ new Map();
  for (const [path, neighbors] of baseAdjacency) {
    candidateAdjacency.set(path, new Set(neighbors));
  }
  const candidateEdges = [];
  const candidates = shuffled(stubs, seed);
  for (let index = 0; index < candidates.length; index += 2) {
    const source = candidates[index];
    const target = candidates[index + 1];
    if (source === void 0 || target === void 0) return false;
    if (!addEdge(candidateEdges, candidateAdjacency, source, target)) return false;
  }
  edges.push(...candidateEdges);
  for (const [path, neighbors] of candidateAdjacency) {
    const destination = baseAdjacency.get(path);
    if (destination instanceof Set) {
      destination.clear();
      for (const neighbor of neighbors) destination.add(neighbor);
    }
  }
  return true;
}
function buildFolderTopology(memberPaths, requestedDegree, folderSeed) {
  const paths = [...new Set(memberPaths)].sort(
    (left, right) => compareBySalt(left, right, `${folderSeed}:cycle`)
  );
  const nodeCount = paths.length;
  if (nodeCount < 2) return [];
  const targetDegree = Math.min(requestedDegree, nodeCount - 1);
  if (targetDegree === nodeCount - 1) return clique(paths);
  const adjacency = new Map(paths.map((path) => [path, /* @__PURE__ */ new Set()]));
  const edges = [];
  for (let index = 0; index < nodeCount; index += 1) {
    addEdge(
      edges,
      adjacency,
      paths[index],
      paths[(index + 1) % nodeCount]
    );
  }
  if (targetDegree <= 2) return edges;
  const needsParityNode = nodeCount * targetDegree % 2 === 1;
  const parityNode = needsParityNode ? paths[0] : void 0;
  const stubs = makeStubs(paths, adjacency, targetDegree, parityNode);
  for (let attempt = 0; attempt < TOPOLOGY_ATTEMPTS; attempt += 1) {
    const attemptSeed = hash32(`${folderSeed}:matching:${attempt}`);
    if (addStubPairs(edges, adjacency, stubs, attemptSeed)) return edges;
  }
  throw new Error(`Could not construct folder topology for ${folderSeed}`);
}

// src/folder-clustering/graph-data.ts
function directParent(path) {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}
function markdownFolders(nodes) {
  var _a;
  const folders = /* @__PURE__ */ new Map();
  for (const [path, node] of Object.entries(nodes)) {
    if (node.type !== "") continue;
    const folder = directParent(path);
    const members = (_a = folders.get(folder)) != null ? _a : [];
    members.push(path);
    folders.set(folder, members);
  }
  return folders;
}
function hasLink(data, source, target) {
  var _a, _b;
  return ((_a = data.nodes[source]) == null ? void 0 : _a.links[target]) === true || ((_b = data.nodes[target]) == null ? void 0 : _b.links[source]) === true;
}
function augmentGraphData(original, topologyDegree) {
  const nodes = { ...original.nodes };
  const clonedSources = /* @__PURE__ */ new Set();
  const virtualEdgeKeys = /* @__PURE__ */ new Set();
  let addedLinks = 0;
  const folders = [...markdownFolders(original.nodes)].sort(
    ([left], [right]) => left.localeCompare(right)
  );
  for (const [folder, members] of folders) {
    for (const edge of buildFolderTopology(members, topologyDegree, folder || "<root>")) {
      if (hasLink(original, edge.source, edge.target)) continue;
      if (!clonedSources.has(edge.source)) {
        const sourceNode2 = original.nodes[edge.source];
        if (sourceNode2 === void 0) continue;
        nodes[edge.source] = { ...sourceNode2, links: { ...sourceNode2.links } };
        clonedSources.add(edge.source);
      }
      const sourceNode = nodes[edge.source];
      if (sourceNode === void 0 || sourceNode.links[edge.target] === true) continue;
      sourceNode.links[edge.target] = true;
      virtualEdgeKeys.add(edgeKey(edge.source, edge.target));
      addedLinks += 1;
    }
  }
  return {
    data: addedLinks === 0 ? original : { ...original, nodes, numLinks: original.numLinks + addedLinks },
    virtualEdgeKeys
  };
}

// src/folder-clustering/bridge.ts
function deleteLinkReference(lookup, id, link) {
  if ((lookup == null ? void 0 : lookup[id]) === link) delete lookup[id];
}
function stripVirtualLinks(renderer, virtualEdgeKeys) {
  var _a, _b, _c, _d, _e, _f, _g;
  if (virtualEdgeKeys.size === 0 || !Array.isArray(renderer.links)) return;
  const visibleLinks = [];
  for (const link of renderer.links) {
    const sourceId = (_a = link.source) == null ? void 0 : _a.id;
    const targetId = (_b = link.target) == null ? void 0 : _b.id;
    if (typeof sourceId !== "string" || typeof targetId !== "string" || !virtualEdgeKeys.has(edgeKey(sourceId, targetId))) {
      visibleLinks.push(link);
      continue;
    }
    try {
      (_c = link.clearGraphics) == null ? void 0 : _c.call(link);
    } catch (error) {
      console.warn("Folder Virtual Links could not clear hidden link graphics", error);
    }
    link.rendered = false;
    deleteLinkReference(link.source.forward, targetId, link);
    deleteLinkReference(link.source.reverse, targetId, link);
    deleteLinkReference(link.target.forward, sourceId, link);
    deleteLinkReference(link.target.reverse, sourceId, link);
  }
  renderer.links.splice(0, renderer.links.length, ...visibleLinks);
  for (const node of (_d = renderer.nodes) != null ? _d : []) {
    node.weight = Object.keys((_e = node.forward) != null ? _e : {}).length + Object.keys((_f = node.reverse) != null ? _f : {}).length;
  }
  (_g = renderer.changed) == null ? void 0 : _g.call(renderer);
}
function asGraphView(leaf) {
  if (leaf.view.getViewType() !== "graph") return void 0;
  return leaf.view;
}
function refreshView(view) {
  var _a, _b;
  if (typeof view.update === "function") {
    view.update();
    return;
  }
  (_b = (_a = view.dataEngine) == null ? void 0 : _a.render) == null ? void 0 : _b.call(_a);
}
var NativeGraphBridge = class {
  constructor(app, getTopologyDegree) {
    __publicField(this, "app", app);
    __publicField(this, "getTopologyDegree", getTopologyDegree);
    __publicField(this, "patches", /* @__PURE__ */ new Map());
  }
  patchOpenGraphs() {
    for (const leaf of this.app.workspace.getLeavesOfType("graph")) {
      const view = asGraphView(leaf);
      const renderer = view == null ? void 0 : view.renderer;
      if (view === void 0 || renderer === void 0 || this.patches.has(renderer)) continue;
      if (typeof renderer.setData !== "function") continue;
      const patch = this.patchRenderer(view, renderer);
      this.patches.set(renderer, patch);
      refreshView(view);
    }
  }
  refreshAll() {
    this.patchOpenGraphs();
    for (const patch of this.patches.values()) {
      if (patch.active) refreshView(patch.view);
    }
  }
  dispose() {
    for (const patch of this.patches.values()) {
      patch.active = false;
      if (patch.renderer.setData === patch.wrapper) {
        patch.renderer.setData = patch.originalSetData;
      }
      refreshView(patch.view);
    }
    this.patches.clear();
  }
  patchRenderer(view, renderer) {
    const originalSetData = renderer.setData;
    const patch = {
      active: true,
      originalSetData,
      renderer,
      view
    };
    patch.wrapper = (data) => {
      if (!patch.active) return originalSetData.call(renderer, data);
      try {
        const augmented = augmentGraphData(data, this.getTopologyDegree());
        const result = originalSetData.call(renderer, augmented.data);
        stripVirtualLinks(renderer, augmented.virtualEdgeKeys);
        return result;
      } catch (error) {
        console.error("Folder Virtual Links disabled clustering for this graph update", error);
        return originalSetData.call(renderer, data);
      }
    };
    renderer.setData = patch.wrapper;
    return patch;
  }
};

// src/folder-clustering/settings.ts
var import_obsidian = require("obsidian");
var FolderVirtualLinksSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  display() {
    this.containerEl.empty();
    new import_obsidian.Setting(this.containerEl).setName("Folder topology degree").setDesc(
      "3 is the balanced default. 4 adds a stronger folder pull. Native link strength and distance apply to both real and virtual links."
    ).addDropdown((dropdown) => {
      dropdown.addOption("3", "3 (balanced)").addOption("4", "4 (stronger)").setValue(String(this.plugin.settings.topologyDegree)).onChange(async (value) => {
        const topologyDegree = value === "4" ? 4 : 3;
        await this.plugin.updateTopologyDegree(topologyDegree);
      });
    });
  }
};

// src/main.ts
var FolderVirtualLinksPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULT_SETTINGS });
    __publicField(this, "bridge");
    __publicField(this, "isActive", false);
  }
  async onload() {
    this.isActive = true;
    await this.loadSettings();
    this.bridge = new NativeGraphBridge(this.app, () => this.settings.topologyDegree);
    this.addSettingTab(new FolderVirtualLinksSettingTab(this.app, this));
    this.addCommand({
      id: "rebuild-folder-virtual-links",
      name: "Rebuild folder virtual links",
      callback: () => {
        var _a;
        return (_a = this.bridge) == null ? void 0 : _a.refreshAll();
      }
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      var _a;
      return (_a = this.bridge) == null ? void 0 : _a.patchOpenGraphs();
    }));
    this.app.workspace.onLayoutReady(() => {
      var _a;
      if (this.isActive) (_a = this.bridge) == null ? void 0 : _a.patchOpenGraphs();
    });
  }
  onunload() {
    var _a;
    this.isActive = false;
    (_a = this.bridge) == null ? void 0 : _a.dispose();
    this.bridge = void 0;
  }
  async updateTopologyDegree(topologyDegree) {
    var _a;
    this.settings.topologyDegree = topologyDegree;
    await this.saveData(this.settings);
    (_a = this.bridge) == null ? void 0 : _a.refreshAll();
  }
  async loadSettings() {
    const stored = await this.loadData();
    this.settings = {
      topologyDegree: (stored == null ? void 0 : stored.topologyDegree) === 4 ? 4 : DEFAULT_SETTINGS.topologyDegree
    };
  }
};
