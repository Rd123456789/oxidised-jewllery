const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Keeps Tab focus inside an open overlay so keyboard users cannot tab behind it.
 * Pair with `aria-modal="true"` and restoring focus to the trigger on close.
 */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') {
    return;
  }

  const elements = focusable(container);

  if (elements.length === 0) {
    event.preventDefault();

    return;
  }

  const first = elements[0]!;
  const last = elements[elements.length - 1]!;
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftKey) {
    if (!active || active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }

    return;
  }

  if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function focusFirst(container: HTMLElement): void {
  focusable(container)[0]?.focus();
}
