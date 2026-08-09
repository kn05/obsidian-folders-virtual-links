import { describe, expect, it } from "vitest";
import { convexHull, paddedConvexHull } from "./contour-geometry";
import { folderContourColor } from "./contours";

describe("folder contour geometry", () => {
  it("builds a deterministic hull and drops interior or invalid points", () => {
    const points = [
      { x: 10, y: 10 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
      { x: Number.NaN, y: 0 },
    ];

    expect(convexHull(points)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(convexHull([...points].reverse())).toEqual(convexHull(points));
  });

  it("turns one point into a padded rounded area", () => {
    const hull = paddedConvexHull([{ x: 5, y: 10 }], 20, 24);

    expect(hull).toHaveLength(24);
    expect(Math.min(...hull.map((point) => point.x))).toBeCloseTo(-15);
    expect(Math.max(...hull.map((point) => point.x))).toBeCloseTo(25);
    expect(Math.min(...hull.map((point) => point.y))).toBeCloseTo(-10);
    expect(Math.max(...hull.map((point) => point.y))).toBeCloseTo(30);
  });

  it("pads a two-node group into a capsule that contains both nodes", () => {
    const hull = paddedConvexHull(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      20,
      24,
    );

    expect(Math.min(...hull.map((point) => point.x))).toBeCloseTo(-20);
    expect(Math.max(...hull.map((point) => point.x))).toBeCloseTo(120);
    expect(Math.min(...hull.map((point) => point.y))).toBeCloseTo(-20);
    expect(Math.max(...hull.map((point) => point.y))).toBeCloseTo(20);
  });

  it("assigns stable 24-bit colors by folder", () => {
    expect(folderContourColor("Projects/Alpha")).toBe(
      folderContourColor("Projects/Alpha"),
    );
    expect(folderContourColor("Projects/Alpha")).not.toBe(
      folderContourColor("Projects/Beta"),
    );
    expect(folderContourColor("")).toBeGreaterThanOrEqual(0);
    expect(folderContourColor("")).toBeLessThanOrEqual(0xff_ffff);
  });
});
