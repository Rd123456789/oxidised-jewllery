import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { UploadService } from '../../../core/services/upload.service';
import { ToastService } from '../../../core/services/toast.service';
import type { ImageAsset } from '../../../core/api/api.models';
import { Icon } from '../icon/icon';

export interface UploadedImage extends ImageAsset {
  publicId?: string;
}

@Component({
  selector: 'app-image-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="space-y-3">
      @if (images().length > 0) {
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          @for (image of images(); track image.url; let i = $index) {
            <figure class="relative overflow-hidden rounded-lg border border-sand-deep bg-paper">
              <img
                [src]="image.url"
                [alt]="image.alt || 'Image ' + (i + 1)"
                class="aspect-square w-full object-cover"
                loading="lazy"
              />

              @if (image.isPrimary) {
                <figcaption class="ox-badge ox-badge--progress absolute left-1.5 top-1.5 shadow-sm">
                  Main
                </figcaption>
              }

              <!-- Always visible: the previous hover-only overlay was invisible until
                   the pointer happened to cross it, and unreachable on touch. -->
              <div class="absolute right-1.5 top-1.5 flex gap-1">
                @if (!image.isPrimary) {
                  <button
                    type="button"
                    class="ox-media-btn"
                    [attr.aria-label]="'Make image ' + (i + 1) + ' the main photo'"
                    title="Make main photo"
                    (click)="makePrimary(image.url)"
                  >
                    <app-icon name="star" [size]="14" />
                  </button>
                }

                <button
                  type="button"
                  class="ox-media-btn ox-media-btn--danger"
                  [attr.aria-label]="'Remove image ' + (i + 1)"
                  title="Remove image"
                  (click)="remove(image.url)"
                >
                  <app-icon name="trash" [size]="14" />
                </button>
              </div>

              @if (!image.isPrimary) {
                <figcaption
                  class="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/75 px-1.5 py-0.5 text-center text-[0.625rem] font-semibold uppercase tracking-wide text-ivory"
                >
                  Tap ★ for main
                </figcaption>
              }
            </figure>
          }
        </div>
      }

      <label
        class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-sand-deep bg-paper px-4 py-3 text-sm text-ink-soft transition hover:border-brass"
      >
        <app-icon name="image" [size]="16" />
        {{ uploading() ? 'Uploading…' : 'Add images' }}
        <input
          type="file"
          class="hidden"
          accept="image/png,image/jpeg,image/webp,image/avif"
          multiple
          [disabled]="uploading()"
          (change)="onFiles($event)"
        />
      </label>

      <p class="text-xs text-ink-muted">
        JPEG, PNG, WebP or AVIF. The first image is used as the main photo.
      </p>
    </div>
  `,
})
export class ImageUploader {
  private readonly uploads = inject(UploadService);
  private readonly toast = inject(ToastService);

  readonly images = input<UploadedImage[]>([]);
  readonly folder = input('products');
  readonly maxFiles = input(8);

  readonly imagesChange = output<UploadedImage[]>();

  readonly uploading = signal(false);

  async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (files.length === 0) {
      return;
    }

    const remaining = this.maxFiles() - this.images().length;

    if (remaining <= 0) {
      this.toast.info(`You can upload up to ${this.maxFiles()} images`);

      return;
    }

    this.uploading.set(true);

    try {
      const result = await this.uploads.upload(files.slice(0, remaining), this.folder());

      const next: UploadedImage[] = [
        ...this.images(),
        ...result.assets.map((asset, index) => ({
          url: asset.url,
          publicId: asset.publicId,
          alt: '',
          isPrimary: this.images().length === 0 && index === 0,
        })),
      ];

      this.imagesChange.emit(next);
      this.toast.success(`${result.assets.length} image(s) uploaded`);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  makePrimary(url: string): void {
    this.imagesChange.emit(
      this.images().map((image) => ({ ...image, isPrimary: image.url === url })),
    );
  }

  remove(url: string): void {
    const remaining = this.images().filter((image) => image.url !== url);

    if (remaining.length > 0 && !remaining.some((image) => image.isPrimary)) {
      remaining[0] = { ...remaining[0]!, isPrimary: true };
    }

    this.imagesChange.emit(remaining);
  }
}
