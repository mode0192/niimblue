import Konva from "konva";
import type { CustomCanvas } from "$/konva-object/custom_canvas";

export type OriginX = "left" | "center" | "right";
export type OriginY = "top" | "center" | "bottom";
export type ObjectModifiedEvent = { action?: string };
export type DesignerObjectData = Record<string, unknown> & { type: string };

type ModifiedListener = (event?: ObjectModifiedEvent) => void;

let objectCounter = 0;

const makeObjectId = () => `obj_${Date.now().toString(36)}_${(objectCounter++).toString(36)}`;

export abstract class DesignerObject {
  readonly node: Konva.Group;
  readonly type: string;
  id: string;
  canvas?: CustomCanvas;

  snapAngle = 10;
  originX: OriginX = "left";
  originY: OriginY = "top";

  private modifiedListeners = new Set<ModifiedListener>();
  private _fill: string = "transparent";
  private _stroke: string = "black";
  private _strokeWidth = 0;

  protected constructor(type: string, options: Record<string, any> = {}) {
    this.type = type;
    this.id = typeof options.id === "string" ? options.id : makeObjectId();

    const width = Math.max(1, Number(options.width ?? 64));
    const height = Math.max(1, Number(options.height ?? 64));
    const left = Number(options.left ?? 0);
    const top = Number(options.top ?? 0);

    this.originX = (options.originX ?? "left") as OriginX;
    this.originY = (options.originY ?? "top") as OriginY;
    this.snapAngle = Number(options.snapAngle ?? 10);
    this._fill = String(options.fill ?? "transparent");
    this._stroke = String(options.stroke ?? "black");
    this._strokeWidth = Number(options.strokeWidth ?? 0);

    this.node = new Konva.Group({
      x: left + width / 2,
      y: top + height / 2,
      width,
      height,
      offsetX: width / 2,
      offsetY: height / 2,
      rotation: Number(options.angle ?? 0),
      scaleX: Number(options.scaleX ?? 1),
      scaleY: Number(options.scaleY ?? 1),
      draggable: true,
      name: "designer-object",
    });

    this.node.setAttr("designerId", this.id);
    this.node.setAttr("designerType", type);
  }

  get left(): number {
    return this.getPointByOrigin("left", "top").x;
  }

  set left(value: number) {
    const p = this.getPointByOrigin("left", "top");
    this.setPositionByOrigin({ x: value, y: p.y }, "left", "top");
  }

  get top(): number {
    return this.getPointByOrigin("left", "top").y;
  }

  set top(value: number) {
    const p = this.getPointByOrigin("left", "top");
    this.setPositionByOrigin({ x: p.x, y: value }, "left", "top");
  }

  get width(): number {
    return this.node.width();
  }

  set width(value: number) {
    this.resize(Math.max(1, value), this.height);
  }

  get height(): number {
    return this.node.height();
  }

  set height(value: number) {
    this.resize(this.width, Math.max(1, value));
  }

  get scaleX(): number {
    return this.node.scaleX();
  }

  set scaleX(value: number) {
    this.node.scaleX(value);
  }

  get scaleY(): number {
    return this.node.scaleY();
  }

  set scaleY(value: number) {
    this.node.scaleY(value);
  }

  get angle(): number {
    return this.node.rotation();
  }

  set angle(value: number) {
    this.node.rotation(value);
  }

  get fill(): string {
    return this._fill;
  }

  set fill(value: string) {
    this._fill = value;
    this.updateVisual();
  }

  get stroke(): string {
    return this._stroke;
  }

  set stroke(value: string) {
    this._stroke = value;
    this.updateVisual();
  }

  get strokeWidth(): number {
    return this._strokeWidth;
  }

  set strokeWidth(value: number) {
    this._strokeWidth = Math.max(0, Number(value));
    this.updateVisual();
  }

  set dirty(value: boolean) {
    if (value) {
      this.updateVisual();
    }
  }

  set centeredRotation(_value: boolean) {
    // Konva groups are already rotated around their logical center.
  }

  protected resize(width: number, height: number): void {
    const topLeft = this.getPointByOrigin("left", "top");
    this.node.size({ width, height });
    this.node.offset({ x: width / 2, y: height / 2 });
    this.setPositionByOrigin(topLeft, "left", "top");
    this.updateVisual();
  }

