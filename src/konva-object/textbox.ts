import Konva from "konva";
import { DesignerObject, type DesignerObjectData, type OriginY } from "$/konva-object/base";

const RTL_STRONG_CHAR_RE = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
const LETTER_RE = /\p{Letter}/u;

const detectDirection = (text: string): "ltr" | "rtl" => {
  for (const char of text) {
    if (RTL_STRONG_CHAR_RE.test(char)) return "rtl";
    if (LETTER_RE.test(char)) return "ltr";
  }
  return "ltr";
};

export class TextboxObject extends DesignerObject {
  readonly textNode: Konva.Text;

  text = "Text";
  fontFamily = "Noto Sans Variable";
  fontSize = 40;
  fontWeight: string | number = "normal";
  fontStyle = "normal";
  textAlign: "left" | "center" | "right" = "center";
  lineHeight = 1;
  backgroundColor = "transparent";
  fontAutoSize = false;
  splitByGrapheme = false;
  direction: "ltr" | "rtl" = "ltr";
  isEditing = false;

  private textarea?: HTMLTextAreaElement;

  constructor(text = "Text", options: Record<string, any> = {}) {
    super("Textbox", {
      width: 160,
      height: 56,
      fill: "black",
      stroke: "transparent",
      strokeWidth: 0,
      originX: "center",
      originY: "center",
      ...options,
    });

    this.text = String(options.text ?? text);
    this.fontFamily = String(options.fontFamily ?? "Noto Sans Variable");
    this.fontSize = Number(options.fontSize ?? 40);
    this.fontWeight = options.fontWeight ?? "normal";
    this.fontStyle = String(options.fontStyle ?? "normal");
    this.textAlign = (options.textAlign ?? options.align ?? "center") as "left" | "center" | "right";
    this.lineHeight = Number(options.lineHeight ?? 1);
    this.backgroundColor = String(options.backgroundColor ?? "transparent");
    this.fontAutoSize = Boolean(options.fontAutoSize ?? false);
    this.splitByGrapheme = Boolean(options.splitByGrapheme ?? false);
    this.direction = (options.direction ?? detectDirection(this.text)) as "ltr" | "rtl";
    this.originY = (options.originY ?? "center") as OriginY;

    this.textNode = new Konva.Text({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      listening: false,
      wrap: this.splitByGrapheme ? "char" : "word",
    });
    this.node.add(this.textNode);
    this.updateVisual();

    this.node.on("dblclick dbltap", () => this.enterEditing());
  }

  protected updateVisual(): void {
    if (!this.textNode) return;

    this.direction = detectDirection(this.text);

    this.textNode.setAttrs({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      text: this.text,
      fill: this.fill,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontStyle: [this.fontStyle, this.fontWeight === "bold" || Number(this.fontWeight) >= 600 ? "bold" : ""]
        .filter(Boolean)
        .join(" "),
      align: this.textAlign,
      // Fabric's originY controls object positioning, not text layout.
      // Keep text at the top of its box; the DOM textarea uses the same geometry.
      verticalAlign: "top",
      lineHeight: this.lineHeight,
      wrap: this.splitByGrapheme ? "char" : "word",
      direction: this.direction,
      padding: 0,
    });
  }

  override set(key: string, value: unknown): this;
  override set(values: Record<string, unknown>): this;
  override set(keyOrValues: string | Record<string, unknown>, value?: unknown): this {
    super.set(keyOrValues as any, value as any);
    if (typeof keyOrValues === "string" && keyOrValues === "text") {
      this.direction = detectDirection(this.text);
    }
    if (typeof keyOrValues !== "string" && "text" in keyOrValues) {
      this.direction = detectDirection(this.text);
    }
    this.updateVisual();
    return this;
  }

  setAndShrinkText(text: string, maxWidth: number, maxLines?: number): void {
    this.text = text;
    this.direction = detectDirection(text);

    if (!this.fontAutoSize) {
      this.updateVisual();
      return;
    }

    const originalSize = this.fontSize;
    const lineLimit = maxLines ?? Math.max(1, this.text.split("\n").length);

    while (this.fontSize > 2) {
      this.updateVisual();
      const measuredHeight = this.textNode.height();
      const approxLines = Math.max(1, Math.ceil(measuredHeight / Math.max(1, this.fontSize * this.lineHeight)));
      if (this.textNode.getTextWidth() <= maxWidth && approxLines <= lineLimit) {
        break;
      }
      this.fontSize--;
    }

    if (this.fontSize <= 2 && originalSize > 2) {
      this.updateVisual();
    }
  }

