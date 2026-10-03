import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentService } from '../../core/services/content.service';
import { SessionService } from '../../core/services/session.service';
import { SignOutService } from '../../core/services/sign-out.service';
import { ToastService } from '../../core/services/toast.service';
import { focusFirst, trapTabKey } from '../../core/utils/focus-trap';
import { Icon } from '../../shared/components/icon/icon';
import { MiniCart } from '../../shared/components/mini-cart/mini-cart';
import { SearchAutocomplete } from '../../shared/components/search-autocomplete/search-autocomplete';
import { ChatWidget } from '../../shared/components/chat/chat-widget';
import { WishlistService } from '../../core/services/wishlist.service';

@Component({
  selector: 'app-storefront-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Icon,
    SearchAutocomplete,
    MiniCart,
    ChatWidget,
  ],
  templateUrl: './storefront-layout.html',
  host: { '(document:keydown.escape)': 'closeAll()' },
})
export class StorefrontLayout {
  private readonly content = inject(ContentService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly session = inject(SessionService);
  readonly cart = inject(CartService);
  readonly wishlist = inject(WishlistService);
  private readonly signOutFlow = inject(SignOutService);

  readonly settings = this.content.settings;
  readonly footerPages = this.content.footerPages;
  readonly categories = this.catalog.categories;

  readonly menuOpen = signal(false);
  readonly miniCartOpen = signal(false);
  readonly categoriesOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly newsletterEmail = signal('');
  readonly subscribing = signal(false);

  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawerPanel');
  private menuTriggerFocus: HTMLElement | null = null;

  readonly storeName = computed(() => this.settings()?.storeName ?? 'Oxidised Jewellery');
  readonly year = new Date().getFullYear();
  readonly announcement = computed(() => {
    const announcement = this.settings()?.announcement;

    return announcement?.isActive && announcement.text ? announcement : null;
  });

  readonly cartCount = this.cart.itemCount;

  constructor() {
    void this.catalog
      .getCategories()
      .catch(() => undefined)
      .finally(() => this.cdr.markForCheck());

    effect(() => {
      const menuOpen = this.menuOpen();
      const miniCartOpen = this.miniCartOpen();

      if (typeof document === 'undefined') {
        return;
      }

      // Lock background scrolling while either overlay is open.
      document.body.classList.toggle('overflow-hidden', menuOpen || miniCartOpen);

      if (menuOpen) {
        this.menuTriggerFocus = document.activeElement as HTMLElement | null;

        queueMicrotask(() => {
          const panel = this.drawer()?.nativeElement;

          if (panel) {
            focusFirst(panel);
          }
        });

        return;
      }

      if (this.menuTriggerFocus) {
        this.menuTriggerFocus.focus?.();
        this.menuTriggerFocus = null;
      }
    });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
    this.categoriesOpen.set(false);
    this.accountOpen.set(false);
  }

  closeAll(): void {
    this.closeMenu();
    this.miniCartOpen.set(false);
  }

  toggleMiniCart(): void {
    this.miniCartOpen.update((open) => !open);
    this.accountOpen.set(false);
  }

  onDrawerKeydown(event: KeyboardEvent): void {
    const panel = this.drawer()?.nativeElement;

    if (panel) {
      trapTabKey(event, panel);
    }
  }

  async signOut(): Promise<void> {
    await this.signOutFlow.signOut();
    this.accountOpen.set(false);
    this.closeMenu();
    this.toast.info('Signed out');
  }

  async subscribe(event: Event): Promise<void> {
    event.preventDefault();

    const email = this.newsletterEmail().trim();

    if (!email) {
      return;
    }

    this.subscribing.set(true);

    try {
      await this.content.subscribeToNewsletter(email);
      this.toast.success('You are on the list');
      this.newsletterEmail.set('');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.subscribing.set(false);
      this.cdr.markForCheck();
    }
  }
}
