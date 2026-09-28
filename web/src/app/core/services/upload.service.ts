import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client';
import type { UploadResult } from '../api/api.models';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly api = inject(ApiClient);

  async upload(files: File[], folder = 'products'): Promise<UploadResult> {
    return this.api.upload<UploadResult>('/admin/uploads', files, { folder });
  }

  async remove(publicId: string): Promise<void> {
    await this.api.delete('/admin/uploads', { publicId });
  }
}
