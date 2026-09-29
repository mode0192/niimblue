import type { DesignerObject, DesignerObjectData } from "$/konva-object/base";
import { RectObject, CircleObject, LineObject, UnsupportedObject } from "$/konva-object/shapes";
import { TextboxObject } from "$/konva-object/textbox";
import { ImageObject } from "$/konva-object/image";
import { QRCode } from "$/konva-object/qrcode";
import { Barcode } from "$/konva-object/barcode";
import { ArUcoMarker } from "$/konva-object/aruco";

const normalizeLegacyType = (type: unknown): string => String(type ?? "").toLowerCase();

export const createObjectFromData = async (raw: Record<string, any>): Promise<DesignerObject> => {
  const legacyType = normalizeLegacyType(raw.type);

  if (legacyType === "textbox" || legacyType === "i-text" || legacyType === "itext" || legacyType === "text") {
    return new TextboxObject(String(raw.text ?? "Text"), raw);
  }
  if (legacyType === "rect") {
    return new RectObject(raw);
  }
  if (legacyType === "circle") {
    return new CircleObject(raw);
  }
  if (legacyType === "line" || legacyType === "polyline") {
    const points = Array.isArray(raw.points) ? raw.points : undefined;
    const options = { ...raw };
    if (points?.length >= 2) {
      const xs = points.map((p: any) => Number(p.x ?? 0));
      const ys = points.map((p: any) => Number(p.y ?? 0));
      options.width = Math.max(1, Math.max(...xs) - Math.min(...xs));
      options.height = Math.max(1, Math.max(...ys) - Math.min(...ys));
    } else if (raw.x1 !== undefined && raw.x2 !== undefined) {
      options.width = Math.max(1, Math.abs(Number(raw.x2) - Number(raw.x1)));
      options.height = Math.max(1, Math.abs(Number(raw.y2) - Number(raw.y1)));
    }
    return new LineObject(options);
  }
  if (legacyType === "image") {
    const image = new ImageObject(raw);
    const src = String(raw.src ?? raw.data ?? "");
    if (src) await image.loadSource(src);
    return image;
  }
  if (legacyType === "qrcode") {
    return new QRCode(raw);
  }
  if (legacyType === "barcode") {
    return new Barcode(raw);
  }
  if (legacyType === "arucomarker" || legacyType === "aruco") {
    return new ArUcoMarker(raw);
  }

  return new UnsupportedObject(String(raw.type ?? "unknown"), raw);
};

export const serializeObject = (object: DesignerObject): DesignerObjectData => object.toObject();
