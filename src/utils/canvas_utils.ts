import * as fabric from "fabric";
import ArUcoMarker from "$/fabric-object/aruco";
import Barcode from "$/fabric-object/barcode";
import QRCode from "$/fabric-object/qrcode";
import { OBJECT_DEFAULTS_TEXT } from "$/defaults";

export class CanvasUtils {
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
    const isNotScalable = obj instanceof Barcode || obj instanceof fabric.Rect || obj instanceof QRCode || obj instanceof ArUcoMarker;

    if (isNotScalable) {
      obj.set({
        width: Math.round(obj.width * (obj.scaleX ?? 1)),
        height: Math.round(obj.height * (obj.scaleY ?? 1)),
        scaleX: 1,
        scaleY: 1,
        left: Math.round(obj.left),
        top: Math.round(obj.top),
      });

      if (obj instanceof QRCode || obj instanceof ArUcoMarker) {
        const qrMin = 42;
        const size = Math.max(obj.width + (obj.width % 2), qrMin);
        obj.set({
          width: size,
          height: size,
        });
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

  static resizeAroundCenter(canvas: fabric.Canvas, size: { width: number; height: number }): void {
    const dx = (size.width - canvas.getWidth()) / 2;
    const dy = (size.height - canvas.getHeight()) / 2;

    if (dx !== 0 || dy !== 0) {
      const activeObject = canvas.getActiveObject();
      const activeSelection = activeObject instanceof fabric.ActiveSelection ? activeObject : undefined;
      const activeSelectionObjects = new Set(activeSelection?.getObjects() ?? []);

      const translate = (obj: fabric.FabricObject) => {
        const position = obj.getXY();
        obj.setXY(new fabric.Point(position.x + dx, position.y + dy));
        obj.setCoords();
      };

      canvas.getObjects().forEach((obj) => {
        if (!activeSelectionObjects.has(obj)) {
          translate(obj);
        }
      });

      if (activeSelection) {
        translate(activeSelection);
      }
    }

    canvas.setDimensions(size);
    canvas.requestRenderAll();
  }

  static centerCropImageData(source: ImageData, width: number, height: number): ImageData {
    const targetWidth = Math.max(1, Math.min(source.width, Math.floor(width)));
    const targetHeight = Math.max(1, Math.min(source.height, Math.floor(height)));

    if (targetWidth === source.width && targetHeight === source.height) {
      return source;
    }

    const sourceX = Math.floor((source.width - targetWidth) / 2);
    const sourceY = Math.floor((source.height - targetHeight) / 2);
    const result = new ImageData(targetWidth, targetHeight);
    const rowLength = targetWidth * 4;

    for (let y = 0; y < targetHeight; y++) {
      const sourceStart = ((sourceY + y) * source.width + sourceX) * 4;
      const targetStart = y * rowLength;
      result.data.set(source.data.subarray(sourceStart, sourceStart + rowLength), targetStart);
    }

    return result;
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