  protected setSizeRaw(width: number, height: number, preserveTopLeft = true): void {
    const topLeft = preserveTopLeft ? this.getPointByOrigin("left", "top") : undefined;
    this.node.size({ width: Math.max(1, width), height: Math.max(1, height) });
    this.node.offset({ x: this.node.width() / 2, y: this.node.height() / 2 });
    if (topLeft) {
      this.setPositionByOrigin(topLeft, "left", "top");
    }
  }

  protected abstract updateVisual(): void;

  set(key: string, value: unknown): this;
  set(values: Record<string, unknown>): this;
  set(keyOrValues: string | Record<string, unknown>, value?: unknown): this {
    if (typeof keyOrValues === "string") {
      this.applyProperty(keyOrValues, value);
    } else {
      for (const [key, val] of Object.entries(keyOrValues)) {
        this.applyProperty(key, val);
      }
    }
    this.updateVisual();
    this.canvas?.requestRenderAll();
    return this;
  }

  private applyProperty(key: string, value: unknown) {
    switch (key) {
      case "left":
        this.left = Number(value);
        break;
      case "top":
        this.top = Number(value);
        break;
      case "width":
        this.width = Number(value);
        break;
      case "height":
        this.height = Number(value);
        break;
      case "scaleX":
        this.scaleX = Number(value);
        break;
      case "scaleY":
        this.scaleY = Number(value);
        break;
      case "angle":
        this.angle = Number(value);
        break;
      case "fill":
        this._fill = String(value);
        break;
      case "stroke":
        this._stroke = String(value);
        break;
      case "strokeWidth":
        this._strokeWidth = Math.max(0, Number(value));
        break;
      case "originX":
        this.originX = value as OriginX;
        break;
      case "originY":
        this.originY = value as OriginY;
        break;
      case "snapAngle":
        this.snapAngle = Number(value);
        break;
      default:
        (this as any)[key] = value;
        break;
    }
  }

  getPointByOrigin(originX: OriginX, originY: OriginY): { x: number; y: number } {
    const x = originX === "left" ? 0 : originX === "center" ? this.width / 2 : this.width;
    const y = originY === "top" ? 0 : originY === "center" ? this.height / 2 : this.height;
    return this.node.getAbsoluteTransform().point({ x, y });
  }

  setPositionByOrigin(pos: { x: number; y: number }, originX: OriginX, originY: OriginY): void {
    const current = this.getPointByOrigin(originX, originY);
    this.node.position({
      x: this.node.x() + (pos.x - current.x),
      y: this.node.y() + (pos.y - current.y),
    });
  }

  getBoundingRect(): { left: number; top: number; width: number; height: number } {
    const layer = this.node.getLayer();
    const rect = layer
      ? this.node.getClientRect({ relativeTo: layer })
      : this.node.getClientRect();
    return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
  }

  scaleToWidth(width: number): void {
    const scale = width / Math.max(1, this.width);
    this.scaleX = scale;
    this.scaleY = scale;
  }

  scaleToHeight(height: number): void {
    const scale = height / Math.max(1, this.height);
    this.scaleX = scale;
    this.scaleY = scale;
  }

  rotate(angle: number): void {
    this.angle = angle;
  }

  setCoords(): void {
    this.canvas?.updateTransformer();
  }

  on(event: "modified", listener: ModifiedListener): void {
    if (event === "modified") {
      this.modifiedListeners.add(listener);
    }
  }

  off(event: "modified", listener: ModifiedListener): void {
    if (event === "modified") {
      this.modifiedListeners.delete(listener);
    }
  }

  emitModified(event?: ObjectModifiedEvent): void {
    this.modifiedListeners.forEach((listener) => listener(event));
  }

  getTransformerConfig(): Record<string, unknown> {
    return {
      rotateEnabled: true,
      enabledAnchors: [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
    };
  }

  normalizeAfterTransform(action = "scale"): void {
    const topLeft = this.getPointByOrigin("left", "top");
    const width = Math.max(1, this.width * Math.abs(this.scaleX));
    const height = Math.max(1, this.height * Math.abs(this.scaleY));

    this.node.scale({ x: 1, y: 1 });
    this.node.size({ width, height });
    this.node.offset({ x: width / 2, y: height / 2 });
    this.setPositionByOrigin(topLeft, "left", "top");
    this.updateVisual();
    this.emitModified({ action });
  }

  toObject(): DesignerObjectData {
    return {
      type: this.type,
      id: this.id,
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      angle: this.angle,
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      originX: this.originX,
      originY: this.originY,
      snapAngle: this.snapAngle,
    };
  }

  abstract clone(): Promise<DesignerObject>;
}
