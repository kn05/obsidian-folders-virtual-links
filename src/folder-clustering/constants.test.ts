import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./constants";

describe("folder clustering settings", () => {
  it("migrates older settings to direct-parent grouping", () => {
    expect(normalizeSettings({ topologyDegree: 4 })).toEqual({
      excludedFolders: [],
      folderDepth: "direct",
      topologyDegree: 4,
    });
  });

  it("rejects invalid values and returns independent defaults", () => {
    const normalized = normalizeSettings({
      excludedFolders: "folder",
      folderDepth: 0,
      topologyDegree: 5,
    });

    expect(normalized).toEqual(DEFAULT_SETTINGS);
    expect(normalized.excludedFolders).not.toBe(
      DEFAULT_SETTINGS.excludedFolders,
    );
  });

  it("normalizes duplicate and overlapping folder exclusions", () => {
    expect(
      normalizeSettings({
        excludedFolders: ["/Archive/old/", "Archive", "Work", "Work", 42],
        folderDepth: 2,
        topologyDegree: 3,
      }),
    ).toEqual({
      excludedFolders: ["Archive", "Work"],
      folderDepth: 2,
      topologyDegree: 3,
    });
  });
});
