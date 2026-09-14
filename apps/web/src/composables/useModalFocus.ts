import {
  nextTick,
  onBeforeUnmount,
  watch,
  type Ref
} from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]"
].join(",");

function isFocusable(element: HTMLElement) {
  return !element.matches(":disabled")
    && !element.hasAttribute("disabled")
    && !element.hidden
    && !element.closest("[hidden]")
    && element.tabIndex >= 0
    && element.getAttribute("aria-hidden") !== "true"
    && !element.closest("[aria-hidden='true'], [inert]")
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== "hidden";
}

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(isFocusable);
}

function revealWithin(element: HTMLElement, container: HTMLElement) {
  const elementBounds = element.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  const padding = 12;

  if (elementBounds.top < containerBounds.top + padding) {
    container.scrollTop -= containerBounds.top + padding - elementBounds.top;
  } else if (elementBounds.bottom > containerBounds.bottom - padding) {
    container.scrollTop += elementBounds.bottom - (containerBounds.bottom - padding);
  }
}

function focusElement(element: HTMLElement | null, reveal = false, scrollContainer?: HTMLElement) {
  if (!element?.isConnected) return false;
  element.focus({ preventScroll: true });
  if (document.activeElement !== element) return false;
  if (reveal && scrollContainer) revealWithin(element, scrollContainer);
  return true;
}

export function useModalFocus(
  open: Readonly<Ref<boolean>>,
  dialogElement: Readonly<Ref<HTMLElement | null>>,
  fallbackTrigger?: Readonly<Ref<HTMLElement | null>>
) {
  let previouslyFocused: HTMLElement | null = null;

  function restoreFocus() {
    const originalTarget = previouslyFocused?.isConnected && isFocusable(previouslyFocused)
      ? previouslyFocused
      : null;
    const fallbackTarget = fallbackTrigger?.value?.isConnected && isFocusable(fallbackTrigger.value)
      ? fallbackTrigger.value
      : null;

    if (!focusElement(originalTarget)) focusElement(fallbackTarget);
    previouslyFocused = null;
  }

  const stopWatching = watch(open, async (isOpen, wasOpen, onCleanup) => {
    if (!isOpen) {
      if (wasOpen) restoreFocus();
      return;
    }

    if (typeof document === "undefined") return;

    previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    let cancelled = false;
    document.addEventListener("keydown", handleKeydown, true);
    onCleanup(() => {
      cancelled = true;
      document.removeEventListener("keydown", handleKeydown, true);
    });

    await nextTick();
    if (cancelled || !open.value) return;

    const dialog = dialogElement.value;
    if (!dialog?.isConnected) return;
    focusElement(getFocusableElements(dialog)[0] ?? dialog);
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!open.value || event.key !== "Tab") return;

    const dialog = dialogElement.value;
    if (!dialog) return;

    const focusableElements = getFocusableElements(dialog);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      event.preventDefault();
      focusElement(dialog, true, dialog);
      return;
    }

    const activeElement = typeof document === "undefined"
      ? null
      : document.activeElement;
    const focusIsOutside = !activeElement || !dialog.contains(activeElement);

    if (event.shiftKey && (focusIsOutside || activeElement === firstElement)) {
      event.preventDefault();
      focusElement(lastElement, true, dialog);
    } else if (!event.shiftKey && (focusIsOutside || activeElement === lastElement)) {
      event.preventDefault();
      focusElement(firstElement, true, dialog);
    }
  }

  onBeforeUnmount(() => {
    stopWatching();
    if (open.value) restoreFocus();
    previouslyFocused = null;
  });

  return { handleKeydown };
}
