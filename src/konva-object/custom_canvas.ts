import Konva from "konva";
import { DEFAULT_LABEL_PROPS, GRID_SIZE } from "$/defaults";
import type { LabelProps } from "$/types";
import type { DesignerObject } from "$/konva-object/base";
import { createObjectFromData, serializeObject } from "$/konva-object/factory";
import { TextboxObject } from "$/konva-object/textbox";

type EventName =
  | "mouse:down"
  | "object:moving"
  | "object:modified"
  | "object:removed"
  | "object:scaling"
  | "text:changed"
  | "selection:created"
  | "selection:updated"
  | "selection:cleared"
  | "dragover"
  | "drop:after";

type Handler = (event: any) => void;

type LabelBounds = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  height: number;
};

type FoldSegment = { start: number; end: number };
type FoldInfo = { axis: "vertical" | "horizontal" | "none"; points: number[]; segments: FoldSegment[] };

export class CustomCanvas {
  readonly stage: Konva.Stage;
  readonly backgroundLayer: Konva.Layer;
  readonly objectLayer: Konva.Layer;
  readonly overlayLayer: Konva.Layer;
  readonly mirrorGhosts: Konva.Group;
  readonly transformer: Konva.Transformer;

  width: number;
  height: number;

  private labelProps: LabelProps = DEFAULT_LABEL_PROPS;
  private objects: DesignerObject[] = [];
  private selection: DesignerObject[] = [];
  private handlers = new Map<EventName, Set<Handler>>();
  private customBackground = true;
  private highlightMirror = true;
  private gridEnabled = false;
  private virtualZoomRatio = 1;

  onZoomChange?: (zoom: number) => void;

  constructor(container?: HTMLElement, options?: { width?: number; height?: number }) {
    this.width = Number(options?.width ?? DEFAULT_LABEL_PROPS.size.width);
    this.height = Number(options?.height ?? DEFAULT_LABEL_PROPS.size.height);

    const stageContainer = container ?? document.createElement("div");
    this.stage = new Konva.Stage({
      container: stageContainer,
      width: this.width,
      height: this.height,
    });
    this.backgroundLayer = new Konva.Layer({ listening: false });
    this.objectLayer = new Konva.Layer();
    this.overlayLayer = new Konva.Layer();

    this.mirrorGhosts = new Konva.Group({ listening: false });
    this.transformer = new Konva.Transformer({
      rotateEnabled: true,
      borderStroke: "#0d6efd",
      anchorStroke: "#0d6efd",
      anchorFill: "white",
      anchorSize: 8,
      padding: 1,
    });
    this.overlayLayer.add(this.mirrorGhosts, this.transformer);

    this.stage.add(this.backgroundLayer, this.objectLayer, this.overlayLayer);
    this.bindStageEvents();
    this.drawBackground();
  }

