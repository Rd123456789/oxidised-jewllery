import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../../core/api/api-error';
import type { Collection, ProductSummary } from '../../../core/api/api.models';
import { AdminService, type CollectionInput } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { slugify } from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import {
  ImageUploader,
  type UploadedImage,
} from '../../../shared/components/image-uploader/image-uploader';

interface CollectionFormValue extends CollectionInput {
  products: string[];
  themeColor: string;
}

@Component({
  selector: 'admin-collections-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ImageUploader],
  templateUrl: './collections.page.html',
})
export class AdminCollectionsPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly collections = signal<Collection[]>([]);
  readonly products = signal<ProductSummary[]>([]);
  readonly form = signal<CollectionFormValue>(this.emptyForm());
  readonly errors = signal<Record<string, string>>({});
  readonly productSearch = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly confirmingId = signal<string | null>(null);

  readonly isEditing = computed(() => this.editingId() !== null);

  readonly filteredProducts = computed(() => {
    const term = this.productSearch().trim().toLowerCase();

    if (!term) {
      return this.products();
    }

    return this.products().filter((product) => product.name.toLowerCase().includes(term));
  });

  readonly selectedCount = computed(() => this.form().products.length);

  readonly textOf = (event: Event): string =>
    (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

  readonly numberOf = (event: Event): number => Number(this.textOf(event)) || 0;

  readonly checkedOf = (event: Event): boolean => (event.target as HTMLInputElement).checked;

  constructor() {
    this.seo.set({
      title: 'Collections',
      description: 'Curate themed product collections.',
      canonicalPath: '/admin/collections',
    });

    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);

    try {
      const [collections, productPage] = await Promise.all([
        this.admin.collections(),
        this.admin.products({ limit: 100, status: 'all' }),
      ]);

      this.collections.set(
        [...collections].sort((first, second) => first.sortOrder - second.sortOrder),
      );
      this.products.set(productPage.items);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  startCreate(): void {
    this.editingId.set(null);
    this.errors.set({});
    this.productSearch.set('');
    this.form.set(this.emptyForm());
  }

  startEdit(collection: Collection): void {
    const productIds = (collection.products ?? []).map((entry) =>
      typeof entry === 'string' ? entry : entry.id,
    );

    this.editingId.set(collection.id);
    this.errors.set({});
    this.productSearch.set('');
    this.form.set({
      name: collection.name,
      slug: collection.slug,
      tagline: collection.tagline ?? '',
      description: collection.description ?? '',
      heroImage: collection.heroImage,
      thumbnail: collection.thumbnail,
      themeColor: collection.themeColor ?? '#8a5a2b',
      products: productIds,
      isFeatured: collection.isFeatured,
      isActive: collection.isActive,
      sortOrder: collection.sortOrder,
    });
  }

  cancelEdit(): void {
    this.startCreate();
  }

  onName(event: Event): void {
    const name = this.textOf(event);
    const partial: Partial<CollectionFormValue> = { name };

    if (!this.form().slug) {
      partial.slug = slugify(name);
    }

    this.patch(partial);
  }

  generateSlug(): void {
    const name = this.form().name;

    if (name.trim().length > 0) {
      this.patch({ slug: slugify(name) });
    }
  }

  onHeroImages(images: UploadedImage[]): void {
    const first = images[0];

    this.patch({
      heroImage: first
        ? { url: first.url, publicId: first.publicId, alt: first.alt }
        : undefined,
    });
  }

  onThumbnailImages(images: UploadedImage[]): void {
    const first = images[0];

    this.patch({
      thumbnail: first
        ? { url: first.url, publicId: first.publicId, alt: first.alt }
        : undefined,
    });
  }

  heroImages(): UploadedImage[] {
    const image = this.form().heroImage;

    return image ? [image] : [];
  }

  thumbnailImages(): UploadedImage[] {
    const image = this.form().thumbnail;

    return image ? [image] : [];
  }

  isProductSelected(id: string): boolean {
    return this.form().products.includes(id);
  }

  toggleProduct(id: string): void {
    const selected = this.form().products;

    this.patch({
      products: selected.includes(id)
        ? selected.filter((entry) => entry !== id)
        : [...selected, id],
    });
  }

  productCount(collection: Collection): number {
    return collection.products?.length ?? 0;
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();

    if (this.saving()) {
      return;
    }

    const value = this.form();
    const errors: Record<string, string> = {};

    if (!value.name || value.name.trim().length < 2) {
      errors['name'] = 'Name must be at least 2 characters.';
    }

    this.errors.set(errors);

    if (Object.keys(errors).length > 0) {
      this.toast.error('Please fix the highlighted fields.');

      return;
    }

    const payload: CollectionInput = {
      ...value,
      name: value.name.trim(),
      slug: value.slug?.trim() || undefined,
    };

    this.saving.set(true);

    try {
      const editing = this.editingId();

      if (editing) {
        await this.admin.updateCollection(editing, payload);
        this.toast.success('Collection updated');
      } else {
        await this.admin.createCollection(payload);
        this.toast.success('Collection created');
      }

      await this.load();
      this.startCreate();
    } catch (error) {
      this.applyServerErrors(error);
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  askDelete(id: string): void {
    this.confirmingId.set(id);
  }

  cancelDelete(): void {
    this.confirmingId.set(null);
  }

  async confirmDelete(collection: Collection): Promise<void> {
    try {
      await this.admin.deleteCollection(collection.id);
      this.toast.success(`${collection.name} deleted`);
      this.confirmingId.set(null);
      await this.load();
    } catch (error) {
      this.toast.error(error);
      this.confirmingId.set(null);
    } finally {
      this.cdr.markForCheck();
    }
  }

  protected patch(partial: Partial<CollectionFormValue>): void {
    this.form.update((value) => ({ ...value, ...partial }));
  }

  private applyServerErrors(error: unknown): void {
    if (!(error instanceof ApiError)) {
      return;
    }

    const serverErrors: Record<string, string> = {};

    for (const field of error.fieldErrors) {
      serverErrors[field.field] = field.message;
    }

    if (Object.keys(serverErrors).length > 0) {
      this.errors.update((current) => ({ ...current, ...serverErrors }));
    }
  }

  private emptyForm(): CollectionFormValue {
    return {
      name: '',
      slug: '',
      tagline: '',
      description: '',
      heroImage: undefined,
      thumbnail: undefined,
      themeColor: '#8a5a2b',
      products: [],
      isFeatured: false,
      isActive: true,
      sortOrder: 0,
    };
  }
}
