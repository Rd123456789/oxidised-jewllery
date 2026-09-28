import { Injectable, inject, signal } from '@angular/core';
import { ApiClient, type QueryParams } from '../api/api-client';
import type {
  ApiMeta,
  Banner,
  Category,
  Collection,
  Product,
  ProductFacets,
  ProductQuery,
  ProductReviewsResponse,
  ProductSummary,
  SearchSuggestions,
} from '../api/api.models';

export interface PagedResult<T> {
  items: T[];
  meta: ApiMeta;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiClient);

  private readonly categoriesSignal = signal<Category[]>([]);
  private categoriesLoaded = false;

  readonly categories = this.categoriesSignal.asReadonly();

  async listProducts(query: ProductQuery = {}): Promise<PagedResult<ProductSummary>> {
    const result = await this.api.getWithMeta<ProductSummary[]>(
      '/products',
      query as QueryParams,
    );

    return { items: result.data, meta: result.meta ?? {} };
  }

  async getProduct(slug: string): Promise<Product> {
    return this.api.get<Product>(`/products/${slug}`);
  }

  async suggest(term: string, limit = 6): Promise<SearchSuggestions> {
    return this.api.get<SearchSuggestions>('/search/suggest', { q: term, limit });
  }

  async getRelated(slug: string, limit = 8): Promise<ProductSummary[]> {
    return this.api.get<ProductSummary[]>(`/products/${slug}/related`, { limit });
  }

  async getFacets(categorySlug?: string): Promise<ProductFacets> {
    return this.api.get<ProductFacets>('/products/facets', { category: categorySlug });
  }

  async getReviews(slug: string): Promise<ProductReviewsResponse> {
    return this.api.get<ProductReviewsResponse>(`/products/${slug}/reviews`);
  }

  async getCategories(force = false): Promise<Category[]> {
    if (this.categoriesLoaded && !force) {
      return this.categoriesSignal();
    }

    const categories = await this.api.get<Category[]>('/categories');
    this.categoriesSignal.set(categories);
    this.categoriesLoaded = true;

    return categories;
  }

  async getCategory(slug: string): Promise<{ category: Category; children: Category[] }> {
    return this.api.get<{ category: Category; children: Category[] }>(`/categories/${slug}`);
  }

  async getCollections(): Promise<Collection[]> {
    return this.api.get<Collection[]>('/collections');
  }

  async getCollection(slug: string): Promise<{ collection: Collection; products: ProductSummary[] }> {
    return this.api.get<{ collection: Collection; products: ProductSummary[] }>(
      `/collections/${slug}`,
    );
  }

  async getBanners(position?: string): Promise<Banner[]> {
    return this.api.get<Banner[]>('/banners', { position });
  }
}