  private bindStageEvents(): void {
    this.stage.on("pointerdown", (e) => {
      this.emit("mouse:down", { e: e.e, target: e.target });

      if (e.target === this.stage || e.target.getLayer() === this.backgroundLayer) {
        this.discardActiveObject();
        return;
      }

      const group = e.target.findAncestor(".designer-object", true) as Konva.Group | null;
      if (!group) return;

      const object = this.objects.find((candidate) => candidate.node === group);
      if (!object) return;

      const pointer = e.e as PointerEvent;
      const multi = pointer.shiftKey || pointer.ctrlKey || pointer.metaKey;
      if (multi) {
        const already = this.selection.includes(object);
        this.applySelection(already ? this.selection.filter((item) => item !== object) : [...this.selection, object]);
      } else {
        this.applySelection([object]);
      }
    });

    this.stage.container().addEventListener("dragover", (e) => {
      e.preventDefault();
      this.emit("dragover", { e });
    });
    this.stage.container().addEventListener("drop", (e) => {
      e.preventDefault();
      this.emit("drop:after", { e });
    });

    this.stage.container().addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        this.virtualZoom(e.deltaY > 0 ? this.virtualZoomRatio / 1.05 : this.virtualZoomRatio * 1.05);
      },
      { passive: false },
    );

    this.transformer.on("transform", () => {
      this.emit("object:scaling", { target: this.selection[0] });
    });

    this.transformer.on("transformend", () => {
      for (const object of this.selection) {
        object.normalizeAfterTransform(this.transformer.getActiveAnchor() ?? "scale");
      }
      this.updateTransformer();
    });
  }

  private bindObject(object: DesignerObject): void {
    object.canvas = this;
    object.on("modified", (event) => {
      this.emit("object:modified", { target: object, ...event });
    });

    object.node.on("dragmove", () => {
      const pos = object.getPointByOrigin("left", "top");
      object.setPositionByOrigin(
        {
          x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
        },
        "left",
        "top",
      );
      this.updateTransformer();
      this.emit("object:moving", { target: object });
    });

    object.node.on("dragend", () => {
      object.emitModified({ action: "drag" });
    });
  }

  on(event: EventName, handler: Handler): void {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(event, set);
  }

  off(event: EventName, handler: Handler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: EventName, payload: any): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  emitTextChanged(target: TextboxObject): void {
    this.emit("text:changed", { target });
  }

  add(...objects: DesignerObject[]): void {
    for (const object of objects) {
      this.bindObject(object);
      this.objects.push(object);
      this.objectLayer.add(object.node);
    }
    this.requestRenderAll();
  }

  remove(object: DesignerObject): void {
    this.selection = this.selection.filter((selected) => selected !== object);
    this.objects = this.objects.filter((candidate) => candidate !== object);
    object.node.destroy();
    object.canvas = undefined;
    this.updateTransformer();
    this.emit("object:removed", { target: object });
  }

  clear(): void {
    const old = [...this.objects];
    this.selection = [];
    this.objects = [];
    old.forEach((object) => {
      if (object instanceof TextboxObject) object.destroy();
      else object.node.destroy();
    });
    this.updateTransformer();
    this.requestRenderAll();
    old.forEach((target) => this.emit("object:removed", { target }));
  }

  forEachObject(callback: (object: DesignerObject) => void): void {
    this.objects.forEach(callback);
  }

  getObjects(): DesignerObject[] {
    return [...this.objects];
  }

  getActiveObjects(): DesignerObject[] {
    return [...this.selection];
  }

  getActiveObject(): DesignerObject | undefined {
    return this.selection.length === 1 ? this.selection[0] : undefined;
  }

  setActiveObject(object: DesignerObject): void {
    this.applySelection([object]);
  }

  setActiveObjects(objects: DesignerObject[]): void {
    this.applySelection(objects);
  }

  discardActiveObject(): void {
    this.applySelection([]);
  }

  private applySelection(next: DesignerObject[]): void {
    const previous = this.selection;
    this.selection = next;

    if (next.length === 0) {
      this.transformer.nodes([]);
      if (previous.length > 0) this.emit("selection:cleared", {});
    } else {
      this.transformer.nodes(next.map((object) => object.node));
      if (next.length === 1) {
        this.transformer.setAttrs(next[0].getTransformerConfig());
      } else {
        this.transformer.setAttrs({
          rotateEnabled: true,
          enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
          keepRatio: true,
        });
      }
      const event = { selected: next, deselected: previous.filter((item) => !next.includes(item)) };
      this.emit(previous.length === 0 ? "selection:created" : "selection:updated", event);
    }

    this.overlayLayer.batchDraw();
  }

  updateTransformer(): void {
    this.transformer.forceUpdate();
    this.overlayLayer.batchDraw();
  }

  bringObjectToFront(object: DesignerObject): void {
    object.node.moveToTop();
    this.transformer.moveToTop();
    this.requestRenderAll();
  }

  sendObjectToBack(object: DesignerObject): void {
    object.node.moveToBottom();
    this.requestRenderAll();
  }

  centerObject(object: DesignerObject): void {
    this.centerObjectH(object);
    this.centerObjectV(object);
  }

  centerObjectH(object: DesignerObject): void {
    const bounds = this.getLabelBounds();
    const fold = this.getFoldInfo();
    const pos = object.getPointByOrigin("center", "center");
    let centerX = bounds.startX + bounds.width / 2;

    if (fold.axis === "vertical") {
      for (const segment of fold.segments) {
        if (pos.x >= segment.start && pos.x <= segment.end) {
          centerX = segment.start + (segment.end - segment.start) / 2;
          break;
        }
      }
    }
    object.setPositionByOrigin({ x: centerX, y: pos.y }, "center", "center");
  }

  centerObjectV(object: DesignerObject): void {
    const bounds = this.getLabelBounds();
    const fold = this.getFoldInfo();
    const pos = object.getPointByOrigin("center", "center");
    let centerY = bounds.startY + bounds.height / 2;

    if (fold.axis === "horizontal") {
      for (const segment of fold.segments) {
        if (pos.y >= segment.start && pos.y <= segment.end) {
          centerY = segment.start + (segment.end - segment.start) / 2;
          break;
        }
      }
    }
    object.setPositionByOrigin({ x: pos.x, y: centerY }, "center", "center");
  }

  setDimensions(size: { width: number; height: number }): void {
    this.width = Math.max(1, size.width);
    this.height = Math.max(1, size.height);
    this.stage.size({ width: this.width, height: this.height });
    this.virtualZoom(this.virtualZoomRatio);
    this.drawBackground();
  }

  setLabelProps(value: LabelProps): void {
    this.labelProps = value;
    this.drawBackground();
  }

  setCustomBackground(value: boolean): void {
    this.customBackground = value;
    this.drawBackground();
  }

  setHighlightMirror(value: boolean): void {
    this.highlightMirror = value;
    this.updateMirrorGhosts();
    this.requestRenderAll();
  }

  setGridEnabled(value: boolean): void {
    this.gridEnabled = value;
    this.drawBackground();
  }

  requestRenderAll(): void {
    this.updateMirrorGhosts();
    this.stage.batchDraw();
  }

  renderAll(): void {
    this.stage.draw();
  }

  getContext(): CanvasRenderingContext2D | undefined {
    return (this.objectLayer.getCanvas().getContext() as any)._context;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  virtualZoom(value: number): void {
    this.virtualZoomRatio = Math.min(4, Math.max(0.25, value));
    const content = this.stage.content;
    content.style.transformOrigin = "0 0";
    content.style.transform = `scale(${this.virtualZoomRatio})`;
    const host = this.stage.container();
    host.style.width = `${this.width * this.virtualZoomRatio}px`;
    host.style.height = `${this.height * this.virtualZoomRatio}px`;
    this.onZoomChange?.(this.virtualZoomRatio);
  }

  virtualZoomIn(): void {
    this.virtualZoom(this.virtualZoomRatio * 1.05);
  }

  virtualZoomOut(): void {
    this.virtualZoom(this.virtualZoomRatio / 1.05);
  }

  getVirtualZoom(): number {
    return this.virtualZoomRatio;
  }

  resetVirtualZoom(): void {
    this.virtualZoom(1);
  }

  getLabelBounds(): LabelBounds {
    let startX = 0;
    let startY = 0;
    let endX = this.width;
    let endY = this.height;
    const tailLength = this.labelProps.tailLength ?? 0;

    if (this.labelProps.tailPos === "right") endX -= tailLength;
    else if (this.labelProps.tailPos === "bottom") endY -= tailLength;
    else if (this.labelProps.tailPos === "left") startX += tailLength;
    else if (this.labelProps.tailPos === "top") startY += tailLength;

    return { startX, startY, endX, endY, width: endX - startX, height: endY - startY };
  }

  getFoldInfo(): FoldInfo {
    const bounds = this.getLabelBounds();
    const points: number[] = [];
    const segments: FoldSegment[] = [];
    const count = Math.max(1, this.labelProps.splitParts ?? 2);

    if (count < 2 || this.labelProps.split === "none" || !this.labelProps.split) {
      return { axis: "none", points, segments };
    }

    if (this.labelProps.split === "horizontal") {
      const step = bounds.height / count;
      let last = bounds.startY;
      for (let i = 1; i < count; i++) {
        const point = bounds.startY + step * i;
        points.push(point);
        segments.push({ start: last, end: point });
        last = point;
      }
      segments.push({ start: last, end: bounds.endY });
      return { axis: "horizontal", points, segments };
    }

    const step = bounds.width / count;
    let last = bounds.startX;
    for (let i = 1; i < count; i++) {
      const point = bounds.startX + step * i;
      points.push(point);
      segments.push({ start: last, end: point });
      last = point;
    }
    segments.push({ start: last, end: bounds.endX });
    return { axis: "vertical", points, segments };
  }

  private drawBackground(): void {
    this.backgroundLayer.destroyChildren();

    const background = new Konva.Shape({
      listening: false,
      sceneFunc: (context) => {
        const ctx = (context as any)._context as CanvasRenderingContext2D;
        ctx.save();
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = "white";

        if (!this.customBackground) {
          ctx.fillRect(0, 0, this.width, this.height);
          ctx.restore();
          return;
        }

        if (this.labelProps.shape === "circle") {
          ctx.beginPath();
          ctx.arc(this.width / 2, this.height / 2, Math.min(this.width, this.height) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        const bounds = this.getLabelBounds();
        const radius = this.labelProps.shape === "rounded_rect" ? 10 : 0;
        const fold = this.getFoldInfo();

        ctx.fillStyle = "#cfcfcf";
        const tailLength = this.labelProps.tailLength ?? 0;
        if (tailLength > 0) {
          if (this.labelProps.tailPos === "right") ctx.fillRect(bounds.endX, this.height / 2 - 20, tailLength, 40);
          else if (this.labelProps.tailPos === "left") ctx.fillRect(0, this.height / 2 - 20, tailLength, 40);
          else if (this.labelProps.tailPos === "bottom") ctx.fillRect(this.width / 2 - 20, bounds.endY, 40, tailLength);
          else if (this.labelProps.tailPos === "top") ctx.fillRect(this.width / 2 - 20, 0, 40, tailLength);
        }

        ctx.fillStyle = "white";
        ctx.beginPath();
        if (radius > 0 && "roundRect" in ctx) {
          ctx.roundRect(bounds.startX, bounds.startY, bounds.width, bounds.height, radius);
        } else {
          ctx.rect(bounds.startX, bounds.startY, bounds.width, bounds.height);
        }
        ctx.fill();

        if (fold.axis !== "none") {
          ctx.save();
          ctx.strokeStyle = "#cfcfcf";
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          if (fold.axis === "horizontal") {
            fold.points.forEach((y) => {
              ctx.moveTo(bounds.startX, y);
              ctx.lineTo(bounds.endX, y);
            });
          } else {
            fold.points.forEach((x) => {
              ctx.moveTo(x, bounds.startY);
              ctx.lineTo(x, bounds.endY);
            });
          }
          ctx.stroke();
          ctx.restore();
        }

        if (this.gridEnabled) {
          ctx.save();
          ctx.strokeStyle = "rgba(100, 100, 255, 0.25)";
          ctx.lineWidth = 1;
          const step = GRID_SIZE * 5;
          ctx.beginPath();
          for (let x = bounds.startX + step; x < bounds.endX; x += step) {
            ctx.moveTo(x, bounds.startY);
            ctx.lineTo(x, bounds.endY);
          }
          for (let y = bounds.startY + step; y < bounds.endY; y += step) {
            ctx.moveTo(bounds.startX, y);
            ctx.lineTo(bounds.endX, y);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      },
    });

    this.backgroundLayer.add(background);
    this.backgroundLayer.draw();
  }

  toJSON(): { version: string; engine: "konva"; objects: Record<string, unknown>[] } {
    return {
      version: "konva-1",
      engine: "konva",
      objects: this.objects.map(serializeObject),
    };
  }

  async loadFromJSON(state: { objects?: unknown[] }): Promise<void> {
    this.clear();
    for (const raw of state.objects ?? []) {
      if (raw && typeof raw === "object") {
        const object = await createObjectFromData(raw as Record<string, any>);
        this.add(object);
      }
    }
    this.discardActiveObject();
    this.requestRenderAll();
  }

  toDataURL(options?: { format?: string; quality?: number; multiplier?: number }): string {
    const mimeType = options?.format === "jpeg" ? "image/jpeg" : "image/png";
    return this.stage.toDataURL({
      mimeType,
      quality: options?.quality,
      pixelRatio: options?.multiplier ?? 1,
    });
  }

  toCanvasElement(): HTMLCanvasElement {
    const transformerNodes = this.transformer.nodes();
    this.transformer.nodes([]);
    this.overlayLayer.draw();
    const canvas = this.stage.toCanvas({ pixelRatio: 1 });
    this.transformer.nodes(transformerNodes);
    this.overlayLayer.draw();
    return canvas;
  }

  private getMirroredPositions(object: DesignerObject): Array<{ x: number; y: number; flip: boolean }> {
    const fold = this.getFoldInfo();
    const result: Array<{ x: number; y: number; flip: boolean }> = [];

    if (fold.axis === "none" || !["copy", "flip"].includes(this.labelProps.mirror ?? "none")) {
      return result;
    }

    const bounds = this.getLabelBounds();
    const center = object.getPointByOrigin("center", "center");

    if (this.labelProps.mirror === "copy") {
      for (const point of fold.points) {
        if (fold.axis === "vertical") {
          result.push({ x: point + (center.x - bounds.startX), y: center.y, flip: false });
        } else {
          result.push({ x: center.x, y: point + (center.y - bounds.startY), flip: false });
        }
      }
    } else if (fold.points.length === 1) {
      if (fold.axis === "vertical") {
        result.push({
          x: fold.points[0] + (fold.points[0] - center.x),
          y: bounds.startY + bounds.endY - center.y,
          flip: true,
        });
      } else {
        result.push({
          x: bounds.startX + bounds.endX - center.x,
          y: fold.points[0] + (fold.points[0] - center.y),
          flip: true,
        });
      }
    }

    return result;
  }

  private updateMirrorGhosts(): void {
    this.mirrorGhosts.destroyChildren();

    if (!this.highlightMirror || this.selection.length > 1) {
      this.overlayLayer.batchDraw();
      return;
    }

    for (const object of this.objects) {
      const bbox = object.getBoundingRect();
      const center = object.getPointByOrigin("center", "center");
      for (const mirror of this.getMirroredPositions(object)) {
        this.mirrorGhosts.add(
          new Konva.Rect({
            x: mirror.x - bbox.width / 2,
            y: mirror.y - bbox.height / 2,
            width: bbox.width,
            height: bbox.height,
            fill: "rgba(0, 0, 0, 0.3)",
            listening: false,
          }),
        );
      }
    }

    this.mirrorGhosts.moveToBottom();
    this.transformer.moveToTop();
    this.overlayLayer.batchDraw();
  }

  async createMirroredObjects(): Promise<void> {
    const fold = this.getFoldInfo();
    if (fold.axis === "none" || !["copy", "flip"].includes(this.labelProps.mirror ?? "none")) return;

    const originals = [...this.objects];

    for (const object of originals) {
      for (const mirror of this.getMirroredPositions(object)) {
        const clone = await object.clone();
        clone.setPositionByOrigin({ x: mirror.x, y: mirror.y }, "center", "center");
        if (mirror.flip) {
          clone.angle = (clone.angle + 180) % 360;
        }
        this.add(clone);
      }
    }
  }

  dispose(): void {
    this.stage.destroy();
    this.handlers.clear();
    this.objects = [];
    this.selection = [];
  }
}
