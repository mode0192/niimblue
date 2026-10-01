import * as fabric from "fabric";

interface UniqueTextboxExtProps {
  fontAutoSize: boolean;
}

const TEXTBOX_PROPS: Array<keyof UniqueTextboxExtProps> = ["fontAutoSize"];

const RTL_STRONG_CHAR_RE = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
const LETTER_RE = /\p{Letter}/u;

const detectTextDirection = (text: string): "ltr" | "rtl" | undefined => {
  for (const char of text) {
    if (RTL_STRONG_CHAR_RE.test(char)) {
      return "rtl";
    }
    if (LETTER_RE.test(char)) {
      return "ltr";
    }
  }
};

export const textboxExtDefaultValues: Partial<fabric.TClassProperties<TextboxExt>> = {
  fontAutoSize: false,
};

export interface TextboxExtProps extends fabric.TextboxProps, UniqueTextboxExtProps {}
export interface SerializedTextboxExtProps extends fabric.SerializedTextboxProps, UniqueTextboxExtProps {}

export class TextboxExt<
    Props extends fabric.TOptions<TextboxExtProps> = Partial<TextboxExtProps>,
    SProps extends SerializedTextboxExtProps = SerializedTextboxExtProps,
    EventSpec extends fabric.ITextEvents = fabric.ITextEvents,
  >
  extends fabric.Textbox<Props, SProps, EventSpec>
  implements UniqueTextboxExtProps
{
  declare fontAutoSize: boolean;

  private widthBeforeEditing?: number;

  constructor(text: string, options?: Props) {
    super(text, options);
    Object.assign(this, textboxExtDefaultValues);
    this.setOptions(options);
    this.syncTextDirection();

    this.setControlsVisibility({
      mb: false,
      mt: false,
    });
  }

  private syncTextDirection(): boolean {
    const direction = detectTextDirection(this.text);
    const changed = direction !== undefined && direction !== this.direction;

    if (changed) {
      this.set({ direction });
      this._clearCache();
    }

    if (this.hiddenTextarea) {
      this.hiddenTextarea.dir = this.direction;
    }

    return changed;
  }

  /**
   * Measure an unstyled RTL line as one fully shaped browser run and feed those
   * insertion advances back into Fabric's own character geometry.
   *
   * This lets Fabric's native caret and selection code consume the corrected
   * geometry instead of maintaining a second editing-geometry system.
   */
  override _measureLine(lineIndex: number) {
    const result = super._measureLine(lineIndex);

    if (
      this.direction !== "rtl" ||
      this.path ||
      this.charSpacing !== 0 ||
      !this.isEmptyStyles(lineIndex) ||
      typeof document === "undefined" ||
      !document.body
    ) {
      return result;
    }

    const line = this._textLines[lineIndex];
    if (!line?.length) {
      return result;
    }

    const span = document.createElement("span");
    span.dir = "rtl";
    span.style.cssText =
      "position:fixed;left:-100000px;top:0;display:inline-block;margin:0;padding:0;border:0;" +
      "white-space:pre;direction:rtl;unicode-bidi:isolate;visibility:hidden;pointer-events:none;";
    span.style.font = this._getFontDeclaration(this.getCompleteStyleDeclaration(lineIndex, 0));
    span.style.fontKerning = "normal";
    span.style.fontVariantLigatures = "normal";
    span.style.letterSpacing = "0px";
    span.textContent = line.join("");

    document.body.appendChild(span);

    try {
      const node = span.firstChild;
      if (!node) {
        return result;
      }

      const lineRect = span.getBoundingClientRect();
      if (!Number.isFinite(lineRect.width) || lineRect.width <= 0) {
        return result;
      }

      const range = document.createRange();
      const boundaries = [0];
      let codeUnitOffset = 0;

      for (let i = 0; i < line.length - 1; i++) {
        codeUnitOffset += line[i].length;
        range.setStart(node, 0);
        range.setEnd(node, codeUnitOffset);

        const rect = range.getBoundingClientRect();
        const boundary = Math.max(0, Math.min(lineRect.width, lineRect.right - rect.left));

        // Fabric's current char-bound model requires logical RTL advances to be
        // monotonic. Mixed BiDi runs that violate that assumption fall back.
        if (boundary < boundaries[boundaries.length - 1]) {
          return result;
        }

        boundaries.push(boundary);
      }

      boundaries.push(lineRect.width);

      const boxes = this.__charBounds[lineIndex];
      for (let i = 0; i < line.length; i++) {
        const left = boundaries[i];
        const advance = boundaries[i + 1] - left;

        boxes[i].left = left;
        boxes[i].width = advance;
        boxes[i].kernedWidth = advance;
      }

      boxes[line.length].left = lineRect.width;
      result.width = lineRect.width;

      return result;
    } finally {
      span.remove();
    }
  }

  /** Set text and reduce fontSize until text fits to the given width */
  setAndShrinkText(text: string, maxWidth: number, maxLines?: number) {
    const linesLimit = maxLines ?? this._splitTextIntoLines(this.text).lines.length;

    let linesCount = this._splitTextIntoLines(text).lines.length;

    this.set({ text });
    this.syncTextDirection();

    while ((linesCount > linesLimit || this.width > maxWidth) && this.fontSize > 2) {
      this.fontSize -= 1;
      this.set({ text, width: maxWidth });
      linesCount = this._splitTextIntoLines(text).lines.length;
    }
  }

  /** Reduce fontSize until text fits to the given width */
  shrinkText(maxWidth: number, maxLines: number) {
    let linesCount = this._splitTextIntoLines(this.text).lines.length;

    while ((linesCount > maxLines || this.width > maxWidth) && this.fontSize > 2) {
      this.fontSize -= 1;
      this.set({ width: maxWidth });
      linesCount = this._splitTextIntoLines(this.text).lines.length;
    }
  }

  override enterEditingImpl() {
    this.syncTextDirection();
    super.enterEditingImpl();
    this.syncTextDirection();
    this.widthBeforeEditing = this.width;
  }

  override exitEditingImpl() {
    super.exitEditingImpl();
    this.widthBeforeEditing = undefined;
  }

  override updateFromTextArea(): void {
    super.updateFromTextArea();

    if (this.syncTextDirection()) {
      this.canvas?.requestRenderAll();
    }

    if (this.widthBeforeEditing !== undefined && this.fontAutoSize) {
      const lines = this.text.split("\n").length;
      this.shrinkText(this.widthBeforeEditing, lines);
    }
  }

  /**
   * Backport Fabric.js #10993: compare an RTL pointer in the same coordinate
   * space as the line's character advances.
   */
  override getSelectionStartFromPointer(e: fabric.TPointerEvent): number {
    if (this.direction !== "rtl") {
      return super.getSelectionStartFromPointer(e);
    }

    const mouseOffset = this.canvas!
      .getScenePoint(e)
      .transform(fabric.util.invertTransform(this.calcTransformMatrix()))
      .add(new fabric.Point(-this._getLeftOffset(), -this._getTopOffset()));

    let height = 0;
    let charIndex = 0;
    let lineIndex = 0;

    for (let i = 0; i < this._textLines.length; i++) {
      if (height <= mouseOffset.y) {
        height += this.getHeightOfLine(i);
        lineIndex = i;
        if (i > 0) {
          charIndex += this._textLines[i - 1].length + this.missingNewlineOffset(i - 1);
        }
      } else {
        break;
      }
    }

    const lineLeftOffset = this._getLineLeftOffset(lineIndex);
    const chars = this.__charBounds[lineIndex];
    const charLength = this._textLines[lineIndex].length;
    const effectiveX = lineLeftOffset - mouseOffset.x;
    let width = 0;

    for (let i = 0; i < charLength; i++) {
      const widthAfter = width + chars[i].kernedWidth;

      if (effectiveX <= widthAfter) {
        if (Math.abs(effectiveX - widthAfter) <= Math.abs(effectiveX - width)) {
          charIndex++;
        }
        break;
      }

      width = widthAfter;
      charIndex++;
    }

    return Math.min(this.flipX ? charLength - charIndex : charIndex, this._text.length);
  }

  override toObject<T extends Omit<Props & fabric.TClassProperties<this>, keyof SProps>, K extends keyof T = never>(
    propertiesToInclude: K[] = [],
  ): Pick<T, K> & SProps {
    return super.toObject([...propertiesToInclude, ...TEXTBOX_PROPS] as (keyof T)[]);
  }
}
