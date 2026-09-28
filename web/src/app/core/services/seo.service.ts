import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoInput {
  title: string;
  description?: string;
  image?: string;
  type?: string;
  canonicalPath?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly JSON_LD_ID = 'ox-structured-data';

  set(input: SeoInput): void {
    const fullTitle = input.title.includes('|') ? input.title : `${input.title} | Oxidised Jewellery`;

    this.titleService.setTitle(fullTitle);

    this.upsert('description', input.description ?? 'Handcrafted oxidised jewellery made in small batches.');

    this.metaService.updateTag({ property: 'og:title', content: fullTitle });

    if (input.description) {
      this.metaService.updateTag({ property: 'og:description', content: input.description });
    }

    this.metaService.updateTag({ property: 'og:type', content: input.type ?? 'website' });

    if (input.image) {
      this.metaService.updateTag({ property: 'og:image', content: input.image });
    }

    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: fullTitle });

    if (input.canonicalPath) {
      this.setCanonical(input.canonicalPath);
    }
  }

  setJsonLd(id: string, data: unknown): void {
    const elementId = `${this.JSON_LD_ID}-${id}`;
    let script = this.document.getElementById(elementId) as HTMLScriptElement | null;

    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.id = elementId;
      this.document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);
  }

  clearJsonLd(id: string): void {
    this.document.getElementById(`${this.JSON_LD_ID}-${id}`)?.remove();
  }

  /** Turns a site-relative path into the absolute URL structured data expects. */
  absoluteUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.document.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private upsert(name: string, content: string): void {
    this.metaService.updateTag({ name, content });
  }

  private setCanonical(path: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }

    link.href = this.absoluteUrl(path);
  }
}
