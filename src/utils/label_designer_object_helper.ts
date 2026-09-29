import { OBJECT_DEFAULTS, OBJECT_DEFAULTS_TEXT, OBJECT_DEFAULTS_VECTOR, OBJECT_SIZE_DEFAULTS } from "$/defaults";
import { ArUcoMarker } from "$/fabric-object/aruco";
import Barcode from "$/fabric-object/barcode";
import { QRCode } from "$/fabric-object/qrcode";
import type { OjectType } from "$/types";
import { Toasts } from "$/utils/toasts";
import { FileUtils } from "$/utils/file_utils";
import { CanvasUtils } from "$/utils/canvas_utils";
import { TextboxExt, type TextboxExtProps } from "$/fabric-object/textbox-ext";
import { ImageObject } from "$/konva-object/image";
import { RectObject, CircleObject, LineObject } from "$/konva-object/shapes";
import type { DesignerObject } from "$/konva-object/base";
import { CustomCanvas } from "$/fabric-object/custom_canvas";

export class LabelDesignerObjectHelper {
  static async addSvg(canvas: CustomCanvas, svgCode: string): Promise<ImageObject> {
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgCode)}`;
    const obj = new ImageObject({ ...OBJECT_DEFAULTS });
    await obj.loadSource(src);
    CanvasUtils.fitObjectIntoCanvas(canvas, obj, OBJECT_DEFAULTS.left, OBJECT_DEFAULTS.top);
    canvas.add(obj);
    canvas.renderAll();
    return obj;
  }

  static async addImageFile(canvas: CustomCanvas, file: File): Promise<ImageObject> {
    const supported =
      file.type.startsWith("image/svg") ||
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/bmp" ||
      file.type === "image/gif";

    if (!supported) {
      throw new Error("Unsupported image");
    }

    const src = await FileUtils.blobToDataUrl(file);
    const obj = new ImageObject({ ...OBJECT_DEFAULTS });
    await obj.loadSource(src);
    CanvasUtils.fitObjectIntoCanvas(canvas, obj, OBJECT_DEFAULTS.left, OBJECT_DEFAULTS.top);
    canvas.add(obj);
    return obj;
  }

  static async addImageWithFilePicker(canvas: CustomCanvas): Promise<ImageObject> {
    const files = await FileUtils.pickFileAsync("*", false);
    try {
      return await this.addImageFile(canvas, files[0]);
    } catch (e) {
      Toasts.error(e);
      throw e;
    }
  }

  static async addImageBlob(canvas: CustomCanvas, img: Blob): Promise<ImageObject> {
    const src = await FileUtils.blobToDataUrl(img);
    const obj = new ImageObject({ left: 0, top: 0, snapAngle: OBJECT_DEFAULTS.snapAngle });
    await obj.loadSource(src);
    canvas.add(obj);
    return obj;
  }

  static async addImageElement(canvas: CustomCanvas, element: HTMLCanvasElement): Promise<ImageObject> {
    const obj = new ImageObject({ left: 0, top: 0, width: element.width, height: element.height });
    await obj.loadSource(element.toDataURL("image/png"));
    canvas.add(obj);
    return obj;
  }

  static async addObjectFromClipboard(canvas: CustomCanvas, data: DataTransfer): Promise<DesignerObject | undefined> {
    for (const item of data.items) {
      if (item.type.includes("image")) {
        const file = item.getAsFile();
        if (file) return await this.addImageFile(canvas, file);
      }
    }

    const text = data.getData("text");
    if (text) {
      const obj = this.addText(canvas, text);
      canvas.setActiveObject(obj);
      return obj;
    }
  }

  static addText(canvas: CustomCanvas, text?: string, options?: Partial<TextboxExtProps>): TextboxExt {
    const obj = new TextboxExt(text ?? "Text", { ...OBJECT_DEFAULTS_TEXT, ...options });
    canvas.add(obj);
    canvas.centerObject(obj);
    return obj;
  }

  static addStaticText(canvas: CustomCanvas, text?: string, options?: Record<string, any>): TextboxExt {
    return this.addText(canvas, text, options);
  }

  static addHLine(canvas: CustomCanvas): LineObject {
    const obj = new LineObject({ ...OBJECT_DEFAULTS_VECTOR, width: OBJECT_SIZE_DEFAULTS.width, height: 1 });
    canvas.add(obj);
    canvas.centerObjectV(obj);
    return obj;
  }

  static addCircle(canvas: CustomCanvas): CircleObject {
    const obj = new CircleObject({ ...OBJECT_DEFAULTS_VECTOR, ...OBJECT_SIZE_DEFAULTS });
    canvas.add(obj);
    canvas.centerObjectV(obj);
    return obj;
  }

  static addRect(canvas: CustomCanvas): RectObject {
    const obj = new RectObject({ ...OBJECT_SIZE_DEFAULTS, ...OBJECT_DEFAULTS_VECTOR });
    canvas.add(obj);
    canvas.centerObjectV(obj);
    return obj;
  }

  static addQrCode(canvas: CustomCanvas): QRCode {
    const qr = new QRCode({ text: "NiimBlue", ...OBJECT_SIZE_DEFAULTS, ...OBJECT_DEFAULTS });
    canvas.add(qr);
    return qr;
  }

  static addArUco(canvas: CustomCanvas): ArUcoMarker {
    const aruco = new ArUcoMarker({ ...OBJECT_SIZE_DEFAULTS, ...OBJECT_DEFAULTS });
    canvas.add(aruco);
    return aruco;
  }

  static addBarcode(canvas: CustomCanvas): Barcode {
    const barcode = new Barcode({
      ...OBJECT_DEFAULTS,
      text: "123456789012",
      height: OBJECT_SIZE_DEFAULTS.height,
      encoding: "CODE128B",
    });
    canvas.add(barcode);
    return barcode;
  }

  static addObject(canvas: CustomCanvas, objType: OjectType): DesignerObject | undefined {
    switch (objType) {
      case "text":
        return this.addText(canvas);
      case "line":
        return this.addHLine(canvas);
      case "circle":
        return this.addCircle(canvas);
      case "rectangle":
        return this.addRect(canvas);
      case "image":
        void this.addImageWithFilePicker(canvas).then((obj) => canvas.setActiveObject(obj));
        return;
      case "qrcode":
        return this.addQrCode(canvas);
      case "aruco":
        return this.addArUco(canvas);
      case "barcode":
        return this.addBarcode(canvas);
    }
  }
}
