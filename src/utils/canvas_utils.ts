import * as fabric from "fabric";
import ArUcoMarker from "$/fabric-object/aruco";
import Barcode from "$/fabric-object/barcode";
import QRCode from "$/fabric-object/qrcode";
import { OBJECT_DEFAULTS_TEXT } from "$/defaults";

/**
 * How an object's size is edited:
 * - square:  QR code, ArUco. Width and height are always equal (one size value).
 * - rect:    Rect. Width and height are real values (scale stays 1). Edited like "scaled", so it shares the inputs.
 * - content: Text, barcode. Size is driven by the content, no size inputs.
 * - scaled:  Image, circle, line, polyline, SVG group. Resized through scaleX/scaleY.
 */
export type SizeKind = "square" | "rect" | "content" | "scaled";

export class CanvasUtils {
  /** Smallest QR/ArUco side that still renders. */
  static readonly SQUARE_MIN_SIZE = 42;

  static getSizeKind(obj: fabric.FabricObject): SizeKind {
    if (obj instanceof QRCode || obj instanceof ArUcoMarker) return "square";
    if (obj instanceof fabric.Rect) return "rect";
    if (obj instanceof fabric.FabricText || obj instanceof Barcode) return "content";
    return "scaled";
  }

  /** The Line tool creates a Polyline (old saved Lines are converted to one on load). */
  static isLine(obj: fabric.FabricObject): boolean {
    return obj instanceof fabric.Line || obj instanceof fabric.Polyline;
  }

  /** Squares have a minimum size and an even side length (avoids half-pixel rendering). */
  static normalizeSquareSize(size: number): number {
    const rounded = Math.max(Math.round(size), CanvasUtils.SQUARE_MIN_SIZE);
    return rounded + (rounded % 2);
  }

  static setSquareSize(obj: fabric.FabricObject, size: number) {
    const side = CanvasUtils.normalizeSquareSize(size);
    obj.set({ width: side, height: side });
  }

  /** User choice stored on the object, so it survives deselect, undo/redo, save and load. */
  static getAspectLock(obj: fabric.FabricObject): boolean | undefined {
    return (obj as { lockAspectRatio?: boolean }).lockAspectRatio;
  }

  static setAspectLock(obj: fabric.FabricObject, locked: boolean) {
    (obj as { lockAspectRatio?: boolean }).lockAspectRatio = locked;
  }

  /**
   * Lock state to show: the stored choice, otherwise on only if the object is currently not distorted.
   * A rect always has scale 1, so there is nothing to compare: it starts unlocked.
   */
  static isAspectLocked(obj: fabric.FabricObject): boolean {
    const stored = CanvasUtils.getAspectLock(obj);
    if (stored !== undefined) return stored;
    if (CanvasUtils.getSizeKind(obj) === "rect") return false;
    return Math.abs(obj.scaleX - obj.scaleY) < 1e-6;
  }

  static equalSpacingFillText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, printWidth: number) {
    // calculate every character width, and spacing
    const widths = [];
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      const metrics = ctx.measureText(char);
      widths.push(metrics.width);
    }
    const totalWidth = widths.reduce((a, b) => a + b, 0);
    const spacing = (printWidth - totalWidth) / (text.length - 1);

    // print every character with calculated spacing
    let offset = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      ctx.fillText(char, x + offset, y);
      offset += widths[i] + spacing;
    }
  }

  static fixFabricObjectScale(obj: fabric.FabricObject) {
    const kind = CanvasUtils.getSizeKind(obj);
    // These objects keep scale at 1 and store the real size in width/height.
    const bakesScale = kind === "square" || kind === "rect" || obj instanceof Barcode;

    if (bakesScale) {
      obj.set({
        width: Math.round(obj.width * (obj.scaleX ?? 1)),
        height: Math.round(obj.height * (obj.scaleY ?? 1)),
        scaleX: 1,
        scaleY: 1,
        left: Math.round(obj.left),
        top: Math.round(obj.top),
      });

      if (kind === "square") {
        CanvasUtils.setSquareSize(obj, obj.width);
      }
    }
  }

  static fitObjectIntoCanvas(canvas: fabric.Canvas, obj: fabric.FabricObject, xMargin: number, yMarin: number) {
    const widthRatio = canvas.width / (obj.width + xMargin * 2);
    const heightRatio = canvas.height / (obj.height + yMarin * 2);
    const scaleFactor = Math.min(widthRatio, heightRatio);
    obj.set({ left: xMargin, top: yMarin });
    obj.scale(scaleFactor);
    canvas.centerObjectV(obj);
    canvas.centerObjectH(obj);
  }

  static renderError(ctx: CanvasRenderingContext2D, width: number, height: number): void {
      ctx.save();
      ctx.fillStyle = "black";
      ctx.translate(-width / 2, -height / 2); // make top-left origin
      ctx.translate(-0.5, -0.5); // blurry rendering fix
      ctx.fillRect(0, 0, width + 1, height + 1);
      ctx.restore();
      
      ctx.save();
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = `16px ${OBJECT_DEFAULTS_TEXT.fontFamily}`;
      ctx.fillText("ERR", 0, 0);
      ctx.restore();
    }
}
