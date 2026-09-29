import Konva from "konva";
import { code128b, ean13 } from "$/utils/barcode";
import { DesignerObject, type DesignerObjectData } from "$/konva-object/base";

const EAN13_LONG_BAR_INDEXES = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
export type BarcodeCoding = "EAN13" | "CODE128B";

const measureContext = document.createElement("canvas").getContext("2d")!;

export class Barcode extends DesignerObject {
  readonly shape: Konva.Shape;
  text = "";
  encoding: BarcodeCoding = "EAN13";
  printText = true;
  scaleFactor = 1;
  fontSize = 12;
  fontFamily = "Noto Sans Variable";

  private barcodeEncoded = "";
  private displayText = "";
  private error = false;

  constructor(options: Record<string, any> = {}) {
    super("Barcode", {
      width: 120,
      height: 64,
      strokeWidth: 0,
      fill: "black",
      ...options,
    });
    this.text = String(options.text ?? "123456789012");
    this.encoding = (options.encoding ?? "EAN13") as BarcodeCoding;
    this.printText = Boolean(options.printText ?? true);
    this.scaleFactor = Number(options.scaleFactor ?? 1);
    this.fontSize = Number(options.fontSize ?? 12);
    this.fontFamily = String(options.fontFamily ?? "Noto Sans Variable");

    this.shape = new Konva.Shape({
      x: 0,
      y: 0,
      listening: false,
      sceneFunc: (context) => this.draw(context),
    });
    this.node.add(this.shape);
    this.rebuild();
  }

  private rebuild(): void {
    try {
      this.error = false;
      if (this.encoding === "EAN13") {
        const result = ean13(this.text);
        this.displayText = result.text;
        this.barcodeEncoded = result.bandcode;
      } else {
        this.displayText = this.text;
        this.barcodeEncoded = code128b(this.text);
      }
    } catch {
      this.error = true;
      this.barcodeEncoded = "";
    }

    const width = Math.max(1, this.barcodeEncoded.length * this.scaleFactor + (this.encoding === "EAN13" ? this.measureLetterWidth() * 2 : 0));
    this.setSizeRaw(width, this.height);
    this.updateVisual();
  }

  private measureLetterWidth(): number {
    measureContext.font = `bold ${this.fontSize}px ${this.fontFamily}`;
    return Math.ceil(measureContext.measureText("0").width);
  }

  private draw(context: Konva.Context): void {
    const ctx = (context as any)._context as CanvasRenderingContext2D;
    if (this.error || !this.barcodeEncoded) {
      ctx.save();
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "16px Noto Sans Variable";
      ctx.fillText("ERR", this.width / 2, this.height / 2);
      ctx.restore();
      return;
    }

    const letterWidth = this.measureLetterWidth();
    const barcodeStartPos = this.encoding === "EAN13" ? letterWidth : 0;
    let shortBarHeight = this.height;
    if (this.printText) shortBarHeight -= this.fontSize * 1.2;
    else if (this.encoding === "EAN13") shortBarHeight -= 8;

    ctx.save();
    ctx.fillStyle = "black";
    ctx.font = `bold ${this.fontSize}px ${this.fontFamily}`;
    ctx.textBaseline = "bottom";

    let blackStart = -1;
    let blackCount = 0;
    let longBar = false;

    const flush = (x: number) => {
      if (blackStart < 0 || blackCount === 0) return;
      ctx.fillRect(blackStart, 0, x - blackStart, longBar ? this.height : shortBarHeight);
      blackStart = -1;
      blackCount = 0;
      longBar = false;
    };

    for (let i = 0; i < this.barcodeEncoded.length; i++) {
      const x = barcodeStartPos + i * this.scaleFactor;
      if (this.barcodeEncoded[i] === "1") {
        if (blackStart < 0) blackStart = x;
        blackCount++;
        if (this.encoding === "EAN13" && EAN13_LONG_BAR_INDEXES.has(i)) longBar = true;
      } else {
        flush(x);
      }
    }
    flush(barcodeStartPos + this.barcodeEncoded.length * this.scaleFactor);

    if (this.printText) {
      ctx.textAlign = "center";
      ctx.fillText(this.displayText, this.width / 2, this.height);
    }
    ctx.restore();
  }

  protected updateVisual(): void {
    if (!this.shape) return;
    if (this.shape.width() !== this.width || this.shape.height() !== this.height) {
      this.shape.size({ width: this.width, height: this.height });
    }
    this.shape.getLayer()?.batchDraw();
  }

  override set(key: string, value: unknown): this;
  override set(values: Record<string, unknown>): this;
  override set(keyOrValues: string | Record<string, unknown>, value?: unknown): this {
    super.set(keyOrValues as any, value as any);
    const keys = typeof keyOrValues === "string" ? [keyOrValues] : Object.keys(keyOrValues);
    if (keys.some((key) => ["text", "encoding", "printText", "scaleFactor", "fontSize", "fontFamily"].includes(key))) {
      this.rebuild();
    }
    return this;
  }

  override getTransformerConfig(): Record<string, unknown> {
    return {
      rotateEnabled: true,
      enabledAnchors: ["top-center", "bottom-center"],
      keepRatio: false,
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
    };
  }

  override toObject(): DesignerObjectData {
    return {
      ...super.toObject(),
      text: this.text,
      encoding: this.encoding,
      printText: this.printText,
      scaleFactor: this.scaleFactor,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
    };
  }

  async clone(): Promise<Barcode> {
    const data = this.toObject();
    delete data.id;
    return new Barcode(data);
  }
}

export default Barcode;