  exitEditing(): void {
    this.finishEditing(true);
  }

  enterEditing(): void {
    if (this.isEditing || !this.canvas) return;

    const stage = this.canvas.stage;
    const stageRect = stage.content.getBoundingClientRect();
    const textPosition = this.textNode.absolutePosition();
    const absoluteScale = this.textNode.getAbsoluteScale();
    const cssScaleX = stageRect.width / Math.max(1, stage.width());
    const cssScaleY = stageRect.height / Math.max(1, stage.height());
    const screenScaleX = Math.abs(absoluteScale.x) * cssScaleX;
    const screenScaleY = Math.abs(absoluteScale.y) * cssScaleY;
    const rotation = this.textNode.getAbsoluteRotation();

    this.isEditing = true;
    this.node.visible(false);
    this.canvas.transformer.visible(false);
    this.canvas.overlayLayer.batchDraw();

    const textarea = document.createElement("textarea");
    this.textarea = textarea;
    textarea.value = this.text;
    textarea.dir = this.direction;
    textarea.spellcheck = false;
    textarea.wrap = this.splitByGrapheme ? "off" : "soft";

    textarea.style.position = "fixed";
    textarea.style.left = `${stageRect.left + textPosition.x * cssScaleX}px`;
    textarea.style.top = `${stageRect.top + textPosition.y * cssScaleY}px`;
    textarea.style.width = `${Math.max(24, this.textNode.width() * screenScaleX)}px`;
    textarea.style.height = `${Math.max(24, this.textNode.height() * screenScaleY)}px`;
    textarea.style.boxSizing = "border-box";
    textarea.style.padding = "0";
    textarea.style.margin = "0";
    textarea.style.border = "none";
    textarea.style.outline = "1px solid #0d6efd";
    textarea.style.outlineOffset = "0";
    textarea.style.resize = "none";
    textarea.style.overflow = "hidden";
    textarea.style.background =
      this.backgroundColor === "transparent" ? "transparent" : this.backgroundColor;
    textarea.style.color = this.fill;
    textarea.style.caretColor = this.fill;
    textarea.style.fontFamily = this.fontFamily;
    textarea.style.fontSize = `${this.fontSize * screenScaleY}px`;
    textarea.style.fontWeight = String(this.fontWeight);
    textarea.style.fontStyle = this.fontStyle;
    textarea.style.lineHeight = String(this.lineHeight);
    textarea.style.textAlign = this.textAlign;
    textarea.style.transformOrigin = "left top";
    textarea.style.transform = `rotate(${rotation}deg)`;
    textarea.style.zIndex = "10000";

    const update = () => {
      this.text = textarea.value;
      this.direction = detectDirection(this.text);
      textarea.dir = this.direction;
      this.updateVisual();
      this.canvas?.requestRenderAll();
      this.canvas?.emitTextChanged(this);
    };

    textarea.addEventListener("input", update);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.finishEditing(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.finishEditing(true);
      }
      e.stopPropagation();
    });
    textarea.addEventListener("blur", () => this.finishEditing(true), { once: true });

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  private finishEditing(commit: boolean): void {
    if (!this.isEditing) return;

    if (commit && this.textarea) {
      this.text = this.textarea.value;
      this.direction = detectDirection(this.text);
    }

    this.textarea?.remove();
    this.textarea = undefined;
    this.isEditing = false;
    this.node.visible(true);
    this.updateVisual();
    if (this.canvas) {
      this.canvas.transformer.visible(true);
      this.canvas.updateTransformer();
    }
    this.canvas?.requestRenderAll();
    this.emitModified({ action: "text" });
  }

  override getTransformerConfig(): Record<string, unknown> {
    return {
      rotateEnabled: true,
      enabledAnchors: ["middle-left", "middle-right", "top-left", "top-right", "bottom-left", "bottom-right"],
      keepRatio: false,
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
    };
  }

  override toObject(): DesignerObjectData {
    return {
      ...super.toObject(),
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      textAlign: this.textAlign,
      lineHeight: this.lineHeight,
      backgroundColor: this.backgroundColor,
      fontAutoSize: this.fontAutoSize,
      splitByGrapheme: this.splitByGrapheme,
      direction: this.direction,
    };
  }

  async clone(): Promise<TextboxObject> {
    const data = this.toObject();
    delete data.id;
    return new TextboxObject(this.text, data);
  }

  destroy(): void {
    this.textarea?.remove();
    this.node.destroy();
  }
}

export class StaticTextObject extends TextboxObject {
  constructor(text = "Text", options: Record<string, any> = {}) {
    super(text, options);
  }
}
