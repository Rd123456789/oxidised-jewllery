import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Wraps a horizontal product row and tells the visitor it scrolls: soft edge fades plus
 * previous/next buttons that appear only while there is more content in that direction.
 * The rail itself keeps its scrollbar hidden, so without this there is no affordance at all.
 *
 * The fades are tinted for the ivory storefront canvas; move the gradient to `from-paper`
 * if this is ever mounted on a paper section.
 */
@Component({
  selector: 'app-scroll-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <div class="relative">
      <div #scroller class="ox-rail ox-stagger" (scroll)="scheduleUpdate()">
        <ng-content />
      </div>

      @if (canScrollBack()) {
        <div
          class="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-ivory from-40% to-transparent sm:w-20"
          aria-hidden="true"
        ></div>
        <button
          type="button"
          class="absolute left-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-sand-deep bg-paper text-ink shadow-soft sm:flex"
          aria-label="Scroll products left"
          (click)="scrollBy(-1)"
        >
          <app-icon name="chevron-left" [size]="16" />
        </button>
      }

      @if (canScrollForward()) {
        <div
          class="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-ivory from-40% to-transparent sm:w-20"
          aria-hidden="true"
        ></div>
        <button
          type="button"
          class="absolute right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-sand-deep bg-paper text-ink shadow-soft sm:flex"
          aria-label="Scroll products right"
          (click)="scrollBy(1)"
        >
          <app-icon name="chevron-right" [size]="16" />
        </button>
      }
    </div>
  `,
})
export class ScrollRail {
  private readonly scrollerRef = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly destroyRef = inject(DestroyRef);

  readonly canScrollBack = signal(false);
  readonly canScrollForward = signal(false);

  private frame = 0;

  constructor() {
    afterNextRender(() => {
      const scroller = this.scrollerRef().nativeElement;
      const resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
      const mutationObserver = new MutationObserver(() => this.scheduleUpdate());

      resizeObserver.observe(scroller);
      mutationObserver.observe(scroller, { childList: true, subtree: true });
      scroller.addEventListener('scroll', this.handleScroll, { passive: true });

      this.destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        scroller.removeEventListener('scroll', this.handleScroll);
        cancelAnimationFrame(this.frame);
      });

      this.update();
    });
  }

  private readonly handleScroll = (): void => this.scheduleUpdate();

  scheduleUpdate(): void {
    if (this.frame) {
      return;
    }

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }

  scrollBy(direction: -1 | 1): void {
    const scroller = this.scrollerRef().nativeElement;
    const distance = Math.max(240, Math.round(scroller.clientWidth * 0.8));
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    scroller.scrollBy({ left: direction * distance, behavior: reduced ? 'auto' : 'smooth' });
  }

  private update(): void {
    const scroller = this.scrollerRef().nativeElement;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;

    if (maxScroll <= 1) {
      this.canScrollBack.set(false);
      this.canScrollForward.set(false);

      return;
    }

    this.canScrollBack.set(scroller.scrollLeft > 1);
    this.canScrollForward.set(scroller.scrollLeft < maxScroll - 1);
  }
}
