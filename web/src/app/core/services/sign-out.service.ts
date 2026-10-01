import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from './cart.service';
import { SessionService } from './session.service';
import { WishlistService } from './wishlist.service';

/**
 * Storefront routes that only render for a signed-in visitor. Signing out of one of these
 * has to move the visitor somewhere, because the page they are on stops existing for them.
 * Everything else (home, shop, product, collections) is public and is left untouched.
 */
const PROTECTED_PREFIXES = ['/account'];

const isProtected = (url: string): boolean =>
  PROTECTED_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));

/**
 * One sign-out path for the storefront. Clearing the session, dropping the signed-in cart and
 * wishlist and deciding where the visitor lands used to live in each caller, which is how the
 * header ended up signing out without navigating at all and the account page orphaned the bag.
 */
@Injectable({ providedIn: 'root' })
export class SignOutService {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);

  /**
   * Signs out, restores a clean guest cart and wishlist, then routes the visitor away from a
   * now-unreachable page. The sign-in page honours `redirect`, so signing back in returns them
   * to the tab they were on instead of dumping them on the homepage.
   */
  async signOut(): Promise<void> {
    const from = this.router.url;

    await this.session.logout();

    this.cart.reset();
    this.wishlist.reset();
    await this.cart.load();

    if (!isProtected(from)) {
      return;
    }

    await this.router.navigate(['/login'], { queryParams: { redirect: from } });
  }
}
