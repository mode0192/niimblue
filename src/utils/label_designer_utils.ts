import { GRID_SIZE, OBJECT_DEFAULTS } from "$/defaults";
import type { MoveDirection } from "$/types";
import { CustomCanvas } from "$/fabric-object/custom_canvas";
import type { DesignerObject } from "$/konva-object/base";
import { TextboxObject } from "$/konva-object/textbox";

export class LabelDesignerUtils {
  static async cloneSelection(canvas: CustomCanvas): Promise<void> {
    const selected = canvas.getActiveObjects();
    if (selected.length === 0) return;

    const clones: DesignerObject[] = [];
    for (const object of selected) {
      const clone = await object.clone();
      clone.left += GRID_SIZE;
      clone.top += GRID_SIZE;
      clone.snapAngle = OBJECT_DEFAULTS.snapAngle;
      clones.push(clone);
    }

    canvas.add(...clones);
    canvas.setActiveObjects(clones);
  }

  static moveSelection(canvas: CustomCanvas, direction: MoveDirection, ctrl?: boolean): void {
    const amount = ctrl ? 1 : GRID_SIZE;
    canvas.getActiveObjects().forEach((object) => {
      if (direction === "left") object.left = Math.round(object.left) - amount;
      else if (direction === "right") object.left = Math.round(object.left) + amount;
      else if (direction === "up") object.top = Math.round(object.top) - amount;
      else if (direction === "down") object.top = Math.round(object.top) + amount;
      object.setCoords();
    });
    canvas.requestRenderAll();
  }

  static deleteSelection(canvas: CustomCanvas): void {
    canvas.getActiveObjects().forEach((object) => canvas.remove(object));
  }

  static isAnyInputFocused(canvas: CustomCanvas): boolean {
    const focused = document.activeElement;
    if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA")) {
      return true;
    }
    return canvas.getActiveObjects().some((object) => object instanceof TextboxObject && object.isEditing);
  }
}
