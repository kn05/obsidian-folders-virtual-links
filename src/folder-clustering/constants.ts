import type {
  FolderDepth,
  FolderVirtualLinksSettings,
  TopologyDegree,
} from "./types";

export const PLUGIN_ID = "folder-virtual-links";
export const DEFAULT_SETTINGS: FolderVirtualLinksSettings = {
  excludedFolders: [],
  folderDepth: "direct",
  topologyDegree: 3,
};

export const TOPOLOGY_ATTEMPTS = 512;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFolderPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

function normalizeFolderDepth(value: unknown): FolderDepth {
  return value === "direct" ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 1)
    ? value
    : DEFAULT_SETTINGS.folderDepth;
}

function normalizeTopologyDegree(value: unknown): TopologyDegree {
  return value === 4 ? 4 : DEFAULT_SETTINGS.topologyDegree;
}

function normalizeExcludedFolders(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.excludedFolders];

  const folders = [
    ...new Set(
      value
        .filter((path): path is string => typeof path === "string")
        .map(normalizeFolderPath)
        .filter((path) => path.length > 0),
    ),
  ].sort(
    (left, right) =>
      left.split("/").length - right.split("/").length ||
      left.localeCompare(right),
  );

  return folders.filter(
    (folder, index) =>
      !folders
        .slice(0, index)
        .some((parent) => folder.startsWith(`${parent}/`)),
  );
}

export function normalizeSettings(stored: unknown): FolderVirtualLinksSettings {
  if (!isRecord(stored)) return { ...DEFAULT_SETTINGS, excludedFolders: [] };

  return {
    excludedFolders: normalizeExcludedFolders(stored.excludedFolders),
    folderDepth: normalizeFolderDepth(stored.folderDepth),
    topologyDegree: normalizeTopologyDegree(stored.topologyDegree),
  };
}
