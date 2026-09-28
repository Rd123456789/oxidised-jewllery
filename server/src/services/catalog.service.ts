import { Types, type QueryFilter, type SortOrder } from 'mongoose';
import { Category } from '../models/category.model.js';
import { Collection } from '../models/collection.model.js';
import {
  Product,
  toProductListItem,
  type ProductDocument,
  type ProductListSource,
} from '../models/product.model.js';
import { ApiError } from '../utils/apiError.js';
import { buildPaginationMeta, buildSort, escapeRegex, parsePagination } from '../utils/query.js';
import type { ProductQueryInput } from '../validators/catalog.validator.js';

const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'price',
  'ratingsAverage',
  'soldCount',
  'name',
  'viewCount',
];

function caseInsensitiveIn(values: string[]): RegExp[] {
  return values.map((value) => new RegExp(`^${escapeRegex(value)}$`, 'i'));
}

/**
 * MongoDB's `$text` ORs bare terms, so "oxidised jhumka" matched the entire catalogue
 * because every product name contains "oxidised". Quoting each term switches the terms
 * to AND, so a shopper searching "oxidised jhumka" gets only pieces matching every word.
 */
function toTextSearch(term: string): string {
  const terms = term
    .split(/\s+/)
    .map((value) => value.replace(/["\\]/g, '').trim())
    .filter(Boolean);

  return terms.length > 0 ? terms.map((value) => `"${value}"`).join(' ') : term;
}

function buildProductFilter(
  input: ProductQueryInput,
  categoryIds: Types.ObjectId[] = [],
  collectionId?: Types.ObjectId,
): QueryFilter<ProductDocument> {
  const filter: QueryFilter<ProductDocument> = {};

  const status = input.status ?? 'active';

  if (status === 'active') {
    filter.isActive = true;
  } else if (status === 'draft') {
    filter.isActive = false;
  } else if (status === 'out_of_stock') {
    filter.isActive = true;
    filter.stock = { $lte: 0 };
  }

  if (categoryIds.length === 1) {
    filter.category = categoryIds[0];
  } else if (categoryIds.length > 1) {
    filter.category = { $in: categoryIds };
  }

  if (collectionId) {
    filter.$or = [{ collections: collectionId }, { _id: { $in: [collectionId] } }];
  }

  const priceFilter: Record<string, number> = {};
  if (input.minPrice !== undefined) {
    priceFilter['$gte'] = input.minPrice;
  }
  if (input.maxPrice !== undefined) {
    priceFilter['$lte'] = input.maxPrice;
  }
  if (Object.keys(priceFilter).length > 0) {
    filter.price = priceFilter;
  }

  if (input.colors?.length) {
    filter.colors = { $in: caseInsensitiveIn(input.colors) };
  }
  if (input.materials?.length) {
    filter.materials = { $in: caseInsensitiveIn(input.materials) };
  }
  if (input.stones?.length) {
    filter.stones = { $in: caseInsensitiveIn(input.stones) };
  }
  if (input.occasions?.length) {
    filter.occasions = { $in: caseInsensitiveIn(input.occasions) };
  }
  if (input.tags?.length) {
    filter.tags = { $in: caseInsensitiveIn(input.tags) };
  }

  if (input.inStock === true) {
    filter.stock = { $gt: 0 };
  }

  if (input.featured) {
    filter.isFeatured = true;
  }
  if (input.newArrival) {
    filter.isNewArrival = true;
  }
  if (input.bestSeller) {
    filter.isBestSeller = true;
  }
  if (input.onSale) {
    filter.$expr = { $gt: ['$mrp', '$price'] };
  }
  if (input.minRating !== undefined) {
    filter.ratingsAverage = { $gte: input.minRating };
  }
  if (input.q) {
    filter.$text = { $search: toTextSearch(input.q) };
  }

  return filter;
}

async function resolveCategoryIds(slug: string): Promise<Types.ObjectId[]> {
  const category = await Category.findOne({ slug }).select('_id');

  if (!category) {
    return [];
  }

  const children = await Category.find({ parent: category._id }).select('_id');

  return [category._id, ...children.map((child) => child._id)];
}

export interface ProductListResult {
  items: ReturnType<typeof toProductListItem>[];
  meta: ReturnType<typeof buildPaginationMeta> & { hasNextPage: boolean; hasPrevPage: boolean };
}

export async function listProducts(input: ProductQueryInput): Promise<ProductListResult> {
  const pagination = parsePagination(input as Record<string, unknown>);

  let categoryIds: Types.ObjectId[] = [];
  if (input.category) {
    categoryIds = await resolveCategoryIds(input.category);

    if (categoryIds.length === 0) {
      return {
        items: [],
        meta: {
          ...buildPaginationMeta(0, pagination),
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }
  }

  let collectionId: Types.ObjectId | undefined;
  if (input.collection) {
    const collection = await Collection.findOne({ slug: input.collection }).select('_id');

    if (!collection) {
      return {
        items: [],
        meta: {
          ...buildPaginationMeta(0, pagination),
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    collectionId = collection._id;
  }

  const filter = buildProductFilter(input, categoryIds, collectionId);
  const fallbackSort: Record<string, SortOrder> = { isFeatured: -1, createdAt: -1 };
  const sort = buildSort(input.sort, PRODUCT_SORT_FIELDS, fallbackSort);

  let query = Product.find(filter);

  if (input.q && !input.sort) {
    query = query
      .select({ score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } } as unknown as Record<string, SortOrder>);
  } else {
    query = query.sort(sort);
  }

  const [documents, total] = await Promise.all([
    query
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('category', 'name slug')
      .lean(),
    Product.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, pagination);

  return {
    items: documents.map((document) =>
      toProductListItem(document as unknown as ProductListSource),
    ),
    meta: {
      ...meta,
      hasNextPage: meta.page < meta.totalPages,
      hasPrevPage: meta.page > 1,
    },
  };
}

export async function listAdminProducts(input: ProductQueryInput): Promise<ProductListResult> {
  // The admin list defaults to every status so drafts and sold-out pieces stay visible.
  return listProducts({ ...input, status: input.status ?? 'all' });
}

export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, isActive: true })
    .select('-costPrice')
    .populate('category', 'name slug')
    .populate('collections', 'name slug themeColor');

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  void Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } });

  return product;
}

export async function getProductById(id: string) {
  const product = await Product.findById(id)
    .populate('category', 'name slug')
    .populate('collections', 'name slug themeColor');

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  return product;
}

export async function getRelatedProducts(slug: string, limit = 8) {
  const product = await Product.findOne({ slug, isActive: true }).select('_id category');

  if (!product) {
    return [];
  }

  const documents = await Product.find({
    isActive: true,
    _id: { $ne: product._id },
    category: product.category,
  })
    .sort({ soldCount: -1, ratingsAverage: -1, createdAt: -1 })
    .limit(limit)
    .populate('category', 'name slug')
    .lean();

  if (documents.length >= 4) {
    return documents.map((document) => toProductListItem(document as unknown as ProductListSource));
  }

  const fallback = await Product.find({
    isActive: true,
    _id: { $ne: product._id, $nin: documents.map((document) => document._id) },
  })
    .sort({ isFeatured: -1, soldCount: -1 })
    .limit(limit - documents.length)
    .populate('category', 'name slug')
    .lean();

  return [...documents, ...fallback].map((document) =>
    toProductListItem(document as unknown as ProductListSource),
  );
}

export interface SearchSuggestProduct {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  mrp?: number;
  currency: string;
  inStock: boolean;
}

export interface SearchSuggestCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface SearchSuggestCollection {
  id: string;
  name: string;
  slug: string;
}

export interface SearchSuggestions {
  query: string;
  products: SearchSuggestProduct[];
  categories: SearchSuggestCategory[];
  collections: SearchSuggestCollection[];
}

/**
 * Lightweight typeahead for the header search.
 *
 * Prefix matching on name/tags/colours keeps result sets small and index-friendly;
 * the full `$text` search (with `toTextSearch` AND semantics) still powers `/products?q=`.
 */
export async function suggestSearch(term: string, limit = 6): Promise<SearchSuggestions> {
  const query = term.trim();

  if (query.length < 2) {
    return { query, products: [], categories: [], collections: [] };
  }

  const safe = escapeRegex(query);
  const prefix = new RegExp(`^${safe}`, 'i');
  const contains = new RegExp(safe, 'i');

  const [products, categories, collections] = await Promise.all([
    Product.find({
      isActive: true,
      $or: [{ name: prefix }, { tags: prefix }, { colors: prefix }],
    })
      .sort({ soldCount: -1, viewCount: -1, createdAt: -1 })
      .limit(limit)
      .select('name slug price mrp currency stock variants images')
      .lean(),
    Category.find({ isActive: true, name: contains })
      .sort({ sortOrder: 1, name: 1 })
      .limit(4)
      .select('name slug productCount')
      .lean(),
    Collection.find({ isActive: true, name: contains })
      .sort({ sortOrder: 1, name: 1 })
      .limit(4)
      .select('name slug')
      .lean(),
  ]);

  return {
    query,
    products: products.map((product) => ({
      id: String(product._id),
      name: product.name,
      slug: product.slug,
      image: (product.images?.find((image) => image.isPrimary) ?? product.images?.[0])?.url,
      price: product.price,
      mrp: product.mrp,
      currency: product.currency,
      inStock:
        product.variants && product.variants.length > 0
          ? product.variants.some((variant) => variant.isActive && variant.stock > 0)
          : product.stock > 0,
    })),
    categories: categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      productCount: category.productCount ?? 0,
    })),
    collections: collections.map((collection) => ({
      id: String(collection._id),
      name: collection.name,
      slug: collection.slug,
    })),
  };
}

