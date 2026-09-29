import Konva from "konva";
import QRCodeFactory from "qrcode-generator";
import { stringToBytes } from "$/utils/qrcode";
import { DesignerObject, type DesignerObjectData } from "$/konva-object/base";
import type { Range } from "$/types";

QRCodeFactory.stringToBytes = stringToBytes;

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type Mode = "Numeric" | "Alphanumeric" | "Byte" | "Kanji";
export type QrVersion = Range<41>;

export class QRCode extends DesignerObject {
  readonly shape: Konva.Shape;
  text = "Text";
  ecl: ErrorCorrectionLevel = "M";
  mode: Mode = "Byte";
  qrVersion: QrVersion = 0;

  constructor(options: Record<string, any> = {}) {
    super("QRCode", {
      width: 64,
      height: 64,
      stroke: "#000000",
      fill: "#ffffff",
      ...options,
    });
    this.text = String(options.text ?? "Text");
    this.ecl = (options.ecl ?? "M") as ErrorCorrectionLevel;
    this.mode = (options.mode ?? "Byte") as Mode;
    this.qrVersion = Number(options.qrVersion ?? 0) as QrVersion;

    this.shape = new Konva.Shape({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      listening: false,
      sceneFunc: (context) => this.draw(context),
    });
    this.node.add(this.shape);
    this.updateVisual();
  }

  private draw(context: Konva.Context): void {
    const ctx = (context as any)._context as CanvasRenderingContext2D;
    const qr = QRCodeFactory(this.qrVersion, this.ecl);

    try {
      qr.addData(this.text, this.mode);
      qr.make();
    } catch {
      this.drawError(ctx);
      return;
    }

    const moduleCount = qr.getModuleCount();
    const qrScale = Math.floor(Math.min(this.width, this.height) / moduleCount);
    const qrWidth = qrScale * moduleCount;

    if (qrScale < 1) {
      this.drawError(ctx);
      return;
    }

    const offsetX = Math.floor((this.width - qrWidth) / 2);
    const offsetY = Math.floor((this.height - qrWidth) / 2);
    ctx.save();
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "black";
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(offsetX + col * qrScale, offsetY + row * qrScale, qrScale, qrScale);
        }
      }
    }
    ctx.restore();
  }

  private drawError(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "16px Noto Sans Variable";
    ctx.fillText("ERR", this.width / 2, this.height / 2);
    ctx.restore();
  }

  protected updateVisual(): void {
    if (!this.shape) return;
    this.shape.size({ width: this.width, height: this.height });
    this.shape.getLayer()?.batchDraw();
  }

  override getTransformerConfig(): Record<string, unknown> {
    return {
      rotateEnabled: true,
      enabledAnchors: ["bottom-right"],
      keepRatio: true,
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
    };
  }

  override normalizeAfterTransform(action = "scale"): void {
    super.normalizeAfterTransform(action);
    const size = Math.max(42, Math.round(Math.max(this.width, this.height)));
    this.width = size + (size % 2);
    this.height = this.width;
    this.updateVisual();
  }

  override toObject(): DesignerObjectData {
    return {
      ...super.toObject(),
      text: this.text,
      ecl: this.ecl,
      mode: this.mode,
      qrVersion: this.qrVersion,
    };
  }

  async clone(): Promise<QRCode> {
    const data = this.toObject();
    delete data.id;
    return new QRCode(data);
  }
}

export default QRCode;
