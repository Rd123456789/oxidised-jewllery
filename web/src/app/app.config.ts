import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { CartService } from './core/services/cart.service';
import { ContentService } from './core/services/content.service';
import { SessionService } from './core/services/session.service';
import { WishlistService } from './core/services/wishlist.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withViewTransitions(),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(async () => {
      const session = inject(SessionService);
      const content = inject(ContentService);
      const cart = inject(CartService);
      const wishlist = inject(WishlistService);

      await session.restore();

      await Promise.allSettled([
        content.loadSettings(),
        content.loadFooterPages(),
        wishlist.load(),
      ]);

      await cart.load();
    }),
  ],
};
