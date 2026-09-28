import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CmsPage } from '../../../core/api/api.models';
import { AdminService, type PageInput } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate, slugify } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';

interface PageForm extends PageInput {
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
}

function blankForm(sortOrder: number): PageForm {
  return {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    isPublished: false,
    showInFooter: false,
    showInHeader: false,
    sortOrder,
    metaTitle: '',
    metaDescription: '',
    keywords: '',
  };
}

@Component({
  selector: 'admin-pages-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, EmptyState],
  templateUrl: './pages.page.html',
})
export class AdminPagesPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pages = signal<CmsPage[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly saving = signal(false);
  readonly confirmingId = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);

  readonly panelOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly preview = signal(false);
  readonly slugTouched = signal(false);
  readonly form = signal<PageForm>(blankForm(10));

  readonly formatDate = formatDate;

  pageUpdated(page: CmsPage): string | undefined {
    return (page as CmsPage & { updatedAt?: string }).updatedAt ?? page.createdAt;
  }

  constructor() {
    this.seo.set({ title: 'Pages', description: 'Manage CMS pages.' });
    void this.load();
  }

  reload(): void {
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.slugTouched.set(false);
    this.preview.set(false);
    this.form.set(blankForm(this.nextSortOrder()));
    this.panelOpen.set(true);
  }

  openEdit(page: CmsPage): void {
    this.editingId.set(page.id);
    this.slugTouched.set(true);
    this.preview.set(false);
    this.form.set({
      title: page.title,
      slug: page.slug,
      excerpt: page.excerpt ?? '',
      content: page.content,
      isPublished: page.isPublished,
      showInFooter: page.showInFooter,
      showInHeader: page.showInHeader,
      sortOrder: page.sortOrder,
      metaTitle: '',
      metaDescription: '',
      keywords: '',
    });
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.editingId.set(null);
  }

  patch(patch: Partial<PageForm>): void {
    this.form.update((form) => ({ ...form, ...patch }));
  }

  onTitle(value: string): void {
    this.form.update((form) => ({
      ...form,
      title: value,
      slug: this.slugTouched() ? form.slug : slugify(value),
    }));
  }

  onSlug(value: string): void {
    this.slugTouched.set(true);
    this.patch({ slug: slugify(value) });
  }

  togglePreview(): void {
    this.preview.update((value) => !value);
  }

  async save(): Promise<void> {
    const form = this.form();

    if (!form.title.trim()) {
      this.toast.error('Page title is required');
      return;
    }

    if (!form.slug.trim()) {
      this.toast.error('Page slug is required');
      return;
    }

    if (!form.content.trim()) {
      this.toast.error('Page content is required');
      return;
    }

    const payload: PageInput & {
      metaTitle: string;
      metaDescription: string;
      keywords: string;
    } = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || undefined,
      content: form.content,
      isPublished: form.isPublished,
      showInFooter: form.showInFooter,
      showInHeader: form.showInHeader,
      sortOrder: Number(form.sortOrder),
      metaTitle: form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
      keywords: form.keywords.trim(),
    };

    this.saving.set(true);

    try {
      const id = this.editingId();

      if (id) {
        await this.admin.updatePage(id, payload);
        this.toast.success('Page updated');
      } else {
        await this.admin.createPage(payload);
        this.toast.success('Page created');
      }

      this.closePanel();
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  async toggleFlag(page: CmsPage, patch: Partial<PageInput>): Promise<void> {
    this.togglingId.set(page.id);

    try {
      await this.admin.updatePage(page.id, patch);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.togglingId.set(null);
      this.cdr.markForCheck();
    }
  }

  async remove(page: CmsPage): Promise<void> {
    try {
      await this.admin.deletePage(page.id);
      this.toast.success(`Page "${page.title}" deleted`);
      this.confirmingId.set(null);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private nextSortOrder(): number {
    const pages = this.pages();

    if (pages.length === 0) {
      return 10;
    }

    return Math.max(...pages.map((page) => page.sortOrder)) + 10;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      this.pages.set(await this.admin.pages());
    } catch (error) {
      this.failed.set(true);
      this.pages.set([]);
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
