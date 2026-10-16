/**
 * Bootstrap closes a dropdown on any click that is not on an input. If a press starts in a text field
 * inside the menu (e.g. selecting text) and is released on another element, the browser fires `click` on
 * the common ancestor, which Bootstrap treats as a real click. Swallow that click before Bootstrap sees it.
 */
export const preventDropdownCloseOnDragRelease = () => {
  const MENU = ".dropdown-menu";
  const TEXT_FIELD = "input, textarea, select, [contenteditable='true']";
  let pressTarget: Element | null = null;

  document.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target instanceof Element ? e.target : null;
      pressTarget = t !== null && t.closest(MENU) !== null && t.closest(TEXT_FIELD) !== null ? t : null;
    },
    true,
  );

  // a keyboard-triggered click has no pointerdown, so don't let a stale press swallow it
  document.addEventListener("keydown", () => (pressTarget = null), true);

  document.addEventListener(
    "click",
    (e) => {
      if (pressTarget !== null && e.target !== pressTarget) {
        e.stopPropagation();
      }
      pressTarget = null;
    },
    true,
  );
};
