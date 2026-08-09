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

// src/folder-clustering/contour-geometry.ts
function cross(origin, left, right) {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}
function uniqueFinitePoints(points) {
  const result = /* @__PURE__ */ new Map();
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    result.set(`${String(point.x)}\0${String(point.y)}`, point);
  }
  return [...result.values()];
}
function convexHull(points) {
  const sorted = uniqueFinitePoints(points).sort(
    (left, right) => left.x - right.x || left.y - right.y
  );
  if (sorted.length <= 1) return sorted;
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2) {
      const origin = lower[lower.length - 2];
      const left = lower[lower.length - 1];
      if (origin === void 0 || left === void 0) break;
      if (cross(origin, left, point) > 0) break;
      lower.pop();
    }
    lower.push(point);
  }
  const upper = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2) {
      const origin = upper[upper.length - 2];
      const left = upper[upper.length - 1];
      if (origin === void 0 || left === void 0) break;
      if (cross(origin, left, point) > 0) break;
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
function paddedConvexHull(points, padding, circleSamples) {
  const hull = convexHull(points);
  if (hull.length === 0) return [];
  if (padding <= 0 || circleSamples < 3) return hull;
  const expanded = [];
  for (const point of hull) {
    for (let sample = 0; sample < circleSamples; sample += 1) {
      const angle = sample / circleSamples * Math.PI * 2;
      expanded.push({
        x: point.x + Math.cos(angle) * padding,
        y: point.y + Math.sin(angle) * padding
      });
    }
  }
  return convexHull(expanded);
}

// src/folder-clustering/hash.ts
function stableHash32(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// src/folder-clustering/contours.ts
var CONTOUR_PADDING = 36;
var CONTOUR_CIRCLE_SAMPLES = 24;
var CONTOUR_BORDER_WIDTH = 2;
var CONTOUR_BORDER_ALPHA = 0.5;
var CONTOUR_FILL_ALPHA = 0.09;
var CONTOUR_LABEL_OFFSET = 7;
var ROOT_FOLDER_LABEL = "Vault root";
function hueChannel(value, middle, low) {
  let hue = value;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return low + (middle - low) * 6 * hue;
  if (hue < 1 / 2) return middle;
  if (hue < 2 / 3) return low + (middle - low) * (2 / 3 - hue) * 6;
  return low;
}
function hslToRgb(hueDegrees, saturation, lightness) {
  const hue = hueDegrees / 360;
  const middle = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const low = 2 * lightness - middle;
  return [
    hueChannel(hue + 1 / 3, middle, low),
    hueChannel(hue, middle, low),
    hueChannel(hue - 1 / 3, middle, low)
  ].map((channel) => Math.round(channel * 255));
}
function folderContourColor(folder) {
  const hue = stableHash32(folder || "<root>") % 360;
  const [red = 0, green = 0, blue = 0] = hslToRgb(hue, 0.7, 0.6);
  return red << 16 | green << 8 | blue;
}
function canRenderContours(renderer) {
  const hanger = renderer.hanger;
  return hanger !== void 0 && typeof hanger.addChildAt === "function" && typeof hanger.removeChild === "function";
}
function constructorOf(value) {
  if ((typeof value !== "object" || value === null) && typeof value !== "function")
    return void 0;
  const constructor = Reflect.get(value, "constructor");
  return typeof constructor === "function" ? constructor : void 0;
}
function rendererNodes(renderer) {
  var _a, _b;
  return (_b = renderer.nodes) != null ? _b : Object.values((_a = renderer.nodeLookup) != null ? _a : {});
}
function contourFactories(renderer) {
  var _a, _b;
  const nodes = rendererNodes(renderer);
  const circle = (_a = nodes.find((node) => node.circle != null)) == null ? void 0 : _a.circle;
  const text = (_b = nodes.find((node) => node.text != null)) == null ? void 0 : _b.text;
  const ContainerClass = constructorOf(renderer.hanger);
  const GraphicsClass = constructorOf(circle);
  const TextClass = constructorOf(text);
  return ContainerClass === void 0 || GraphicsClass === void 0 || TextClass === void 0 ? void 0 : { Container: ContainerClass, Graphics: GraphicsClass, Text: TextClass };
}
function samePoints(left, right) {
  if (left.length !== right.length) return false;
  return left.every((point, index) => {
    const other = right[index];
    if (other === void 0) return false;
    return point.x === other.x && point.y === other.y;
  });
}
function drawClosedPolygon(graphics, points) {
  const first = points[0];
  if (first === void 0) return;
  graphics.moveTo(first.x, first.y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
}
function pointBounds(points) {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
  }
  return { left, top };
}
function folderLabel(folder) {
  return folder || ROOT_FOLDER_LABEL;
}
function createFolderContour(factories, folder, nodeIds) {
  const color = folderContourColor(folder);
  const graphics = new factories.Graphics();
  graphics.eventMode = "none";
  const label = new factories.Text(folderLabel(folder), {
    fill: color,
    fontFamily: "sans-serif",
    fontSize: 18,
    fontWeight: "600"
  });
  label.alpha = 0.9;
  label.anchor.set(0, 1);
  label.eventMode = "none";
  label.resolution = 2;
  label.visible = false;
  return { graphics, label, nodeIds };
}
function destroyContour(contour) {
  contour.graphics.removeFromParent();
  contour.graphics.destroy();
  contour.label.removeFromParent();
  contour.label.destroy();
}
var FolderContourLayer = class _FolderContourLayer {
  constructor(renderer) {
    __publicField(this, "renderer", renderer);
    __publicField(this, "container");
    __publicField(this, "contours", /* @__PURE__ */ new Map());
    __publicField(this, "factories");
    __publicField(this, "groups", /* @__PURE__ */ new Map());
    __publicField(this, "disposed", false);
  }
  static create(renderer) {
    return canRenderContours(renderer) ? new _FolderContourLayer(renderer) : void 0;
  }
  setGroups(groups) {
    if (this.disposed) return;
    this.groups = new Map(groups);
    if (this.container !== void 0) this.syncContours();
  }
  update() {
    var _a, _b;
    if (this.disposed || !this.initializeIfReady()) return;
    this.attach();
    const nodeLookup = (_b = this.renderer.nodeLookup) != null ? _b : Object.fromEntries(
      ((_a = this.renderer.nodes) != null ? _a : []).map((node) => [node.id, node])
    );
    for (const [folder, contour] of this.contours) {
      const points = contour.nodeIds.flatMap((nodeId) => {
        const node = nodeLookup[nodeId];
        return typeof (node == null ? void 0 : node.x) === "number" && typeof node.y === "number" && Number.isFinite(node.x) && Number.isFinite(node.y) ? [{ x: node.x, y: node.y }] : [];
      });
      if (contour.lastPoints !== void 0 && samePoints(contour.lastPoints, points))
        continue;
      contour.lastPoints = points;
      this.drawContour(folder, contour, points);
    }
  }
  dispose() {
    var _a, _b;
    if (this.disposed) return;
    this.disposed = true;
    (_a = this.container) == null ? void 0 : _a.removeFromParent();
    (_b = this.container) == null ? void 0 : _b.destroy({ children: true });
    this.container = void 0;
    this.factories = void 0;
    this.contours.clear();
  }
  initializeIfReady() {
    var _a;
    if (((_a = this.container) == null ? void 0 : _a.destroyed) === true) {
      this.container = void 0;
      this.factories = void 0;
      this.contours.clear();
    }
    if (this.container !== void 0) return true;
    const factories = contourFactories(this.renderer);
    if (factories === void 0) return false;
    this.factories = factories;
    this.container = new factories.Container();
    this.container.name = "Folder Virtual Links contours";
    this.container.eventMode = "none";
    this.syncContours();
    return true;
  }
  syncContours() {
    const container = this.container;
    const factories = this.factories;
    if (container === void 0 || factories === void 0) return;
    for (const [folder, contour] of this.contours) {
      if (this.groups.has(folder)) continue;
      destroyContour(contour);
      this.contours.delete(folder);
    }
    for (const [folder, nodeIds] of this.groups) {
      const current = this.contours.get(folder);
      if (current !== void 0) {
        current.nodeIds = [...nodeIds];
        current.lastPoints = void 0;
        continue;
      }
      const contour = createFolderContour(factories, folder, [...nodeIds]);
      this.contours.set(folder, contour);
      container.addChild(contour.graphics, contour.label);
    }
    this.attach();
  }
  attach() {
    const container = this.container;
    if (container === void 0 || container.parent === this.renderer.hanger)
      return;
    this.renderer.hanger.addChildAt(container, 0);
  }
  drawContour(folder, contour, points) {
    contour.graphics.clear();
    const hull = paddedConvexHull(
      points,
      CONTOUR_PADDING,
      CONTOUR_CIRCLE_SAMPLES
    );
    if (hull.length < 3) {
      contour.label.visible = false;
      return;
    }
    const color = folderContourColor(folder);
    contour.graphics.lineStyle(
      CONTOUR_BORDER_WIDTH,
      color,
      CONTOUR_BORDER_ALPHA,
      0.5
    );
    contour.graphics.beginFill(color, CONTOUR_FILL_ALPHA);
    drawClosedPolygon(contour.graphics, hull);
    contour.graphics.endFill();
    const bounds = pointBounds(hull);
    contour.label.position.set(
      bounds.left + CONTOUR_LABEL_OFFSET,
      bounds.top - CONTOUR_LABEL_OFFSET
    );
    contour.label.visible = true;
  }
};

// src/folder-clustering/constants.ts
var DEFAULT_SETTINGS = {
  excludedFolders: [],
  folderDepth: "direct",
  showFolderContours: true,
  topologyDegree: 3
};
var TOPOLOGY_ATTEMPTS = 512;
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function normalizeFolderPath(path) {
  return path.replace(/^\/+|\/+$/g, "");
}
function normalizeFolderDepth(value) {
  return value === "direct" || typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value : DEFAULT_SETTINGS.folderDepth;
}
function normalizeTopologyDegree(value) {
  return value === 4 ? 4 : DEFAULT_SETTINGS.topologyDegree;
}
function normalizeExcludedFolders(value) {
  if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.excludedFolders];
  const folders = [
    ...new Set(
      value.filter((path) => typeof path === "string").map(normalizeFolderPath).filter((path) => path.length > 0)
    )
  ].sort(
    (left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right)
  );
  return folders.filter(
    (folder, index) => !folders.slice(0, index).some((parent) => folder.startsWith(`${parent}/`))
  );
}
function normalizeSettings(stored) {
  if (!isRecord(stored)) return { ...DEFAULT_SETTINGS, excludedFolders: [] };
  return {
    excludedFolders: normalizeExcludedFolders(stored.excludedFolders),
    folderDepth: normalizeFolderDepth(stored.folderDepth),
    showFolderContours: typeof stored.showFolderContours === "boolean" ? stored.showFolderContours : DEFAULT_SETTINGS.showFolderContours,
    topologyDegree: normalizeTopologyDegree(stored.topologyDegree)
  };
}

// src/folder-clustering/topology.ts
var EDGE_SEPARATOR = "\0";
function edgeKey(left, right) {
  return left < right ? `${left}${EDGE_SEPARATOR}${right}` : `${right}${EDGE_SEPARATOR}${left}`;
}
function compareBySalt(left, right, salt) {
  const hashDifference = stableHash32(`${salt}:${left}`) - stableHash32(`${salt}:${right}`);
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
    const source = paths[left];
    if (source === void 0) continue;
    for (const target of paths.slice(left + 1)) {
      edges.push({ source, target });
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
function tryBuildStubEdges(baseAdjacency, stubs, seed) {
  const candidateAdjacency = /* @__PURE__ */ new Map();
  for (const [path, neighbors] of baseAdjacency) {
    candidateAdjacency.set(path, new Set(neighbors));
  }
  const candidateEdges = [];
  const candidates = shuffled(stubs, seed);
  for (let index = 0; index < candidates.length; index += 2) {
    const source = candidates[index];
    const target = candidates[index + 1];
    if (source === void 0 || target === void 0) return void 0;
    if (!addEdge(candidateEdges, candidateAdjacency, source, target))
      return void 0;
  }
  return candidateEdges;
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
  for (const [index, source] of paths.entries()) {
    const target = paths[(index + 1) % nodeCount];
    if (target !== void 0) addEdge(edges, adjacency, source, target);
  }
  if (targetDegree <= 2) return edges;
  const needsParityNode = nodeCount * targetDegree % 2 === 1;
  const parityNode = needsParityNode ? paths[0] : void 0;
  const stubs = makeStubs(paths, adjacency, targetDegree, parityNode);
  for (let attempt = 0; attempt < TOPOLOGY_ATTEMPTS; attempt += 1) {
    const attemptSeed = stableHash32(
      `${folderSeed}:matching:${String(attempt)}`
    );
    const stubEdges = tryBuildStubEdges(adjacency, stubs, attemptSeed);
    if (stubEdges !== void 0) return edges.concat(stubEdges);
  }
  throw new Error(`Could not build folder topology: ${folderSeed}`);
}

// src/folder-clustering/graph-data.ts
function directParent(path) {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}
function groupingFolder(path, folderDepth) {
  const parent = directParent(path);
  if (folderDepth === "direct" || parent === "") return parent;
  return parent.split("/").slice(0, folderDepth).join("/");
}
function isFolderExcluded(path, excludedFolders) {
  const parent = directParent(path);
  return excludedFolders.some(
    (folder) => parent === folder || parent.startsWith(`${folder}/`)
  );
}
function visibleFolderGroups(nodes, settings) {
  var _a;
  const folders = /* @__PURE__ */ new Map();
  for (const [path, node] of Object.entries(nodes)) {
    if (node.type !== "") continue;
    if (isFolderExcluded(path, settings.excludedFolders)) continue;
    const folder = groupingFolder(path, settings.folderDepth);
    const members = (_a = folders.get(folder)) != null ? _a : [];
    members.push(path);
    folders.set(folder, members);
  }
  return new Map(
    [...folders].sort(([left], [right]) => left.localeCompare(right))
  );
}
function hasLink(data, source, target) {
  var _a, _b;
  return ((_a = data.nodes[source]) == null ? void 0 : _a.links[target]) === true || ((_b = data.nodes[target]) == null ? void 0 : _b.links[source]) === true;
}
function augmentGraphData(original, settings) {
  const nodes = { ...original.nodes };
  const clonedSources = /* @__PURE__ */ new Set();
  const virtualEdgeKeys = /* @__PURE__ */ new Set();
  let addedLinks = 0;
  const folders = visibleFolderGroups(original.nodes, settings);
  for (const [folder, members] of folders) {
    for (const edge of buildFolderTopology(
      members,
      settings.topologyDegree,
      folder || "<root>"
    )) {
      if (hasLink(original, edge.source, edge.target)) continue;
      if (!clonedSources.has(edge.source)) {
        const sourceNode2 = original.nodes[edge.source];
        if (sourceNode2 === void 0) continue;
        nodes[edge.source] = { ...sourceNode2, links: { ...sourceNode2.links } };
        clonedSources.add(edge.source);
      }
      const sourceNode = nodes[edge.source];
      if (sourceNode === void 0 || sourceNode.links[edge.target] === true)
        continue;
      sourceNode.links[edge.target] = true;
      virtualEdgeKeys.add(edgeKey(edge.source, edge.target));
      addedLinks += 1;
    }
  }
  return {
    data: addedLinks === 0 ? original : { ...original, nodes, numLinks: original.numLinks + addedLinks },
    folderGroups: folders,
    virtualEdgeKeys
  };
}

// src/folder-clustering/bridge.ts
function deleteLinkReference(lookup, id, link) {
  if ((lookup == null ? void 0 : lookup[id]) === link) Reflect.deleteProperty(lookup, id);
}
function stripVirtualLinks(renderer, virtualEdgeKeys) {
  var _a, _b, _c, _d, _e;
  if (virtualEdgeKeys.size === 0 || !Array.isArray(renderer.links)) return;
  const visibleLinks = [];
  for (const link of renderer.links) {
    const source = link.source;
    const target = link.target;
    const sourceId = source == null ? void 0 : source.id;
    const targetId = target == null ? void 0 : target.id;
    if (source === void 0 || target === void 0 || typeof sourceId !== "string" || typeof targetId !== "string" || !virtualEdgeKeys.has(edgeKey(sourceId, targetId))) {
      visibleLinks.push(link);
      continue;
    }
    try {
      (_a = link.clearGraphics) == null ? void 0 : _a.call(link);
    } catch (error) {
      console.warn(
        "Folder Virtual Links could not clear hidden link graphics",
        error
      );
    }
    link.rendered = false;
    deleteLinkReference(source.forward, targetId, link);
    deleteLinkReference(source.reverse, targetId, link);
    deleteLinkReference(target.forward, sourceId, link);
    deleteLinkReference(target.reverse, sourceId, link);
  }
  renderer.links.splice(0, renderer.links.length, ...visibleLinks);
  for (const node of (_b = renderer.nodes) != null ? _b : []) {
    node.weight = Object.keys((_c = node.forward) != null ? _c : {}).length + Object.keys((_d = node.reverse) != null ? _d : {}).length;
  }
  (_e = renderer.changed) == null ? void 0 : _e.call(renderer);
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
function createRendererPatch(view, renderer, getSettings) {
  const originalSetData = renderer.setData;
  const originalRenderCallback = renderer.renderCallback;
  let active = true;
  let contourLayer;
  let contoursCompatible = typeof originalRenderCallback === "function";
  const clearContours = () => {
    try {
      contourLayer == null ? void 0 : contourLayer.dispose();
    } catch (error) {
      console.warn("Folder Virtual Links could not remove contours", error);
    }
    contourLayer = void 0;
  };
  const replaceContours = (groups, enabled) => {
    clearContours();
    if (!active || !enabled || !contoursCompatible) return;
    try {
      contourLayer = FolderContourLayer.create(renderer);
      if (contourLayer === void 0) {
        contoursCompatible = false;
        return;
      }
      contourLayer.setGroups(groups);
      contourLayer.update();
    } catch (error) {
      contoursCompatible = false;
      clearContours();
      console.warn("Folder Virtual Links could not draw contours", error);
    }
  };
  const wrapper = (data) => {
    if (!active) return originalSetData.call(renderer, data);
    try {
      const settings = getSettings();
      const augmented = augmentGraphData(data, settings);
      clearContours();
      const result = originalSetData.call(renderer, augmented.data);
      stripVirtualLinks(renderer, augmented.virtualEdgeKeys);
      replaceContours(augmented.folderGroups, settings.showFolderContours);
      return result;
    } catch (error) {
      console.error("Folder Virtual Links could not update the graph", error);
      clearContours();
      return originalSetData.call(renderer, data);
    }
  };
  const renderWrapper = originalRenderCallback === void 0 ? void 0 : () => {
    if (active && contourLayer !== void 0) {
      try {
        contourLayer.update();
      } catch (error) {
        contoursCompatible = false;
        clearContours();
        console.warn(
          "Folder Virtual Links stopped updating contours",
          error
        );
      }
    }
    return originalRenderCallback.call(renderer);
  };
  return {
    deactivate: () => {
      active = false;
      clearContours();
    },
    originalRenderCallback,
    originalSetData,
    renderWrapper,
    renderer,
    view,
    wrapper
  };
}
var NativeGraphBridge = class {
  constructor(app, getSettings) {
    __publicField(this, "app", app);
    __publicField(this, "getSettings", getSettings);
    __publicField(this, "patches", /* @__PURE__ */ new Map());
    __publicField(this, "disposed", false);
  }
  patchOpenGraphs() {
    if (this.disposed) return;
    for (const patch of this.reconcileOpenGraphs()) {
      refreshView(patch.view);
    }
  }
  async patchAfterLeafLoad(leaf) {
    if (this.disposed) return;
    if ((leaf == null ? void 0 : leaf.getViewState().type) === "graph") {
      try {
        await leaf.loadIfDeferred();
      } catch (error) {
        console.warn(
          "Folder Virtual Links could not load the graph view",
          error
        );
        return;
      }
    }
    this.patchOpenGraphs();
  }
  refreshAll() {
    if (this.disposed) return;
    this.reconcileOpenGraphs();
    for (const patch of this.patches.values()) {
      refreshView(patch.view);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const patch of [...this.patches.values()]) {
      this.releasePatch(patch, true);
    }
  }
  reconcileOpenGraphs() {
    const openGraphs = /* @__PURE__ */ new Map();
    for (const leaf of this.app.workspace.getLeavesOfType("graph")) {
      const view = asGraphView(leaf);
      const renderer = view == null ? void 0 : view.renderer;
      if (view === void 0 || renderer === void 0) continue;
      if (typeof renderer.setData !== "function") continue;
      openGraphs.set(renderer, view);
    }
    for (const [renderer, patch] of this.patches) {
      if (!openGraphs.has(renderer)) this.releasePatch(patch, false);
    }
    const addedPatches = [];
    for (const [renderer, view] of openGraphs) {
      if (this.patches.has(renderer)) continue;
      const patch = createRendererPatch(view, renderer, this.getSettings);
      renderer.setData = patch.wrapper;
      if (patch.renderWrapper !== void 0) {
        renderer.renderCallback = patch.renderWrapper;
      }
      this.patches.set(renderer, patch);
      addedPatches.push(patch);
    }
    return addedPatches;
  }
  releasePatch(patch, refresh) {
    patch.deactivate();
    if (patch.renderer.setData === patch.wrapper) {
      patch.renderer.setData = patch.originalSetData;
    }
    if (patch.renderer.renderCallback === patch.renderWrapper) {
      patch.renderer.renderCallback = patch.originalRenderCallback;
    }
    this.patches.delete(patch.renderer);
    if (refresh) refreshView(patch.view);
  }
};

// src/folder-clustering/settings.ts
var import_obsidian = require("obsidian");
var FolderSuggestModal = class extends import_obsidian.SuggestModal {
  constructor(app, folderPaths, onChoose) {
    super(app);
    __publicField(this, "folderPaths", folderPaths);
    __publicField(this, "onChoose", onChoose);
    this.setPlaceholder("Search folders");
    this.emptyStateText = "No folders available";
  }
  getSuggestions(query) {
    const normalizedQuery = query.toLocaleLowerCase();
    return this.folderPaths.filter(
      (path) => path.toLocaleLowerCase().includes(normalizedQuery)
    );
  }
  renderSuggestion(folderPath, element) {
    element.setText(folderPath);
  }
  onChooseSuggestion(folderPath) {
    void this.onChoose(folderPath);
  }
};
function folderDepthOptions(folderPaths, currentDepth) {
  const maxVaultDepth = Math.max(
    1,
    ...folderPaths.map((path) => path.split("/").length)
  );
  const maxDepth = typeof currentDepth === "number" ? Math.max(currentDepth, maxVaultDepth) : maxVaultDepth;
  const options = /* @__PURE__ */ new Map([["direct", "Direct parent (default)"]]);
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    options.set(String(depth), depth === 1 ? "1 (top level)" : String(depth));
  }
  return options;
}
function isCoveredByExclusion(folderPath, excludedFolders) {
  return excludedFolders.some(
    (excluded) => folderPath === excluded || folderPath.startsWith(`${excluded}/`)
  );
}
var FolderVirtualLinksSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  display() {
    this.renderSettings();
  }
  renderSettings() {
    this.containerEl.empty();
    const folderPaths = this.app.vault.getAllFolders().map((folder) => folder.path).sort((left, right) => left.localeCompare(right));
    new import_obsidian.Setting(this.containerEl).setName("Folder topology degree").setDesc("Higher values pull notes in the same folder closer.").addDropdown((dropdown) => {
      dropdown.addOption("3", "3 (default)").addOption("4", "4 (strong)").setValue(String(this.plugin.settings.topologyDegree)).onChange(async (value) => {
        const topologyDegree = value === "4" ? 4 : 3;
        await this.plugin.updateTopologyDegree(topologyDegree);
      });
    });
    new import_obsidian.Setting(this.containerEl).setName("Folder grouping depth").setDesc(
      "Choose which ancestor folder groups nested notes. Direct parent keeps each folder separate."
    ).addDropdown((dropdown) => {
      for (const [value, label] of folderDepthOptions(
        folderPaths,
        this.plugin.settings.folderDepth
      )) {
        dropdown.addOption(value, label);
      }
      dropdown.setValue(String(this.plugin.settings.folderDepth)).onChange(async (value) => {
        const numericDepth = Number(value);
        const folderDepth = value === "direct" || !Number.isSafeInteger(numericDepth) ? "direct" : numericDepth;
        await this.plugin.updateFolderDepth(folderDepth);
      });
    });
    new import_obsidian.Setting(this.containerEl).setName("Show folder contours").setDesc(
      "Draw a labeled, translucent area around each visible folder group."
    ).addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.showFolderContours).onChange(async (value) => {
        await this.plugin.updateShowFolderContours(value);
      });
    });
    new import_obsidian.Setting(this.containerEl).setName("Excluded folders").setDesc("Ignore selected folders and all their subfolders.").addButton((button) => {
      button.setButtonText("Add folder").onClick(() => {
        const availableFolders = folderPaths.filter(
          (path) => !isCoveredByExclusion(path, this.plugin.settings.excludedFolders)
        );
        new FolderSuggestModal(
          this.app,
          availableFolders,
          async (folderPath) => {
            await this.plugin.addExcludedFolder(folderPath);
            this.renderSettings();
          }
        ).open();
      });
    });
    for (const folderPath of this.plugin.settings.excludedFolders) {
      new import_obsidian.Setting(this.containerEl).setName(folderPath).addExtraButton((button) => {
        button.setIcon("x").setTooltip(`Remove ${folderPath}`).onClick(async () => {
          await this.plugin.removeExcludedFolder(folderPath);
          this.renderSettings();
        });
      });
    }
  }
};

