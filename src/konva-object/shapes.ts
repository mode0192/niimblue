import Konva from "konva";
import { DesignerObject, type DesignerObjectData } from "$/konva-object/base";

export class RectObject extends DesignerObject {
  private readonly shape: Konva.Rect;
  rx = 0;
  ry = 0;

  constructor(options: Record<string, any> = {}) {
    super("Rect", {
      width: 64,
      height: 64,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 3,
      ...options,
    });
    this.rx = Number(options.rx ?? 0);
    this.ry = Number(options.ry ?? this.rx);
    this.shape = new Konva.Rect({ listening: false });
    this.node.add(this.shape);
    this.updateVisual();
  }

  protected updateVisual(): void {
    if (!this.shape) return;
    this.shape.setAttrs({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      cornerRadius: Math.max(this.rx, this.ry),
    });
  }

  override toObject(): DesignerObjectData {
    return { ...super.toObject(), rx: this.rx, ry: this.ry };
  }

  async clone(): Promise<RectObject> {
    const data = this.toObject();
    delete data.id;
    return new RectObject(data);
  }
}

export class CircleObject extends DesignerObject {
  private readonly shape: Konva.Ellipse;

  constructor(options: Record<string, any> = {}) {
    const radius = Number(options.radius ?? 32);
    super("Circle", {
      width: options.width ?? radius * 2,
      height: options.height ?? radius * 2,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 3,
      ...options,
    });
    this.shape = new Konva.Ellipse({ listening: false });
    this.node.add(this.shape);
    this.updateVisual();
  }

  protected updateVisual(): void {
    if (!this.shape) return;
    this.shape.setAttrs({
      x: this.width / 2,
      y: this.height / 2,
      radiusX: this.width / 2,
      radiusY: this.height / 2,
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
    });
  }

  async clone(): Promise<CircleObject> {
    const data = this.toObject();
    delete data.id;
    return new CircleObject(data);
  }
}

export class LineObject extends DesignerObject {
  private readonly shape: Konva.Line;

  constructor(options: Record<string, any> = {}) {
    super("Polyline", {
      width: 64,
      height: 1,
      fill: "transparent",
      stroke: "black",
      strokeWidth: 3,
      ...options,
    });
    this.shape = new Konva.Line({ listening: false });
    this.node.add(this.shape);
    this.updateVisual();
  }

  protected updateVisual(): void {
    if (!this.shape) return;
    this.shape.setAttrs({
      points: [0, this.height / 2, this.width, this.height / 2],
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      lineCap: "butt",
    });
  }

  override getTransformerConfig(): Record<string, unknown> {
    return {
      rotateEnabled: true,
      enabledAnchors: ["middle-left", "middle-right"],
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
    };
  }

  async clone(): Promise<LineObject> {
    const data = this.toObject();
    delete data.id;
    return new LineObject(data);
  }
}

export class UnsupportedObject extends DesignerObject {
  private readonly rect: Konva.Rect;
  private readonly label: Konva.Text;
  legacyType: string;

  constructor(legacyType: string, options: Record<string, any> = {}) {
    super("Unsupported", {
      width: 80,
      height: 40,
      fill: "white",
      stroke: "black",
      strokeWidth: 1,
      ...options,
    });
    this.legacyType = legacyType;
    this.rect = new Konva.Rect({ listening: false });
    this.label = new Konva.Text({
      listening: false,
      align: "center",
      verticalAlign: "middle",
      fontSize: 10,
      fill: "black",
    });
    this.node.add(this.rect, this.label);
    this.updateVisual();
  }

  protected updateVisual(): void {
    if (!this.rect || !this.label) return;
    this.rect.setAttrs({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      fill: "white",
      stroke: "black",
      dash: [4, 3],
    });
    this.label.setAttrs({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      text: `Unsupported\n${this.legacyType}`,
    });
  }

  override toObject(): DesignerObjectData {
    return { ...super.toObject(), legacyType: this.legacyType };
  }

  async clone(): Promise<UnsupportedObject> {
    const data = this.toObject();
    delete data.id;
    return new UnsupportedObject(this.legacyType, data);
  }
}
