import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ApiMeta, ManagedReview } from '../../../core/api/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateTime } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { RatingStars } from '../../../shared/components/rating-stars/rating-stars';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import type { BadgeTone } from '../../../shared/components/status-badge/status-badge';

type ReviewStatus = ManagedReview['status'] | 'all';

const TABS: { label: string; value: ReviewStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

const PAGE_SIZE = 20;

@Component({
  selector: 'admin-reviews-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, StatusBadge, RatingStars, Pagination, EmptyState],
  templateUrl: './reviews.page.html',
})
export class AdminReviewsPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly tabs = TABS;
  readonly ratings = [5, 4, 3, 2, 1];

  readonly reviews = signal<ManagedReview[]>([]);
  readonly meta = signal<ApiMeta>({});
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly status = signal<ReviewStatus>('pending');
  readonly rating = signal(0);
  readonly searchDraft = signal('');
  readonly search = signal('');
  readonly pendingCount = signal(0);

  readonly confirmingId = signal<string | null>(null);
  readonly replyingId = signal<string | null>(null);
  readonly replyDraft = signal('');
  readonly busyId = signal<string | null>(null);

  readonly formatDateTime = formatDateTime;

  readonly totalPages = computed(() => Number(this.meta().totalPages ?? 1) || 1);
  readonly total = computed(() => Number(this.meta().total ?? 0));

  readonly query = computed<Record<string, unknown>>(() => {
    const query: Record<string, unknown> = { page: this.page(), limit: PAGE_SIZE };

    if (this.status() !== 'all') {
      query['status'] = this.status();
    }

    if (this.rating() > 0) {
      query['rating'] = this.rating();
    }

    if (this.search()) {
      query['q'] = this.search();
    }

    return query;
  });

  constructor() {
    this.seo.set({ title: 'Reviews', description: 'Moderate product reviews.' });
    void this.load();
    void this.loadPendingCount();
  }

  statusTone(status: ManagedReview['status']): BadgeTone {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  setStatus(status: ReviewStatus): void {
    if (this.status() === status) {
      return;
    }

    this.status.set(status);
    this.page.set(1);
    void this.load();
  }

  setRating(rating: number): void {
    this.rating.set(this.rating() === rating ? 0 : rating);
    this.page.set(1);
    void this.load();
  }

  applySearch(): void {
    this.search.set(this.searchDraft().trim());
    this.page.set(1);
    void this.load();
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.search.set('');
    this.page.set(1);
    void this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  reload(): void {
    void this.load();
    void this.loadPendingCount();
  }

  startReply(review: ManagedReview): void {
    this.replyingId.set(review.id);
    this.replyDraft.set(review.adminReply?.message ?? '');
  }

  cancelReply(): void {
    this.replyingId.set(null);
    this.replyDraft.set('');
  }

  async approve(review: ManagedReview): Promise<void> {
    await this.moderate(review, 'approved', 'Review approved');
  }

  async reject(review: ManagedReview): Promise<void> {
    await this.moderate(review, 'rejected', 'Review rejected');
  }

  async submitReply(review: ManagedReview): Promise<void> {
    const reply = this.replyDraft().trim();

    this.busyId.set(review.id);

    try {
      await this.admin.moderateReview(review.id, { status: 'approved', adminReply: reply });
      this.toast.success('Reply published');
      this.cancelReply();
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  async remove(review: ManagedReview): Promise<void> {
    this.busyId.set(review.id);

    try {
      await this.admin.deleteReview(review.id);
      this.toast.success('Review deleted');
      this.confirmingId.set(null);
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  private async moderate(
    review: ManagedReview,
    status: ManagedReview['status'],
    message: string,
  ): Promise<void> {
    this.busyId.set(review.id);

    try {
      await this.admin.moderateReview(review.id, { status });
      this.toast.success(message);
      await this.reload();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const result = await this.admin.reviews(this.query());
      this.reviews.set(result.items);
      this.meta.set(result.meta);
    } catch (error) {
      this.failed.set(true);
      this.reviews.set([]);
      this.meta.set({});
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadPendingCount(): Promise<void> {
    try {
      const result = await this.admin.reviews({ status: 'pending', limit: 1 });
      this.pendingCount.set(Number(result.meta.total ?? result.items.length));
    } catch {
      this.pendingCount.set(0);
    } finally {
      this.cdr.markForCheck();
    }
  }
}