// src/main.ts
var FolderVirtualLinksPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", {
      ...DEFAULT_SETTINGS,
      excludedFolders: []
    });
    __publicField(this, "bridge");
    __publicField(this, "isActive", false);
  }
  async onload() {
    this.isActive = true;
    await this.loadSettings();
    this.bridge = new NativeGraphBridge(this.app, () => this.settings);
    this.addSettingTab(new FolderVirtualLinksSettingTab(this.app, this));
    this.addCommand({
      id: "rebuild-folder-virtual-links",
      name: "Rebuild folder virtual links",
      callback: () => {
        var _a;
        return (_a = this.bridge) == null ? void 0 : _a.refreshAll();
      }
    });
    this.registerEvent(
      this.app.workspace.on(
        "layout-change",
        () => {
          var _a;
          return (_a = this.bridge) == null ? void 0 : _a.patchOpenGraphs();
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.patchAfterLeafLoad(leaf);
      })
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.isActive) {
        this.patchAfterLeafLoad(this.app.workspace.getMostRecentLeaf());
      }
    });
  }
  onunload() {
    var _a;
    this.isActive = false;
    (_a = this.bridge) == null ? void 0 : _a.dispose();
    this.bridge = void 0;
  }
  async updateTopologyDegree(topologyDegree) {
    await this.updateSettings({ topologyDegree });
  }
  async updateFolderDepth(folderDepth) {
    await this.updateSettings({ folderDepth });
  }
  async updateShowFolderContours(showFolderContours) {
    await this.updateSettings({ showFolderContours });
  }
  async addExcludedFolder(folderPath) {
    await this.updateSettings({
      excludedFolders: [...this.settings.excludedFolders, folderPath]
    });
  }
  async removeExcludedFolder(folderPath) {
    await this.updateSettings({
      excludedFolders: this.settings.excludedFolders.filter(
        (path) => path !== folderPath
      )
    });
  }
  async loadSettings() {
    this.settings = normalizeSettings(await this.loadData());
  }
  patchAfterLeafLoad(leaf) {
    var _a;
    void ((_a = this.bridge) == null ? void 0 : _a.patchAfterLeafLoad(leaf));
  }
  async updateSettings(updates) {
    var _a;
    this.settings = normalizeSettings({ ...this.settings, ...updates });
    await this.saveData(this.settings);
    (_a = this.bridge) == null ? void 0 : _a.refreshAll();
  }
};
