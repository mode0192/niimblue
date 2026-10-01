import * as fabric from "fabric";

interface UniqueTextboxExtProps {
  fontAutoSize: boolean;
}

interface ShapedLineGeometry {
  signature: string;
  boundaries: number[];
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
  private shapedLineCache = new Map<number, ShapedLineGeometry>();

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

  /**
   * Follow the first strong letter so Arabic/Hebrew text edits as RTL while
   * ordinary Latin text remains LTR. Numbers and punctuation alone keep the
   * current direction.
   */
  private syncTextDirection(): boolean {
    const direction = detectTextDirection(this.text);
    const changed = direction !== undefined && direction !== this.direction;

    if (changed) {
      this.set({ direction });
      this.shapedLineCache.clear();
    }

    if (this.hiddenTextarea) {
      this.hiddenTextarea.dir = this.direction;
    }

    return changed;
  }

  /**
   * Return insertion boundaries measured from the fully shaped browser text.
   *
   * Fabric 7.4.0 measures graphemes individually/pairwise, while its fast text
   * render path paints an unstyled line as one shaped run. Arabic contextual
   * shaping can therefore make __charBounds disagree with the rendered glyphs.
   */
  private getShapedLineGeometry(lineIndex: number): ShapedLineGeometry | undefined {
    if (
      this.direction !== "rtl" ||
      this.path ||
      this.charSpacing !== 0 ||
      !this.isEmptyStyles(lineIndex) ||
      typeof document === "undefined" ||
      !document.body
    ) {
      return;
    }

    const line = this._textLines[lineIndex];
    if (!line || line.length === 0) {
      return;
    }

    const style = this.getCompleteStyleDeclaration(lineIndex, 0);
    const font = this._getFontDeclaration(style);
    const text = line.join("");
    const signature = `${text}\u0000${font}\u0000${this.direction}`;

    const cached = this.shapedLineCache.get(lineIndex);
    if (cached?.signature === signature) {
      return cached;
    }

    const span = document.createElement("span");
    span.dir = "rtl";
    span.style.position = "fixed";
    span.style.left = "-100000px";
    span.style.top = "0";
    span.style.display = "inline-block";
    span.style.margin = "0";
    span.style.padding = "0";
    span.style.border = "0";
    span.style.whiteSpace = "pre";
    span.style.direction = "rtl";
    span.style.unicodeBidi = "isolate";
    span.style.pointerEvents = "none";
    span.style.opacity = "0";
    span.style.font = font;
    span.style.fontKerning = "normal";
    span.style.fontVariantLigatures = "normal";
    span.style.letterSpacing = "0px";
    span.textContent = text;

    document.body.appendChild(span);

    try {
      const node = span.firstChild;
      if (!node) {
        return;
      }

      const lineRect = span.getBoundingClientRect();
      if (!Number.isFinite(lineRect.width) || lineRect.width <= 0) {
        return;
      }

      const codeUnitOffsets = [0];
      let codeUnitOffset = 0;

      for (const grapheme of line) {
        codeUnitOffset += grapheme.length;
        codeUnitOffsets.push(codeUnitOffset);
      }

      const range = document.createRange();
      const boundaries = codeUnitOffsets.map((offset, index) => {
        if (index === 0) {
          return 0;
        }
        if (index === codeUnitOffsets.length - 1) {
          return lineRect.width;
        }

        /*
         * Measure the logical prefix without changing the text node. The full
         * Arabic line therefore remains contextually shaped while Range gives
         * the visual boundary after this grapheme.
         */
        range.setStart(node, 0);
        range.setEnd(node, offset);

        const rect = range.getBoundingClientRect();
        const distanceFromRight = lineRect.right - rect.left;

        return Math.max(0, Math.min(lineRect.width, distanceFromRight));
      });

      const geometry = {
        signature,
        boundaries,
      };

      this.shapedLineCache.set(lineIndex, geometry);
      return geometry;
    } finally {
      span.remove();
    }
  }

  /**
   * Convert a shaped boundary (distance from an RTL line's visual right edge)
   * into Fabric's cursor leftOffset coordinate.
   */
  private getShapedCursorLeftOffset(lineIndex: number, charIndex: number): number | undefined {
    const shapedOffset = this.getShapedLineGeometry(lineIndex)?.boundaries[charIndex];

    if (shapedOffset === undefined) {
      return;
    }

    const lineLeftOffset = this._getLineLeftOffset(lineIndex);

    if (this.textAlign === "right" || this.textAlign === "justify" || this.textAlign === "justify-right") {
      return -(lineLeftOffset + shapedOffset);
    }

    return lineLeftOffset - shapedOffset;
  }

  private getShapedCursorX(lineIndex: number, charIndex: number): number | undefined {
    const leftOffset = this.getShapedCursorLeftOffset(lineIndex, charIndex);
    return leftOffset === undefined ? undefined : this._getLeftOffset() + leftOffset;
  }

  /** Set text and reduce fontSize until text fits to the given width */
  setAndShrinkText(text: string, maxWidth: number, maxLines?: number) {
    const linesLimit = maxLines ?? this._splitTextIntoLines(this.text).lines.length;

    let linesCount = this._splitTextIntoLines(text).lines.length;

    this.set({ text });
    this.shapedLineCache.clear();
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

    this.shapedLineCache.clear();

    if (this.syncTextDirection()) {
      this.canvas?.requestRenderAll();
    }

    if (this.widthBeforeEditing !== undefined && this.fontAutoSize) {
      const lines = this.text.split("\n").length;
      this.shrinkText(this.widthBeforeEditing, lines);
    }
  }