export interface ProductFacets {
  colors: string[];
  materials: string[];
  stones: string[];
  occasions: string[];
  tags: string[];
  priceRange: { min: number; max: number };
}

export async function getProductFacets(categorySlug?: string): Promise<ProductFacets> {
  const match: QueryFilter<ProductDocument> = { isActive: true };

  if (categorySlug) {
    const ids = await resolveCategoryIds(categorySlug);

    if (ids.length > 0) {
      match.category = { $in: ids };
    }
  }

  const [colors, materials, stones, occasions, tags, priceAggregation] = await Promise.all([
    Product.distinct('colors', match),
    Product.distinct('materials', match),
    Product.distinct('stones', match),
    Product.distinct('occasions', match),
    Product.distinct('tags', match),
    Product.aggregate<{ min: number; max: number }>([
      { $match: match },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]),
  ]);

  const priceStats = priceAggregation[0];

  return {
    colors: (colors as string[]).filter(Boolean).sort(),
    materials: (materials as string[]).filter(Boolean).sort(),
    stones: (stones as string[]).filter(Boolean).sort(),
    occasions: (occasions as string[]).filter(Boolean).sort(),
    tags: (tags as string[]).filter(Boolean).sort(),
    priceRange: {
      min: Math.floor(priceStats?.min ?? 0),
      max: Math.ceil(priceStats?.max ?? 5000),
    },
  };
}

