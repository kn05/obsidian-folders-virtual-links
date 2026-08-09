import { describe, expect, it } from "vitest";
import { FolderContourLayer } from "./contours";
import type { GraphNodeLike, GraphRendererLike } from "./types";

class FakeDisplayObject {
  destroyed = false;
  eventMode: string | undefined;
  parent: FakeContainer | undefined;

  destroy(): void {
    this.destroyed = true;
    this.removeFromParent();
  }

  removeFromParent(): void {
    this.parent?.removeChild(this);
  }
}

class FakeContainer extends FakeDisplayObject {
  readonly children: FakeDisplayObject[] = [];
  name: string | undefined;

  addChild(...children: FakeDisplayObject[]): void {
    for (const child of children) this.addChildAt(child, this.children.length);
  }

  addChildAt(child: unknown, index: number): void {
    if (!(child instanceof FakeDisplayObject))
      throw new Error("Unexpected child");
    child.removeFromParent();
    this.children.splice(index, 0, child);
    child.parent = this;
  }

  removeChild(child: unknown): void {
    const index = this.children.indexOf(child as FakeDisplayObject);
    if (index < 0) return;
    this.children.splice(index, 1);
    (child as FakeDisplayObject).parent = undefined;
  }

  override destroy(options?: { children?: boolean }): void {
    if (options?.children === true) {
      for (const child of [...this.children]) child.destroy();
    }
    super.destroy();
  }
}

class FakeGraphics extends FakeDisplayObject {
  commands: string[] = [];

  beginFill(): void {
    this.commands.push("beginFill");
  }

  clear(): void {
    this.commands = ["clear"];
  }

  closePath(): void {
    this.commands.push("closePath");
  }

  endFill(): void {
    this.commands.push("endFill");
  }

  lineStyle(): void {
    this.commands.push("lineStyle");
  }

  lineTo(): void {
    this.commands.push("lineTo");
  }

  moveTo(): void {
    this.commands.push("moveTo");
  }
}

class FakeText extends FakeDisplayObject {
  alpha = 1;
  readonly anchor = { set: () => undefined };
  readonly position = {
    x: 0,
    y: 0,
    set: (x: number, y: number) => {
      this.position.x = x;
      this.position.y = y;
    },
  };
  resolution = 1;
  visible = true;

  constructor(
    readonly text = "",
    readonly style: object = {},
  ) {
    super();
  }
}

function graphNode(id: string, x: number, y: number): GraphNodeLike {
  return {
    circle: new FakeGraphics(),
    id,
    rendered: true,
    text: new FakeText(),
    weight: 0,
    x,
    y,
  };
}

describe("native folder contour layer", () => {
  it("reuses native PIXI constructors and removes its graphics on dispose", () => {
    const hanger = new FakeContainer();
    const nodes = [
      graphNode("Folder/a.md", 0, 0),
      graphNode("Folder/b.md", 100, 0),
    ];
    const renderer: GraphRendererLike = {
      hanger,
      nodes,
      setData: () => undefined,
    };
    const layer = FolderContourLayer.create(renderer);
    expect(layer).toBeDefined();

    layer?.setGroups(new Map([["Folder", nodes.map((node) => node.id)]]));
    layer?.update();

    expect(hanger.children).toHaveLength(1);
    const container = hanger.children[0];
    expect(container).toBeInstanceOf(FakeContainer);
    if (!(container instanceof FakeContainer)) return;
    expect(container.children).toHaveLength(2);

    const graphics = container.children[0];
    const label = container.children[1];
    expect(graphics).toBeInstanceOf(FakeGraphics);
    expect(label).toBeInstanceOf(FakeText);
    if (graphics instanceof FakeGraphics) {
      expect(graphics.commands).toContain("beginFill");
      expect(graphics.commands).toContain("closePath");
    }
    if (label instanceof FakeText) {
      expect(label.text).toBe("Folder");
      expect(label.visible).toBe(true);
      expect(Number.isFinite(label.position.x)).toBe(true);
      expect(Number.isFinite(label.position.y)).toBe(true);
    }

    layer?.dispose();
    expect(hanger.children).toHaveLength(0);
    expect(container.destroyed).toBe(true);
  });
});
