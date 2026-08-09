import { paddedConvexHull, type Point } from "./contour-geometry";
import { stableHash32 } from "./hash";
import type { GraphNodeLike, GraphRendererLike } from "./types";

const CONTOUR_PADDING = 36;
const CONTOUR_CIRCLE_SAMPLES = 24;
const CONTOUR_BORDER_WIDTH = 2;
const CONTOUR_BORDER_ALPHA = 0.5;
const CONTOUR_FILL_ALPHA = 0.09;
const CONTOUR_LABEL_OFFSET = 7;
const ROOT_FOLDER_LABEL = "Vault root";

interface NativeDisplayObject {
  destroyed?: boolean;
  eventMode?: string;
  parent?: unknown;
  destroy: (options?: { children?: boolean }) => unknown;
  removeFromParent: () => unknown;
}

interface NativeContainer extends NativeDisplayObject {
  addChild: (...children: NativeDisplayObject[]) => unknown;
  name?: string;
}

interface NativeGraphics extends NativeDisplayObject {
  beginFill: (color: number, alpha: number) => unknown;
  clear: () => unknown;
  closePath: () => unknown;
  endFill: () => unknown;
  lineStyle: (
    width: number,
    color: number,
    alpha: number,
    alignment: number,
  ) => unknown;
  lineTo: (x: number, y: number) => unknown;
  moveTo: (x: number, y: number) => unknown;
}

interface NativeText extends NativeDisplayObject {
  alpha: number;
  anchor: { set: (x: number, y: number) => unknown };
  position: { set: (x: number, y: number) => unknown };
  resolution: number;
  visible: boolean;
}

type ContainerConstructor = new () => NativeContainer;
type GraphicsConstructor = new () => NativeGraphics;
type TextConstructor = new (text?: string, style?: object) => NativeText;
type UnknownConstructor = abstract new (...args: never[]) => unknown;

interface FolderContourFactories {
  Container: ContainerConstructor;
  Graphics: GraphicsConstructor;
  Text: TextConstructor;
}

interface FolderContour {
  graphics: NativeGraphics;
  label: NativeText;
  lastPoints?: Point[];
  nodeIds: string[];
}

interface ContourRenderer extends GraphRendererLike {
  hanger: NonNullable<GraphRendererLike["hanger"]>;
}

function hueChannel(value: number, middle: number, low: number): number {
  let hue = value;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return low + (middle - low) * 6 * hue;
  if (hue < 1 / 2) return middle;
  if (hue < 2 / 3) return low + (middle - low) * (2 / 3 - hue) * 6;
  return low;
}

function hslToRgb(hueDegrees: number, saturation: number, lightness: number) {
  const hue = hueDegrees / 360;
  const middle =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const low = 2 * lightness - middle;
  return [
    hueChannel(hue + 1 / 3, middle, low),
    hueChannel(hue, middle, low),
    hueChannel(hue - 1 / 3, middle, low),
  ].map((channel) => Math.round(channel * 255));
}

export function folderContourColor(folder: string): number {
  const hue = stableHash32(folder || "<root>") % 360;
  const [red = 0, green = 0, blue = 0] = hslToRgb(hue, 0.7, 0.6);
  return (red << 16) | (green << 8) | blue;
}

function canRenderContours(
  renderer: GraphRendererLike,
): renderer is ContourRenderer {
  const hanger = renderer.hanger;
  return (
    hanger !== undefined &&
    typeof hanger.addChildAt === "function" &&
    typeof hanger.removeChild === "function"
  );
}

function constructorOf(value: unknown): UnknownConstructor | undefined {
  if (
    (typeof value !== "object" || value === null) &&
    typeof value !== "function"
  )
    return undefined;
  const constructor: unknown = Reflect.get(value, "constructor");
  return typeof constructor === "function"
    ? (constructor as UnknownConstructor)
    : undefined;
}

function rendererNodes(renderer: GraphRendererLike): GraphNodeLike[] {
  return renderer.nodes ?? Object.values(renderer.nodeLookup ?? {});
}

function contourFactories(
  renderer: ContourRenderer,
): FolderContourFactories | undefined {
  const nodes = rendererNodes(renderer);
  const circle = nodes.find((node) => node.circle != null)?.circle;
  const text = nodes.find((node) => node.text != null)?.text;
  const ContainerClass = constructorOf(renderer.hanger) as
    ContainerConstructor | undefined;
  const GraphicsClass = constructorOf(circle) as
    GraphicsConstructor | undefined;
  const TextClass = constructorOf(text) as TextConstructor | undefined;
  return ContainerClass === undefined ||
    GraphicsClass === undefined ||
    TextClass === undefined
    ? undefined
    : { Container: ContainerClass, Graphics: GraphicsClass, Text: TextClass };
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((point, index) => {
    const other = right[index];
    if (other === undefined) return false;
    return point.x === other.x && point.y === other.y;
  });
}

