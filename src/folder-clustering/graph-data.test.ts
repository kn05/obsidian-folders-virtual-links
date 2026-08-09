import { describe, expect, it } from "vitest";
import { augmentGraphData, directParent } from "./graph-data";
import { edgeKey } from "./topology";
import type { GraphDataLike } from "./types";

function graphData(): GraphDataLike {
  return {
    nodes: {
      "A/one.md": { type: "", links: { "A/two.md": true } },
      "A/two.md": { type: "", links: {} },
      "A/three.md": { type: "", links: {} },
      "A/four.md": { type: "", links: {} },
      "B/one.md": { type: "", links: {} },
      "B/two.md": { type: "", links: {} },
      "#tag": { type: "tag", links: {} }
    },
    numLinks: 1
  };
}

describe("graph data augmentation", () => {
  it("groups only visible markdown nodes by direct parent without mutating input", () => {
    const original = graphData();
    const before = structuredClone(original);
    const result = augmentGraphData(original, 3);

    expect(original).toEqual(before);
    expect(result.data.numLinks).toBeGreaterThan(original.numLinks);
    expect(result.data.nodes["#tag"]?.links).toEqual({});
    expect(result.virtualEdgeKeys.has(edgeKey("A/one.md", "A/two.md"))).toBe(false);

    for (const key of result.virtualEdgeKeys) {
      const [source, target] = key.split("\u0000") as [string, string];
      expect(directParent(source)).toBe(directParent(target));
    }
  });

  it("returns the original object when no folder can receive a link", () => {
    const original: GraphDataLike = {
      nodes: {
        "one.md": { type: "", links: {} },
        "#tag": { type: "tag", links: {} }
      },
      numLinks: 0
    };
    expect(augmentGraphData(original, 3).data).toBe(original);
  });

  it("extracts direct parents including the root", () => {
    expect(directParent("root.md")).toBe("");
    expect(directParent("A/B/note.md")).toBe("A/B");
  });
});
