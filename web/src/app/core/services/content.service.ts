import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import type { CmsPage, PageLink, PublicSettings } from '../api/api.models';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly api = inject(ApiClient);

  private readonly settingsSignal = signal<PublicSettings | null>(null);
  private readonly footerPagesSignal = signal<PageLink[]>([]);
  private readonly headerPagesSignal = signal<PageLink[]>([]);

  private settingsPromise: Promise<PublicSettings> | null = null;

  readonly settings = this.settingsSignal.asReadonly();
  readonly footerPages = this.footerPagesSignal.asReadonly();
  readonly headerPages = this.headerPagesSignal.asReadonly();

  /** Cached so the header, footer and checkout can all ask for it freely. */
  async loadSettings(): Promise<PublicSettings> {
    if (this.settingsSignal()) {
      return this.settingsSignal() as PublicSettings;
    }

    this.settingsPromise ??= this.api
      .get<PublicSettings>('/settings/public')
      .then((settings) => {
        this.settingsSignal.set(settings);

        return settings;
      })
      .finally(() => {
        this.settingsPromise = null;
      });

    return this.settingsPromise;
  }

  async loadFooterPages(): Promise<PageLink[]> {
    if (this.footerPagesSignal().length > 0) {
      return this.footerPagesSignal();
    }

    const pages = await this.api.get<PageLink[]>('/pages');
    this.footerPagesSignal.set(pages);

    return pages;
  }

  async loadHeaderPages(): Promise<PageLink[]> {
    if (this.headerPagesSignal().length > 0) {
      return this.headerPagesSignal();
    }

    const pages = await this.api.get<PageLink[]>('/pages/header');
    this.headerPagesSignal.set(pages);

    return pages;
  }

  async getPage(slug: string): Promise<CmsPage> {
    return this.api.get<CmsPage>(`/pages/${slug}`);
  }

  async subscribeToNewsletter(email: string, source = 'footer'): Promise<void> {
    await this.api.post('/newsletter/subscribe', { email, source });
  }
}