  /**
   * Put the visible caret on the same browser-shaped boundary map used by
   * pointer hit-testing and selection rendering.
   */
  override _getCursorBoundaries(index: number = this.selectionStart, skipCaching?: boolean) {
    const boundaries = super._getCursorBoundaries(index, skipCaching);

    if (this.direction !== "rtl") {
      return boundaries;
    }

    const location = this.get2DCursorLocation(index);
    const shapedLeftOffset = this.getShapedCursorLeftOffset(location.lineIndex, location.charIndex);

    if (shapedLeftOffset !== undefined) {
      boundaries.leftOffset = shapedLeftOffset;
    }

    return boundaries;
  }

  /**
   * Backport Fabric.js #10993 for RTL pointer coordinates, then choose the
   * nearest fully shaped browser boundary when that geometry is available.
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
    let lineIndex = 0;
    let lineStart = 0;

    for (let i = 0; i < this._textLines.length; i++) {
      if (height <= mouseOffset.y) {
        height += this.getHeightOfLine(i);
        lineIndex = i;

        if (i > 0) {
          lineStart += this._textLines[i - 1].length + this.missingNewlineOffset(i - 1);
        }
      } else {
        break;
      }
    }

    const line = this._textLines[lineIndex];
    const charLength = line.length;
    const lineLeftOffset = this._getLineLeftOffset(lineIndex);
    const effectiveX = lineLeftOffset - mouseOffset.x;
    const shaped = this.getShapedLineGeometry(lineIndex);

    let localIndex = 0;

    if (shaped) {
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i <= charLength; i++) {
        const distance = Math.abs(effectiveX - shaped.boundaries[i]);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          localIndex = i;
        }
      }
    } else {
      // Fabric.js #10993 behavior when browser-shaped geometry is unavailable.
      const chars = this.__charBounds[lineIndex];
      let width = 0;

      for (let i = 0; i < charLength; i++) {
        const widthAfter = width + chars[i].kernedWidth;

        if (effectiveX <= widthAfter) {
          if (Math.abs(effectiveX - widthAfter) <= Math.abs(effectiveX - width)) {
            localIndex++;
          }
          break;
        }

        width = widthAfter;
        localIndex++;
      }
    }

    const resolvedLocalIndex = this.flipX ? charLength - localIndex : localIndex;
    return Math.min(lineStart + resolvedLocalIndex, this._text.length);
  }

  /**
   * Render RTL selection from the same shaped insertion boundaries. This keeps
   * selection, caret and pointer hit-testing on one canonical geometry.
   */
  override _renderSelection(
    ctx: CanvasRenderingContext2D,
    selection: { selectionStart: number; selectionEnd: number },
    boundaries: { left: number; top: number; leftOffset: number; topOffset: number },
  ): void {
    if (this.direction !== "rtl") {
      super._renderSelection(ctx, selection, boundaries);
      return;
    }

    const selectionStart = Math.min(selection.selectionStart, selection.selectionEnd);
    const selectionEnd = Math.max(selection.selectionStart, selection.selectionEnd);

    if (selectionStart === selectionEnd) {
      return;
    }

    const start = this.get2DCursorLocation(selectionStart);
    const end = this.get2DCursorLocation(selectionEnd);

    // Fall back as one unit if any selected line cannot use shaped geometry.
    for (let lineIndex = start.lineIndex; lineIndex <= end.lineIndex; lineIndex++) {
      const line = this._textLines[lineIndex];
      const startChar = lineIndex === start.lineIndex ? start.charIndex : 0;
      const endChar = lineIndex === end.lineIndex ? end.charIndex : line.length;

      if (
        this.getShapedCursorX(lineIndex, startChar) === undefined ||
        this.getShapedCursorX(lineIndex, endChar) === undefined
      ) {
        super._renderSelection(ctx, selection, boundaries);
        return;
      }
    }

    let lineTop = this._getTopOffset();

    for (let i = 0; i < start.lineIndex; i++) {
      lineTop += this.getHeightOfLine(i);
    }

    for (let lineIndex = start.lineIndex; lineIndex <= end.lineIndex; lineIndex++) {
      const line = this._textLines[lineIndex];
      const startChar = lineIndex === start.lineIndex ? start.charIndex : 0;
      const endChar = lineIndex === end.lineIndex ? end.charIndex : line.length;

      const startX = this.getShapedCursorX(lineIndex, startChar)!;
      const endX = this.getShapedCursorX(lineIndex, endChar)!;

      let lineHeight = this.getHeightOfLine(lineIndex);
      let drawHeight = lineHeight;
      let extraTop = 0;

      if (this.lineHeight < 1 || (lineIndex === end.lineIndex && this.lineHeight > 1)) {
        lineHeight /= this.lineHeight;
        drawHeight = lineHeight;
      }

      if (this.inCompositionMode) {
        ctx.fillStyle = this.compositionColor || "black";
        drawHeight = 1;
        extraTop = lineHeight;
      } else {
        ctx.fillStyle = this.selectionColor;
      }

      ctx.fillRect(Math.min(startX, endX), lineTop + extraTop, Math.abs(endX - startX), drawHeight);
      lineTop += this.getHeightOfLine(lineIndex);
    }
  }

  override toObject<T extends Omit<Props & fabric.TClassProperties<this>, keyof SProps>, K extends keyof T = never>(
    propertiesToInclude: K[] = [],
  ): Pick<T, K> & SProps {
    return super.toObject([...propertiesToInclude, ...TEXTBOX_PROPS] as (keyof T)[]);
  }
}