function drawClosedPolygon(
  graphics: NativeGraphics,
  points: readonly Point[],
): void {
  const first = points[0];
  if (first === undefined) return;
  graphics.moveTo(first.x, first.y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
}

function pointBounds(points: readonly Point[]): {
  left: number;
  top: number;
} {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
  }
  return { left, top };
}

function folderLabel(folder: string): string {
  return folder || ROOT_FOLDER_LABEL;
}

function createFolderContour(
  factories: FolderContourFactories,
  folder: string,
  nodeIds: string[],
): FolderContour {
  const color = folderContourColor(folder);
  const graphics = new factories.Graphics();
  graphics.eventMode = "none";
  const label = new factories.Text(folderLabel(folder), {
    fill: color,
    fontFamily: "sans-serif",
    fontSize: 18,
    fontWeight: "600",
  });
  label.alpha = 0.9;
  label.anchor.set(0, 1);
  label.eventMode = "none";
  label.resolution = 2;
  label.visible = false;
  return { graphics, label, nodeIds };
}

function destroyContour(contour: FolderContour): void {
  contour.graphics.removeFromParent();
  contour.graphics.destroy();
  contour.label.removeFromParent();
  contour.label.destroy();
}

export class FolderContourLayer {
  private container: NativeContainer | undefined;
  private readonly contours = new Map<string, FolderContour>();
  private factories: FolderContourFactories | undefined;
  private groups = new Map<string, readonly string[]>();
  private disposed = false;

  static create(renderer: GraphRendererLike): FolderContourLayer | undefined {
    return canRenderContours(renderer)
      ? new FolderContourLayer(renderer)
      : undefined;
  }

  private constructor(private readonly renderer: ContourRenderer) {}

  setGroups(groups: ReadonlyMap<string, readonly string[]>): void {
    if (this.disposed) return;
    this.groups = new Map(groups);
    if (this.container !== undefined) this.syncContours();
  }

  update(): void {
    if (this.disposed || !this.initializeIfReady()) return;
    this.attach();

    const nodeLookup =
      this.renderer.nodeLookup ??
      Object.fromEntries(
        (this.renderer.nodes ?? []).map((node) => [node.id, node]),
      );

    for (const [folder, contour] of this.contours) {
      const points = contour.nodeIds.flatMap((nodeId): Point[] => {
        const node: GraphNodeLike | undefined = nodeLookup[nodeId];
        return typeof node?.x === "number" &&
          typeof node.y === "number" &&
          Number.isFinite(node.x) &&
          Number.isFinite(node.y)
          ? [{ x: node.x, y: node.y }]
          : [];
      });
      if (
        contour.lastPoints !== undefined &&
        samePoints(contour.lastPoints, points)
      )
        continue;
      contour.lastPoints = points;
      this.drawContour(folder, contour, points);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.container?.removeFromParent();
    this.container?.destroy({ children: true });
    this.container = undefined;
    this.factories = undefined;
    this.contours.clear();
  }

  private initializeIfReady(): boolean {
    if (this.container?.destroyed === true) {
      this.container = undefined;
      this.factories = undefined;
      this.contours.clear();
    }
    if (this.container !== undefined) return true;

    const factories = contourFactories(this.renderer);
    if (factories === undefined) return false;
    this.factories = factories;
    this.container = new factories.Container();
    this.container.name = "Folder Virtual Links contours";
    this.container.eventMode = "none";
    this.syncContours();
    return true;
  }

  private syncContours(): void {
    const container = this.container;
    const factories = this.factories;
    if (container === undefined || factories === undefined) return;

    for (const [folder, contour] of this.contours) {
      if (this.groups.has(folder)) continue;
      destroyContour(contour);
      this.contours.delete(folder);
    }

    for (const [folder, nodeIds] of this.groups) {
      const current = this.contours.get(folder);
      if (current !== undefined) {
        current.nodeIds = [...nodeIds];
        current.lastPoints = undefined;
        continue;
      }

      const contour = createFolderContour(factories, folder, [...nodeIds]);
      this.contours.set(folder, contour);
      container.addChild(contour.graphics, contour.label);
    }
    this.attach();
  }

  private attach(): void {
    const container = this.container;
    if (container === undefined || container.parent === this.renderer.hanger)
      return;
    this.renderer.hanger.addChildAt(container, 0);
  }

  private drawContour(
    folder: string,
    contour: FolderContour,
    points: readonly Point[],
  ): void {
    contour.graphics.clear();
    const hull = paddedConvexHull(
      points,
      CONTOUR_PADDING,
      CONTOUR_CIRCLE_SAMPLES,
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
      0.5,
    );
    contour.graphics.beginFill(color, CONTOUR_FILL_ALPHA);
    drawClosedPolygon(contour.graphics, hull);
    contour.graphics.endFill();

    const bounds = pointBounds(hull);
    contour.label.position.set(
      bounds.left + CONTOUR_LABEL_OFFSET,
      bounds.top - CONTOUR_LABEL_OFFSET,
    );
    contour.label.visible = true;
  }
}
