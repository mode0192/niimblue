import Konva from "konva";
import { DesignerObject, type DesignerObjectData } from "$/konva-object/base";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });

export class ImageObject extends DesignerObject {
  readonly imageNode: Konva.Image;
  src = "";
  private image?: HTMLImageElement;
  private readonly useNaturalSize: boolean;

  constructor(options: Record<string, any> = {}) {
    const hasExplicitSize = options.width !== undefined || options.height !== undefined;
    super("Image", {
      width: 64,
      height: 64,
      strokeWidth: 0,
      fill: "transparent",
      ...options,
    });
    this.useNaturalSize = !hasExplicitSize;
    this.src = String(options.src ?? options.data ?? "");
    this.imageNode = new Konva.Image({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      listening: false,
    });
    this.node.add(this.imageNode);
    this.updateVisual();

    if (this.src) {
      void this.loadSource(this.src);
    }
  }

  async loadSource(src: string): Promise<void> {
    this.src = src;
    this.image = await loadImage(src);
    this.imageNode.image(this.image);
    if (this.useNaturalSize) {
      this.setSizeRaw(this.image.naturalWidth || 64, this.image.naturalHeight || 64);
    }
    this.updateVisual();
    this.canvas?.requestRenderAll();
  }

  protected updateVisual(): void {
    if (!this.imageNode) return;
    this.imageNode.setAttrs({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      image: this.image,
    });
  }

  override getTransformerConfig(): Record<string, unknown> {
    return {
      rotateEnabled: true,
      enabledAnchors: [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "top-center",
        "bottom-center",
        "middle-left",
        "middle-right",
      ],
      keepRatio: false,
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 5,
    };
  }

  override toObject(): DesignerObjectData {
    return { ...super.toObject(), src: this.src };
  }

  async clone(): Promise<ImageObject> {
    const data = this.toObject();
    delete data.id;
    const clone = new ImageObject(data);
    if (this.src) await clone.loadSource(this.src);
    return clone;
  }
}
