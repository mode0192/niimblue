<script lang="ts">
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { tr } from "$/utils/i18n";
  import * as fabric from "fabric";
  import { onDestroy, untrack } from "svelte";
  import { CanvasUtils } from "$/utils/canvas_utils";

  interface Props {
    selectedObject: fabric.FabricObject;
    editRevision: number;
  }

  let { selectedObject, editRevision }: Props = $props();
  let prevObject: fabric.FabricObject | undefined;

  let x = $state<number>();
  let y = $state<number>();
  let width = $state<number>();
  let height = $state<number>();
  let widthScaled = $state<number>();
  let heightScaled = $state<number>();
  let keepAspectRatio = $state<boolean>(false);

  const sizeKind = $derived(CanvasUtils.getSizeKind(selectedObject));
  // Rect and scaled objects share the same size inputs and the aspect switch.
  const hasSizeInputs = $derived(sizeKind === "scaled" || sizeKind === "rect");
  // A line has no aspect ratio to keep.
  const canKeepAspect = $derived(hasSizeInputs && !CanvasUtils.isLine(selectedObject));

  const objectDimensionsChanged = (e?: fabric.ModifiedEvent) => {
    const pos = selectedObject.getPointByOrigin("left", "top");
    x = pos.x;
    y = pos.y;
    width = selectedObject.width;
    height = selectedObject.height;
    widthScaled = Math.round(width * selectedObject.scaleX);
    heightScaled = Math.round(height * selectedObject.scaleY);

    // Dragging a side handle distorts the object, so the lock no longer applies.
    if (canKeepAspect && (e?.action === "scaleX" || e?.action === "scaleY")) {
      CanvasUtils.setAspectLock(selectedObject, false);
      keepAspectRatio = false;
    }
  };

  const objectChanged = (newObject: fabric.FabricObject) => {
    if (prevObject !== undefined) {
      prevObject.off("modified", objectDimensionsChanged);
    }

    newObject.on("modified", objectDimensionsChanged);
    objectDimensionsChanged();
    keepAspectRatio = CanvasUtils.isAspectLocked(newObject);

    prevObject = newObject;
  };

  /** Apply the edited width/height. Rects change width/height, other objects change scaleX/scaleY. */
  const applySize = (source: "width" | "height"): boolean => {
    const obj = selectedObject;
    const isWidth = source === "width";
    const shown = isWidth ? obj.width * obj.scaleX : obj.height * obj.scaleY;
    const wanted = isWidth ? widthScaled : heightScaled;

    // Ignore transient input while typing, and axes without extent (e.g. height of a horizontal line).
    if (!(shown > 0) || !(wanted! >= 1)) return false;

    // Keeping the aspect ratio means keeping the ratio the object has now, not forcing it to 1:1.
    const factor = wanted! / shown;
    const keep = canKeepAspect && keepAspectRatio;
    const factorX = isWidth || keep ? factor : 1;
    const factorY = !isWidth || keep ? factor : 1;

    if (sizeKind === "rect") {
      obj.set({
        width: Math.max(1, Math.round(obj.width * factorX)),
        height: Math.max(1, Math.round(obj.height * factorY)),
      });
    } else {
      obj.set({ scaleX: obj.scaleX * factorX, scaleY: obj.scaleY * factorY });
    }

    // Show the other axis result; the edited input is left alone so typing is not interrupted.
    if (isWidth) heightScaled = Math.round(obj.height * obj.scaleY);
    else widthScaled = Math.round(obj.width * obj.scaleX);

    return true;
  };

  // Inputs are applied live (oninput), so transient empty/invalid values are skipped.
  const updateObject = (source?: "width" | "height") => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    if (hasSizeInputs) {
      if (source !== undefined && !applySize(source)) return;
    } else if (sizeKind === "square") {
      if (!Number.isFinite(width) || width! < CanvasUtils.SQUARE_MIN_SIZE) return;
      CanvasUtils.setSquareSize(selectedObject, width!);
    }

    // Position last: a size change may move the top-left corner of objects that scale around their center.
    selectedObject.setPositionByOrigin(new fabric.Point(Math.round(x!), Math.round(y!)), "left", "top");
    selectedObject.setCoords();
    selectedObject.canvas?.requestRenderAll();
  };

  const squareSizeCommitted = () => {
    width = CanvasUtils.normalizeSquareSize(width ?? 0);
    height = width;
    updateObject();
  };

  const aspectLockChanged = (e: Event & { currentTarget: HTMLInputElement }) => {
    keepAspectRatio = e.currentTarget.checked;
    CanvasUtils.setAspectLock(selectedObject, keepAspectRatio);
  };

  onDestroy(() => selectedObject.off("modified", objectDimensionsChanged));

  // Center/fit buttons don't fire "modified" but bump editRevision
  $effect(() => {
    void editRevision;
    untrack(() => objectDimensionsChanged());
  });

  $effect(() => {
    const obj = selectedObject;
    // Only re-sync when the selected object changes. Without untrack the effect also tracks
    // state read while syncing and resets the inputs on every keystroke.
    untrack(() => objectChanged(obj));
  });
</script>

<div class="dropdown">
  <button
    class="btn btn-sm btn-secondary dropdown-toggle"
    type="button"
    data-bs-toggle="dropdown"
    title={$tr("params.generic.position")}>
    <MdIcon icon="control_camera" />
  </button>
  <div class="dropdown-menu arrangement p-2">
    <div class="input-group flex-nowrap input-group-sm mb-2">
      <span class="input-group-text">x</span>
      <input class="form-control" type="number" bind:value={x} oninput={() => updateObject()} />
    </div>
    <div class="input-group flex-nowrap input-group-sm mb-2">
      <span class="input-group-text">y</span>
      <input class="form-control" type="number" bind:value={y} oninput={() => updateObject()} />
    </div>
    {#if sizeKind === "square"}
      <div class="input-group flex-nowrap input-group-sm mb-2">
        <input
          class="form-control"
          type="number"
          min={CanvasUtils.SQUARE_MIN_SIZE}
          bind:value={width}
          oninput={() => updateObject()}
          onchange={squareSizeCommitted} />
        <span class="input-group-text">px</span>
      </div>
    {:else if hasSizeInputs}
      <div class="input-group flex-nowrap input-group-sm mb-2">
        <input
          class="form-control"
          type="number"
          min="1"
          disabled={!width}
          bind:value={widthScaled}
          oninput={() => updateObject("width")} />
        <span class="input-group-text">x</span>
        <input
          class="form-control"
          type="number"
          min="1"
          disabled={!height}
          bind:value={heightScaled}
          oninput={() => updateObject("height")} />
      </div>
    {/if}
    {#if canKeepAspect}
      <div class="form-check form-switch">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="keepImageAspectRatio"
          checked={keepAspectRatio}
          onchange={aspectLockChanged} />
        <label class="form-check-label" for="keepImageAspectRatio" style="text-wrap: nowrap">
          {$tr("params.generic.keepAspectRatio")}</label>
      </div>
    {/if}
  </div>
</div>
