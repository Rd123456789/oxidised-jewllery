import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../../core/api/api-error';
import type { Category } from '../../../core/api/api.models';
import { AdminService, type CategoryInput } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { slugify } from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import {
  ImageUploader,
  type UploadedImage,
} from '../../../shared/components/image-uploader/image-uploader';

type CategoryPayload = CategoryInput & {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
};

interface CategoryFormValue extends CategoryPayload {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

@Component({
  selector: 'admin-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ImageUploader],
  templateUrl: './categories.page.html',
})
export class AdminCategoriesPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly categories = signal<Category[]>([]);
  readonly form = signal<CategoryFormValue>(this.emptyForm());
  readonly errors = signal<Record<string, string>>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly confirmingId = signal<string | null>(null);

  readonly isEditing = computed(() => this.editingId() !== null);

  readonly parentOptions = computed(() =>
    this.categories().filter((category) => category.id !== this.editingId()),
  );

  readonly textOf = (event: Event): string =>
    (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

  readonly numberOf = (event: Event): number => Number(this.textOf(event)) || 0;

  readonly checkedOf = (event: Event): boolean => (event.target as HTMLInputElement).checked;

  readonly listOf = (event: Event): string[] =>
    this.textOf(event)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

  constructor() {
    this.seo.set({
      title: 'Categories',
      description: 'Organise the storefront catalogue.',
      canonicalPath: '/admin/categories',
    });

    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);

    try {
      const categories = await this.admin.categories();
      this.categories.set(
        [...categories].sort((first, second) => first.sortOrder - second.sortOrder),
      );
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
    this.form.set(this.emptyForm());
  }

  startEdit(category: Category): void {
    const parent = category.parent;
    const parentId = !parent ? null : typeof parent === 'string' ? parent : parent.id;

    this.editingId.set(category.id);
    this.errors.set({});
    this.form.set({
      name: category.name,
      slug: category.slug,
      shortDescription: category.shortDescription ?? '',
      description: category.description ?? '',
      image: category.image,
      icon: category.icon ?? '',
      parent: parentId,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      isFeatured: category.isFeatured,
      metaTitle: '',
      metaDescription: '',
      keywords: [],
    });
  }

  cancelEdit(): void {
    this.startCreate();
  }

  onName(event: Event): void {
    const name = this.textOf(event);
    const partial: Partial<CategoryFormValue> = { name };

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

  onImages(images: UploadedImage[]): void {
    const first = images[0];

    this.patch({
      image: first ? { url: first.url, publicId: first.publicId, alt: first.alt } : undefined,
    });
  }

  formImages(): UploadedImage[] {
    const image = this.form().image;

    return image ? [image] : [];
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

    const payload: CategoryPayload = {
      ...value,
      name: value.name.trim(),
      slug: value.slug?.trim() || undefined,
    };

    this.saving.set(true);

    try {
      const editing = this.editingId();

      if (editing) {
        await this.admin.updateCategory(editing, payload);
        this.toast.success('Category updated');
      } else {
        await this.admin.createCategory(payload);
        this.toast.success('Category created');
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

  async move(index: number, direction: -1 | 1): Promise<void> {
    const list = [...this.categories()];
    const target = index + direction;

    if (target < 0 || target >= list.length) {
      return;
    }

    const current = list[index]!;
    const neighbour = list[target]!;

    list[index] = { ...current, sortOrder: neighbour.sortOrder };
    list[target] = { ...neighbour, sortOrder: current.sortOrder };

    const reordered = [...list].sort((first, second) => first.sortOrder - second.sortOrder);
    this.categories.set(reordered);

    try {
      await this.admin.reorderCategories(
        list.map((category) => ({ id: category.id, sortOrder: category.sortOrder })),
      );
    } catch (error) {
      this.toast.error(error);
      await this.load();
    } finally {
      this.cdr.markForCheck();
    }
  }

  askDelete(id: string): void {
    this.confirmingId.set(id);
  }

  cancelDelete(): void {
    this.confirmingId.set(null);
  }

  async confirmDelete(category: Category): Promise<void> {
    try {
      await this.admin.deleteCategory(category.id);
      this.toast.success(`${category.name} deleted`);
      this.confirmingId.set(null);
      await this.load();
    } catch (error) {
      this.toast.error(error);
      this.confirmingId.set(null);
    } finally {
      this.cdr.markForCheck();
    }
  }

  parentName(category: Category): string {
    const parent = category.parent;

    if (!parent) {
      return '—';
    }

    if (typeof parent === 'string') {
      return this.categories().find((entry) => entry.id === parent)?.name ?? '—';
    }

    return parent.name;
  }

  protected patch(partial: Partial<CategoryFormValue>): void {
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

  private emptyForm(): CategoryFormValue {
    return {
      name: '',
      slug: '',
      shortDescription: '',
      description: '',
      image: undefined,
      icon: '',
      parent: null,
      sortOrder: 0,
      isActive: true,
      isFeatured: false,
      metaTitle: '',
      metaDescription: '',
      keywords: [],
    };
  }
}
