/**
 * Bootstrap closes a dropdown on any click outside of it. When a press starts inside the menu (e.g. selecting
 * text in a field) and is released outside, the browser fires that click on a common ancestor, outside the
 * menu. Swallow it before Bootstrap sees it. Keyboard clicks (detail 0) are not affected.
 */
export const preventDropdownCloseOnDragRelease = () => {
  const inMenu = (target: EventTarget | null) => target instanceof Element && target.closest(".dropdown-menu") !== null;
  let pressedInMenu = false;

  document.addEventListener("pointerdown", (e) => (pressedInMenu = inMenu(e.target)), true);

  document.addEventListener(
    "click",
    (e) => {
      if (pressedInMenu && e.detail > 0 && !inMenu(e.target)) e.stopPropagation();
      pressedInMenu = false;
    },
    true,
  );
};
