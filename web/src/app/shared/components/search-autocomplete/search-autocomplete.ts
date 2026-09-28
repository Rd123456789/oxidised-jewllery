import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { pushRecentSearch, readRecentSearches } from '../../../core/auth/session.store';
import type { SearchSuggestions } from '../../../core/api/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { formatCurrency } from '../../../core/utils/format';
import { Icon } from '../icon/icon';

const DEBOUNCE_MS = 250;
const MIN_TERM_LENGTH = 2;

let nextInstanceId = 0;

@Component({
  selector: 'app-search-autocomplete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="relative">
      <form role="search" (submit)="submit($event)">
        <label class="relative block">
          <span class="sr-only">{{ placeholder() }}</span>
          <input
            #field
            type="search"
            class="ox-input pl-9"
            [class]="inputClass()"
            [placeholder]="placeholder()"
            role="combobox"
            aria-autocomplete="list"
            [attr.aria-controls]="panelId"
            autocomplete="off"
            [attr.aria-expanded]="open()"
            [attr.aria-activedescendant]="activeDescendant()"
            [value]="query()"
            (input)="onInput($event)"
            (focus)="onFocus()"
            (keydown)="onKeydown($event)"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            <app-icon name="search" [size]="15" />
          </span>
        </label>
      </form>

      @if (open()) {
        <div
          [attr.id]="panelId"
          role="listbox"
          aria-label="Search suggestions"
          class="ox-slide-down ox-card absolute top-full z-50 mt-2 max-h-[70vh] overflow-y-auto p-2"
          [class]="panelClass()"
        >
          @if (showRecent()) {
            <p class="px-3 pb-1 pt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">
              Recent searches
            </p>
            @for (term of recentItems(); track term; let i = $index) {
              <button
                type="button"
                role="option"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-sand/60 hover:text-ink"
                [id]="optionId(i)"
                [class.bg-sand]="activeIndex() === i"
                [attr.aria-selected]="activeIndex() === i"
                (click)="useRecent(term)"
              >
                <app-icon name="search" [size]="14" class="text-ink-muted" />
                <span class="truncate">{{ term }}</span>
              </button>
            }
          }

          @if (products().length > 0) {
            <p class="px-3 pb-1 pt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">
              Products
            </p>
            @for (product of products(); track product.id; let i = $index) {
              <button
                type="button"
                role="option"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-sand/60"
                [id]="optionId(recentItems().length + i)"
                [class.bg-sand]="activeIndex() === recentItems().length + i"
                [attr.aria-selected]="activeIndex() === recentItems().length + i"
                (click)="openProduct(product)"
              >
                @if (product.image) {
                  <img
                    [src]="product.image"
                    [alt]="product.name"
                    class="h-10 w-8 rounded object-cover"
                  />
                } @else {
                  <span class="flex h-10 w-8 items-center justify-center rounded bg-sand text-sand-deep">
                    <app-icon name="sparkles" [size]="14" />
                  </span>
                }
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-ink">{{ product.name }}</span>
                  <span class="block text-xs text-ink-muted">
                    {{ money(product.price, product.currency) }}
                  </span>
                </span>
                @if (!product.inStock) {
                  <span class="ox-badge ox-badge--sold">Sold out</span>
                }
              </button>
            }
          }

          @if (categories().length > 0) {
            <p class="px-3 pb-1 pt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">
              Categories
            </p>
            @for (category of categories(); track category.id; let i = $index) {
              <button
                type="button"
                role="option"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-sand/60 hover:text-ink"
                [id]="optionId(categoryOffset() + i)"
                [class.bg-sand]="activeIndex() === categoryOffset() + i"
                [attr.aria-selected]="activeIndex() === categoryOffset() + i"
                (click)="openCategory(category.slug)"
              >
                <app-icon name="tag" [size]="14" class="text-ink-muted" />
                <span class="flex-1 truncate">{{ category.name }}</span>
                <span class="text-xs text-ink-muted">{{ category.productCount }}</span>
              </button>
            }
          }

          @if (collections().length > 0) {
            <p class="px-3 pb-1 pt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">
              Collections
            </p>
            @for (collection of collections(); track collection.id; let i = $index) {
              <button
                type="button"
                role="option"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-sand/60 hover:text-ink"
                [id]="optionId(collectionOffset() + i)"
                [class.bg-sand]="activeIndex() === collectionOffset() + i"
                [attr.aria-selected]="activeIndex() === collectionOffset() + i"
                (click)="openCollection(collection.slug)"
              >
                <app-icon name="sparkles" [size]="14" class="text-ink-muted" />
                <span class="truncate">{{ collection.name }}</span>
              </button>
            }
          }

          @if (loading()) {
            <p class="flex items-center gap-2 px-3 py-3 text-sm text-ink-muted">
              <span class="ox-spinner"></span>
              Searching…
            </p>
          } @else if (noResults()) {
            <p class="px-3 py-3 text-sm text-ink-muted">
              No matches for “{{ query().trim() }}”.
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class SearchAutocomplete {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  private readonly instanceId = nextInstanceId++;

  readonly panelId = `search-suggestions-${this.instanceId}`;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;

  readonly placeholder = input('Search jhumkas, chokers…');
  readonly variant = input<'header' | 'panel'>('header');

  readonly query = signal('');
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly suggestions = signal<SearchSuggestions | null>(null);
  readonly recent = signal<string[]>(readRecentSearches());
  readonly activeIndex = signal(-1);

  readonly showRecent = computed(
    () => this.query().trim().length < MIN_TERM_LENGTH && this.recent().length > 0,
  );

  readonly recentItems = computed(() => (this.showRecent() ? this.recent() : []));
  readonly products = computed(() => (this.showRecent() ? [] : (this.suggestions()?.products ?? [])));
  readonly categories = computed(() =>
    this.showRecent() ? [] : (this.suggestions()?.categories ?? []),
  );
  readonly collections = computed(() =>
    this.showRecent() ? [] : (this.suggestions()?.collections ?? []),
  );

  readonly categoryOffset = computed(() => this.recentItems().length + this.products().length);
  readonly collectionOffset = computed(() => this.categoryOffset() + this.categories().length);
  readonly itemCount = computed(() => this.collectionOffset() + this.collections().length);

  readonly hasResults = computed(
    () => this.products().length + this.categories().length + this.collections().length > 0,
  );

  readonly noResults = computed(
    () =>
      !this.showRecent() &&
      !this.loading() &&
      this.query().trim().length >= MIN_TERM_LENGTH &&
      !this.hasResults(),
  );

  readonly activeDescendant = computed(() => {
    const index = this.activeIndex();

    return index >= 0 && index < this.itemCount() ? this.optionId(index) : null;
  });

  readonly inputClass = computed(() =>
    this.variant() === 'header' ? 'w-56' : 'w-full',
  );

  readonly panelClass = computed(() =>
    this.variant() === 'header'
      ? 'right-0 w-[24rem] max-w-[calc(100vw-2rem)]'
      : 'left-0 right-0',
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  optionId(index: number): string {
    return `search-option-${this.instanceId}-${index}`;
  }

  money(amount: number, currency: string): string {
    return formatCurrency(amount, currency);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.query.set(value);
    this.open.set(true);
    this.activeIndex.set(-1);
    this.schedule(value);
  }

  onFocus(): void {
    this.recent.set(readRecentSearches());

    if (this.query().trim().length >= MIN_TERM_LENGTH || this.recent().length > 0) {
      this.open.set(true);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close(true);
      return;
    }

    if (!this.open()) {
      return;
    }

    const count = this.itemCount();

    if (count === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((index) => (index + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => (index <= 0 ? count - 1 : index - 1));
    } else if (event.key === 'Enter') {
      const index = this.activeIndex();

      if (index >= 0) {
        event.preventDefault();
        this.activateIndex(index);
      }
    }
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();

    const term = this.query().trim();

    if (!term) {
      return;
    }

    this.remember(term);
    this.close(false);

    await this.router.navigate(['/shop'], { queryParams: { q: term } });
  }

  async useRecent(term: string): Promise<void> {
    this.query.set(term);
    this.remember(term);
    this.close(false);

    await this.router.navigate(['/shop'], { queryParams: { q: term } });
  }

  async openProduct(product: { name: string; slug: string }): Promise<void> {
    this.remember(this.query().trim() || product.name);
    this.close(false);

    await this.router.navigate(['/product', product.slug]);
  }

  async openCategory(slug: string): Promise<void> {
    this.remember(this.query().trim());
    this.close(false);

    await this.router.navigate(['/shop'], { queryParams: { category: slug } });
  }

  async openCollection(slug: string): Promise<void> {
    this.remember(this.query().trim());
    this.close(false);

    await this.router.navigate(['/collections', slug]);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }

    const target = event.target as Node | null;

    if (target && this.host.nativeElement.contains(target)) {
      return;
    }

    this.close(false);
  }

  private activateIndex(index: number): void {
    const recentItems = this.recentItems();

    if (index < recentItems.length) {
      void this.useRecent(recentItems[index]!);
      return;
    }

    const productIndex = index - recentItems.length;

    if (productIndex < this.products().length) {
      void this.openProduct(this.products()[productIndex]!);
      return;
    }

    const categoryIndex = index - this.categoryOffset();

    if (categoryIndex < this.categories().length) {
      void this.openCategory(this.categories()[categoryIndex]!.slug);
      return;
    }

    const collectionIndex = index - this.collectionOffset();
    const collection = this.collections()[collectionIndex];

    if (collection) {
      void this.openCollection(collection.slug);
    }
  }

  private remember(term: string): void {
    if (term.trim().length >= MIN_TERM_LENGTH) {
      this.recent.set(pushRecentSearch(term));
    }
  }

  private schedule(term: string): void {
    this.clearTimer();

    const trimmed = term.trim();

    if (trimmed.length < MIN_TERM_LENGTH) {
      this.requestSeq++;
      this.loading.set(false);
      this.suggestions.set(null);
      return;
    }

    this.searchTimer = setTimeout(() => void this.runSearch(trimmed), DEBOUNCE_MS);
  }

  private async runSearch(term: string): Promise<void> {
    const seq = ++this.requestSeq;

    this.loading.set(true);

    try {
      const result = await this.catalog.suggest(term);

      if (seq === this.requestSeq) {
        this.suggestions.set(result);
      }
    } catch {
      if (seq === this.requestSeq) {
        this.suggestions.set(null);
      }
    } finally {
      if (seq === this.requestSeq) {
        this.loading.set(false);
      }
    }
  }

  private clearTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private close(blur: boolean): void {
    this.open.set(false);
    this.activeIndex.set(-1);

    if (blur) {
      this.field()?.nativeElement.blur();
    }
  }
}
