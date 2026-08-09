export interface Point {
  x: number;
  y: number;
}

function cross(origin: Point, left: Point, right: Point): number {
  return (
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x)
  );
}

function uniqueFinitePoints(points: readonly Point[]): Point[] {
  const result = new Map<string, Point>();
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    result.set(`${String(point.x)}\u0000${String(point.y)}`, point);
  }
  return [...result.values()];
}

export function convexHull(points: readonly Point[]): Point[] {
  const sorted = uniqueFinitePoints(points).sort(
    (left, right) => left.x - right.x || left.y - right.y,
  );
  if (sorted.length <= 1) return sorted;

  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2) {
      const origin = lower[lower.length - 2];
      const left = lower[lower.length - 1];
      if (origin === undefined || left === undefined) break;
      if (cross(origin, left, point) > 0) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2) {
      const origin = upper[upper.length - 2];
      const left = upper[upper.length - 1];
      if (origin === undefined || left === undefined) break;
      if (cross(origin, left, point) > 0) break;
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function paddedConvexHull(
  points: readonly Point[],
  padding: number,
  circleSamples: number,
): Point[] {
  const hull = convexHull(points);
  if (hull.length === 0) return [];
  if (padding <= 0 || circleSamples < 3) return hull;

  const expanded: Point[] = [];
  for (const point of hull) {
    for (let sample = 0; sample < circleSamples; sample += 1) {
      const angle = (sample / circleSamples) * Math.PI * 2;
      expanded.push({
        x: point.x + Math.cos(angle) * padding,
        y: point.y + Math.sin(angle) * padding,
      });
    }
  }
  return convexHull(expanded);
}
