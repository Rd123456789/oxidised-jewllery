import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  type OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import type { Category, Collection } from '../../../core/api/api.models';
import { AdminService, type ProductInput } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { slugify } from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import {
  ImageUploader,
  type UploadedImage,
} from '../../../shared/components/image-uploader/image-uploader';
import { PriceTag } from '../../../shared/components/price/price';

type VariantInput = NonNullable<ProductInput['variants']>[number];
type SpecificationInput = NonNullable<ProductInput['specifications']>[number];

@Component({
  selector: 'admin-product-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ImageUploader, PriceTag],
  templateUrl: './product-form.page.html',
})
export class AdminProductFormPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly id = input<string>();

  readonly form = signal<ProductInput>(this.emptyForm());
  readonly categories = signal<Category[]>([]);
  readonly collections = signal<Collection[]>([]);
  readonly errors = signal<Record<string, string>>({});
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly confirmingDelete = signal(false);

  readonly isEdit = computed(() => Boolean(this.id()));

  readonly marginPercent = computed(() => {
    const { price, costPrice } = this.form();

    if (!costPrice || !price) {
      return 0;
    }

    return Math.round(((price - costPrice) / price) * 100);
  });

  readonly primaryImage = computed(() => {
    const images = this.form().images ?? [];

    return images.find((image) => image.isPrimary) ?? images[0] ?? null;
  });

  readonly categoryName = computed(() => {
    const categoryId = this.form().category;

    return this.categories().find((category) => category.id === categoryId)?.name ?? 'Uncategorised';
  });

  readonly textOf = (event: Event): string =>
    (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

  readonly numberOf = (event: Event): number => Number(this.textOf(event)) || 0;

  readonly numberOrUndefined = (event: Event): number | undefined => {
    const value = this.textOf(event);

    return value.length === 0 ? undefined : Number(value);
  };

  readonly checkedOf = (event: Event): boolean => (event.target as HTMLInputElement).checked;

  readonly listOf = (event: Event): string[] =>
    this.textOf(event)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

  async ngOnInit(): Promise<void> {
    this.seo.set({
      title: this.isEdit() ? 'Edit product' : 'New product',
      description: 'Create or edit a catalogue product.',
      canonicalPath: '/admin/products',
    });

    void this.loadOptions();

    if (this.isEdit()) {
      await this.loadProduct();
    }

    this.cdr.markForCheck();
  }

  protected patch(partial: Partial<ProductInput>): void {
    this.form.update((value) => ({ ...value, ...partial }));
  }

  generateSlug(): void {
    const name = this.form().name;

    if (name.trim().length > 0) {
      this.patch({ slug: slugify(name) });
    }
  }

  onImages(images: UploadedImage[]): void {
    this.patch({ images });
  }

  onCollectionsChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.patch({ collections: Array.from(select.selectedOptions).map((option) => option.value) });
  }

  isCollectionSelected(id: string): boolean {
    return (this.form().collections ?? []).includes(id);
  }

  addVariant(): void {
    this.form.update((value) => ({
      ...value,
      variants: [...(value.variants ?? []), { name: '', sku: '', price: 0, stock: 0 }],
    }));
  }

  removeVariant(index: number): void {
    this.form.update((value) => ({
      ...value,
      variants: (value.variants ?? []).filter((_, position) => position !== index),
    }));
  }

  patchVariant(index: number, partial: Partial<VariantInput>): void {
    this.form.update((value) => ({
      ...value,
      variants: (value.variants ?? []).map((variant, position) =>
        position === index ? { ...variant, ...partial } : variant,
      ),
    }));
  }

  addSpecification(): void {
    this.form.update((value) => ({
      ...value,
      specifications: [...(value.specifications ?? []), { label: '', value: '' }],
    }));
  }

  removeSpecification(index: number): void {
    this.form.update((value) => ({
      ...value,
      specifications: (value.specifications ?? []).filter((_, position) => position !== index),
    }));
  }

  patchSpecification(index: number, partial: Partial<SpecificationInput>): void {
    this.form.update((value) => ({
      ...value,
      specifications: (value.specifications ?? []).map((specification, position) =>
        position === index ? { ...specification, ...partial } : specification,
      ),
    }));
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.saving() || !this.validate()) {
      return;
    }

    this.saving.set(true);
    const payload = this.buildPayload();

    try {
      if (this.isEdit()) {
        const id = this.id();

        if (!id) {
          return;
        }

        await this.admin.updateProduct(id, payload);
        this.toast.success('Product updated');
      } else {
        await this.admin.createProduct(payload);
        this.toast.success('Product created');
      }

      await this.router.navigate(['/admin/products']);
    } catch (error) {
      this.applyServerErrors(error);
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    void this.router.navigate(['/admin/products']);
  }

  askDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  async confirmDelete(): Promise<void> {
    const id = this.id();

    if (!id || this.saving()) {
      return;
    }

    this.saving.set(true);

    try {
      await this.admin.deleteProduct(id);
      this.toast.success('Product deleted');
      await this.router.navigate(['/admin/products']);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.confirmingDelete.set(false);
      this.cdr.markForCheck();
    }
  }

  private validate(): boolean {
    const value = this.form();
    const errors: Record<string, string> = {};

    if (!value.name || value.name.trim().length < 2) {
      errors['name'] = 'Name must be at least 2 characters.';
    }

    if (!value.category) {
      errors['category'] = 'Choose a category.';
    }

    if (value.price === undefined || value.price === null || Number.isNaN(value.price) || value.price < 0) {
      errors['price'] = 'Price must be 0 or more.';
    }

    (value.variants ?? []).forEach((variant, index) => {
      if (!variant.name || variant.name.trim().length === 0) {
        errors[`variant-${index}-name`] = 'Variant name is required.';
      }

      if (!variant.sku || variant.sku.trim().length === 0) {
        errors[`variant-${index}-sku`] = 'Variant SKU is required.';
      }

      if (variant.price === undefined || variant.price === null || Number.isNaN(variant.price) || variant.price < 0) {
        errors[`variant-${index}-price`] = 'Variant price is required.';
      }
    });

    this.errors.set(errors);

    if (Object.keys(errors).length > 0) {
      this.toast.error('Please fix the highlighted fields.');

      return false;
    }

    return true;
  }

  private buildPayload(): ProductInput {
    const value = this.form();

    return {
      ...value,
      name: value.name.trim(),
      slug: value.slug?.trim() ?? '',
      sku: value.sku?.trim() ?? '',
    };
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

  private async loadOptions(): Promise<void> {
    try {
      const [categories, collections] = await Promise.all([
        this.admin.categories(),
        this.admin.collections(),
      ]);

      this.categories.set(categories);
      this.collections.set(collections);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async loadProduct(): Promise<void> {
    const id = this.id();

    if (!id) {
      return;
    }

    this.loading.set(true);

    try {
      const product = await this.admin.product(id);

      this.form.set({
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        shortDescription: product.shortDescription ?? '',
        description: product.description ?? '',
        category: product.category.id,
        collections: product.collections?.map((collection) => collection.id) ?? [],
        tags: product.tags ?? [],
        price: product.price,
        mrp: product.mrp,
        costPrice: product.costPrice,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        images: product.images ?? [],
        variants: product.variants ?? [],
        colors: product.colors ?? [],
        materials: product.materials ?? [],
        stones: product.stones ?? [],
        occasions: product.occasions ?? [],
        specifications: product.specifications ?? [],
        weightGrams: product.weightGrams,
        careInstructions: product.careInstructions ?? '',
        isFeatured: product.isFeatured,
        isNewArrival: product.isNewArrival,
        isBestSeller: product.isBestSeller,
        isActive: product.isActive,
        metaTitle: product.metaTitle ?? '',
        metaDescription: product.metaDescription ?? '',
        keywords: product.keywords ?? [],
      });
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private emptyForm(): ProductInput {
    return {
      name: '',
      slug: '',
      sku: '',
      shortDescription: '',
      description: '',
      category: '',
      collections: [],
      tags: [],
      price: 0,
      mrp: undefined,
      costPrice: undefined,
      stock: 0,
      lowStockThreshold: undefined,
      images: [],
      variants: [],
      colors: [],
      materials: [],
      stones: [],
      occasions: [],
      specifications: [],
      weightGrams: undefined,
      careInstructions: '',
      isActive: true,
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      metaTitle: '',
      metaDescription: '',
      keywords: [],
    };
  }
}
