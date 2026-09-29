import { DesignerObject } from "$/konva-object/base";
import { CustomCanvas } from "$/konva-object/custom_canvas";
import { TextboxObject } from "$/konva-object/textbox";
import { ImageObject } from "$/konva-object/image";
import { RectObject, CircleObject, LineObject } from "$/konva-object/shapes";

export { DesignerObject as FabricObject };
export { CustomCanvas as Canvas };
export { TextboxObject as Textbox };
export { TextboxObject as IText };
export { TextboxObject as FabricText };
export { ImageObject as FabricImage };
export { RectObject as Rect };
export { CircleObject as Circle };
export { LineObject as Polyline };
export { LineObject as Line };

export type TOriginX = "left" | "center" | "right";
export type TOriginY = "top" | "center" | "bottom";
export type FabricObjectProps = Record<string, any>;
export type TextboxProps = Record<string, any>;
export type TextProps = Record<string, any>;
export type ModifiedEvent = { action?: string };
export type TClassProperties<T> = T;
export type TOptions<T> = Partial<T>;
export type ObjectEvents = Record<string, unknown>;
export type ITextEvents = Record<string, unknown>;

export class Point {
  constructor(public x: number, public y: number) {}
  setX(value: number): this {
    this.x = value;
    return this;
  }
  setY(value: number): this {
    this.y = value;
    return this;
  }
}

export class ActiveSelection {
  constructor(public objects: DesignerObject[] = []) {}
}
