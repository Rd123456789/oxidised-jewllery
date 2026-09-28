import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type ActivatedRouteSnapshot } from '@angular/router';
import { routes } from './app.routes';

/** Deepest activated component in the route tree. */
function leafComponentName(root: ActivatedRouteSnapshot): string | undefined {
  let node: ActivatedRouteSnapshot | undefined = root;
  let name: string | undefined;

  while (node) {
    const componentName = (node.component as { name?: string } | null)?.name;

    if (componentName) {
      // The optimiser can prefix generated class names with an underscore.
      name = componentName.replace(/^_+/, '');
    }

    node = node.firstChild ?? undefined;
  }

  return name;
}

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  // Regression: the storefront route is declared with `path: ''` and its children
  // include a `**` wildcard, which greedily swallowed /admin/** and rendered the
  // storefront 404 instead of the admin panel. Order of `routes` matters.
  it('activates the admin login page for /admin/login', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/login');

    expect(router.url).toBe('/admin/login');
    expect(leafComponentName(router.routerState.snapshot.root)).toBe('AdminLoginPage');
  });

  it('does not fall through to the storefront 404 for an admin URL', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/login');

    expect(leafComponentName(router.routerState.snapshot.root)).not.toBe('NotFoundPage');
  });

  it('still serves the storefront routes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/shop');

    expect(leafComponentName(router.routerState.snapshot.root)).toBe('ShopPage');
  });

  it('serves the home page at the root', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');

    expect(leafComponentName(router.routerState.snapshot.root)).toBe('HomePage');
  });
});
