import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type IconName =
  | 'search'
  | 'bag'
  | 'heart'
  | 'user'
  | 'menu'
  | 'close'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'star'
  | 'trash'
  | 'plus'
  | 'minus'
  | 'check'
  | 'truck'
  | 'shield'
  | 'refresh'
  | 'dashboard'
  | 'box'
  | 'tag'
  | 'image'
  | 'page'
  | 'settings'
  | 'users'
  | 'logout'
  | 'edit'
  | 'filter'
  | 'sparkles'
  | 'arrow-right'
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'pinterest'
  | 'alert'
  | 'info';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        }
        @case ('bag') {
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        }
        @case ('heart') {
          <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 7.7 4 4 0 0 1 19 10.7C19 15.6 12 20 12 20Z" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" />
        }
        @case ('menu') {
          <path d="M4 7h16M4 12h16M4 17h16" />
        }
        @case ('close') {
          <path d="M6 6l12 12M18 6 6 18" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('chevron-left') {
          <path d="m14 6-6 6 6 6" />
        }
        @case ('chevron-right') {
          <path d="m10 6 6 6-6 6" />
        }
        @case ('star') {
          <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
        }
        @case ('trash') {
          <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('minus') {
          <path d="M5 12h14" />
        }
        @case ('check') {
          <path d="m5 13 4.5 4.5L19 7" />
        }
        @case ('truck') {
          <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        }
        @case ('shield') {
          <path d="M12 4l7 3v5c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7l7-3Z" />
        }
        @case ('refresh') {
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 4v5h-5" />
        }
        @case ('dashboard') {
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        }
        @case ('box') {
          <path d="M3 8l9-4 9 4v8l-9 4-9-4V8Z" />
          <path d="M3 8l9 4 9-4M12 12v8" />
        }
        @case ('tag') {
          <path d="M4 12.5V5a1 1 0 0 1 1-1h7.5L20 11.5 12.5 19 4 12.5Z" />
          <circle cx="8" cy="8" r="1.2" />
        }
        @case ('image') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4 18 5-4.5 4 3 3-2.5 4 4" />
        }
        @case ('page') {
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4M9 13h6M9 17h6" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"
          />
        }
        @case ('users') {
          <circle cx="9" cy="9" r="3" />
          <path d="M3 19c1-3 3.2-4.5 6-4.5S14 16 15 19" />
          <path d="M16 11a3 3 0 1 0 0-6" />
          <path d="M17 19c-.3-1.6-1-2.9-2-3.9" />
        }
        @case ('logout') {
          <path d="M15 5H7v14h8" />
          <path d="M12 12h8M17 9l3 3-3 3" />
        }
        @case ('edit') {
          <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
          <path d="m14 6 4 4" />
        }
        @case ('filter') {
          <path d="M4 6h16M7 12h10M10 18h4" />
        }
        @case ('sparkles') {
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
        }
        @case ('arrow-right') {
          <path d="M5 12h14M13 6l6 6-6 6" />
        }
        @case ('whatsapp') {
          <path d="M5 19l1-3.6A7 7 0 1 1 9 18.9L5 19Z" />
          <path d="M9 10c.4 2 2 3.6 4 4" />
        }
        @case ('instagram') {
          <rect x="4" y="4" width="16" height="16" rx="4.5" />
          <circle cx="12" cy="12" r="3.4" />
          <circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none" />
        }
        @case ('facebook') {
          <path d="M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2l.5-3H14V8.6c0-.4.2-.6.6-.6Z" />
        }
        @case ('pinterest') {
          <circle cx="12" cy="12" r="8" />
          <path d="M10 19l1.6-6M9.5 11c0-2 1.4-3.2 3-3.2 1.7 0 2.9 1 2.9 2.6 0 1.9-1 3.4-2.5 3.4-.8 0-1.4-.6-1.2-1.4" />
        }
        @case ('alert') {
          <path d="M12 4l8 14H4L12 4Z" />
          <path d="M12 10v4M12 17h.01" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="8" />
          <path d="M12 11v5M12 8h.01" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<number>(18);
  readonly strokeWidth = input<number>(1.6);
}