export async function listCategories(options: { includeInactive?: boolean } = {}) {
  return Category.find(options.includeInactive ? {} : { isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
}

export async function getCategoryBySlug(slug: string) {
  const category = await Category.findOne({ slug, isActive: true }).lean();

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const children = await Category.find({ parent: category._id, isActive: true })
    .sort({ sortOrder: 1 })
    .lean();

  return { category, children };
}

export async function listCollections(options: { includeInactive?: boolean } = {}) {
  const collections = await Collection.find(options.includeInactive ? {} : { isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const ids = collections.map((collection) => collection._id);

  if (ids.length === 0) {
    return collections.map((collection) => ({ ...collection, productCount: 0 }));
  }

  // Products reference collections, not the other way round, so the collection's own
  // `products` array is never populated. Count live products per collection instead.
  const counts = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { isActive: true, collections: { $in: ids } } },
    { $unwind: '$collections' },
    { $match: { collections: { $in: ids } } },
    { $group: { _id: '$collections', count: { $sum: 1 } } },
  ]);

  const countById = new Map(counts.map((entry) => [String(entry._id), entry.count]));

  return collections.map((collection) => ({
    ...collection,
    productCount: countById.get(String(collection._id)) ?? 0,
  }));
}

export async function getCollectionBySlug(slug: string) {
  const collection = await Collection.findOne({ slug, isActive: true }).lean();

  if (!collection) {
    throw ApiError.notFound('Collection not found');
  }

  const products = await Product.find({ isActive: true, collections: collection._id })
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(24)
    .populate('category', 'name slug')
    .lean();

  return {
    collection,
    products: products.map((product) => toProductListItem(product as unknown as ProductListSource)),
  };
}

export async function syncCategoryProductCounts(): Promise<void> {
  const counts = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const countByCategory = new Map(
    counts.map((entry) => [String(entry._id), entry.count] as const),
  );

  const categories = await Category.find().select('_id');

  await Promise.all(
    categories.map((category) =>
      Category.updateOne(
        { _id: category._id },
        { productCount: countByCategory.get(String(category._id)) ?? 0 },
      ),
    ),
  );
}
