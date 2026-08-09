import { describe, expect, it } from "vitest";
import {
  augmentGraphData,
  directParent,
  groupingFolder,
  isFolderExcluded,
} from "./graph-data";
import { edgeKey } from "./topology";
import type { FolderVirtualLinksSettings, GraphDataLike } from "./types";

const DEFAULT_TEST_SETTINGS: FolderVirtualLinksSettings = {
  excludedFolders: [],
  folderDepth: "direct",
  showFolderContours: true,
  topologyDegree: 3,
};

function graphData(): GraphDataLike {
  return {
    nodes: {
      "A/one.md": { type: "", links: { "A/two.md": true } },
      "A/two.md": { type: "", links: {} },
      "A/three.md": { type: "", links: {} },
      "A/four.md": { type: "", links: {} },
      "B/one.md": { type: "", links: {} },
      "B/two.md": { type: "", links: {} },
      "#tag": { type: "tag", links: {} },
    },
    numLinks: 1,
  };
}

describe("graph data augmentation", () => {
  it("groups only visible markdown nodes by direct parent without mutating input", () => {
    const original = graphData();
    const before = structuredClone(original);
    const result = augmentGraphData(original, DEFAULT_TEST_SETTINGS);

    expect(original).toEqual(before);
    expect(result.data.numLinks).toBeGreaterThan(original.numLinks);
    expect(result.data.nodes["#tag"]?.links).toEqual({});
    expect(result.virtualEdgeKeys.has(edgeKey("A/one.md", "A/two.md"))).toBe(
      false,
    );

    for (const key of result.virtualEdgeKeys) {
      const [source, target] = key.split("\u0000") as [string, string];
      expect(directParent(source)).toBe(directParent(target));
    }
  });

  it("returns the original object when no folder can receive a link", () => {
    const original: GraphDataLike = {
      nodes: {
        "one.md": { type: "", links: {} },
        "#tag": { type: "tag", links: {} },
      },
      numLinks: 0,
    };
    const result = augmentGraphData(original, DEFAULT_TEST_SETTINGS);
    expect(result.data).toBe(original);
    expect(result.folderGroups).toEqual(new Map([["", ["one.md"]]]));
  });

  it("extracts direct parents including the root", () => {
    expect(directParent("root.md")).toBe("");
    expect(directParent("A/B/note.md")).toBe("A/B");
  });

  it("groups nested notes at the selected ancestor depth", () => {
    expect(groupingFolder("A/B/C/note.md", "direct")).toBe("A/B/C");
    expect(groupingFolder("A/B/C/note.md", 1)).toBe("A");
    expect(groupingFolder("A/B/C/note.md", 2)).toBe("A/B");
    expect(groupingFolder("A/note.md", 3)).toBe("A");
    expect(groupingFolder("root.md", 1)).toBe("");
  });

  it("clusters nested folders together at a numeric depth", () => {
    const original: GraphDataLike = {
      nodes: {
        "A/one.md": { type: "", links: {} },
        "A/B/two.md": { type: "", links: {} },
        "A/C/three.md": { type: "", links: {} },
      },
      numLinks: 0,
    };

    const direct = augmentGraphData(original, DEFAULT_TEST_SETTINGS);
    const topLevel = augmentGraphData(original, {
      ...DEFAULT_TEST_SETTINGS,
      folderDepth: 1,
    });

    expect(direct.virtualEdgeKeys.size).toBe(0);
    expect(topLevel.virtualEdgeKeys.size).toBe(3);
  });

  it("excludes selected folder subtrees before grouping", () => {
    const original: GraphDataLike = {
      nodes: {
        "A/one.md": { type: "", links: {} },
        "A/B/two.md": { type: "", links: {} },
        "A/private/secret.md": { type: "", links: {} },
        "A/private/deep/hidden.md": { type: "", links: {} },
      },
      numLinks: 0,
    };
    const result = augmentGraphData(original, {
      ...DEFAULT_TEST_SETTINGS,
      excludedFolders: ["A/private"],
      folderDepth: 1,
    });

    expect(isFolderExcluded("A/private/secret.md", ["A/private"])).toBe(true);
    expect(isFolderExcluded("A/private/deep/hidden.md", ["A/private"])).toBe(
      true,
    );
    expect(isFolderExcluded("A/private-note.md", ["A/private"])).toBe(false);
    expect(result.virtualEdgeKeys).toEqual(
      new Set([edgeKey("A/one.md", "A/B/two.md")]),
    );
    expect(result.folderGroups).toEqual(
      new Map([["A", ["A/one.md", "A/B/two.md"]]]),
    );
  });
});
