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
  // A line has no aspect ratio to keep.
  const canKeepAspect = $derived(sizeKind === "scaled" && !CanvasUtils.isLine(selectedObject));

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

  /** Apply the edited width/height of an object that is resized through scaleX/scaleY. */
  const applyScaledSize = (source: "width" | "height"): boolean => {
    const obj = selectedObject;
    const isWidth = source === "width";
    const base = isWidth ? obj.width : obj.height;
    const wanted = isWidth ? widthScaled : heightScaled;

    // Ignore transient input while typing, and axes without extent (e.g. height of a horizontal line).
    if (!(base > 0) || !(wanted! >= 1)) return false;

    const scale = wanted! / base;
    // Keeping the aspect ratio means keeping the ratio the object has now, not forcing it to 1:1.
    const ratio = obj.scaleY / obj.scaleX;

    if (isWidth) {
      obj.scaleX = scale;
      if (canKeepAspect && keepAspectRatio) obj.scaleY = scale * ratio;
    } else {
      obj.scaleY = scale;
      if (canKeepAspect && keepAspectRatio) obj.scaleX = scale / ratio;
    }

    // Show the other axis result; the edited input is left alone so typing is not interrupted.
    if (isWidth) heightScaled = Math.round(obj.height * obj.scaleY);
    else widthScaled = Math.round(obj.width * obj.scaleX);

    return true;
  };

  // Inputs are applied live (oninput), so transient empty/invalid values are skipped.
  const updateObject = (source?: "width" | "height") => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    if (sizeKind === "scaled") {
      if (source !== undefined && !applyScaledSize(source)) return;
    } else if (sizeKind === "square") {
      if (!Number.isFinite(width) || width! < CanvasUtils.SQUARE_MIN_SIZE) return;
      CanvasUtils.setSquareSize(selectedObject, width!);
    } else if (sizeKind === "rect") {
      if (!(width! >= 1) || !(height! >= 1)) return;
      selectedObject.set({ width: Math.round(width!), height: Math.round(height!) });
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
    {:else if sizeKind === "rect"}
      <div class="input-group flex-nowrap input-group-sm mb-2">
        <input class="form-control" type="number" min="1" bind:value={width} oninput={() => updateObject()} />
        <span class="input-group-text">x</span>
        <input class="form-control" type="number" min="1" bind:value={height} oninput={() => updateObject()} />
      </div>
    {:else if sizeKind === "scaled"}
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
