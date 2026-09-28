import type { Request, Response } from 'express';
import { Category } from '../../models/category.model.js';
import { Collection } from '../../models/collection.model.js';
import { Product } from '../../models/product.model.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../../utils/http.js';
import { buildPaginationMeta, buildSort, parsePagination } from '../../utils/query.js';
import { ensureUniqueSlug, generateSku } from '../../utils/slug.js';
import * as catalogService from '../../services/catalog.service.js';
import type {
  CategoryCreateInput,
  CollectionCreateInput,
  ProductCreateInput,
  ProductQueryInput,
} from '../../validators/catalog.validator.js';

function adminQuery(req: Request): ProductQueryInput {
  return (req.validatedQuery ?? {}) as ProductQueryInput;
}

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.listAdminProducts(adminQuery(req));

  sendSuccess(res, result.items, { meta: result.meta });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params['id'])
    .populate('category', 'name slug')
    .populate('collections', 'name slug');

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as ProductCreateInput;

  const slug = await ensureUniqueSlug(Product, input.slug ?? input.name);
  const sku = input.sku ?? generateSku('OX', input.name);

  const product = await Product.create({
    ...input,
    slug,
    sku,
    publishedAt: input.publishedAt ?? new Date(),
  });

  await Category.updateOne({ _id: product.category }, { $inc: { productCount: 1 } });

  sendSuccess(res, product, { status: 201, message: 'Product created' });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as Partial<ProductCreateInput>;
  const product = await Product.findById(req.params['id']);

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const previousCategory = product.category;

  if (input.slug && input.slug !== product.slug) {
    input.slug = await ensureUniqueSlug(Product, input.slug, String(product._id));
  }

  Object.assign(product, input);
  await product.save();

  if (input.category && String(input.category) !== String(previousCategory)) {
    await catalogService.syncCategoryProductCounts();
  }

  sendSuccess(res, product, { message: 'Product updated' });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const hard = req.query['hard'] === 'true';
  const product = await Product.findById(req.params['id']);

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (hard) {
    await product.deleteOne();
  } else {
    product.isActive = false;
    await product.save();
  }

  await catalogService.syncCategoryProductCounts();

  sendSuccess(res, { deleted: true, hard });
});

export const duplicateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params['id']).lean();

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const { _id, slug, sku, createdAt, updatedAt, ...rest } = product;

  const copy = await Product.create({
    ...rest,
    name: `${product.name} (copy)`,
    slug: await ensureUniqueSlug(Product, `${product.slug}-copy`),
    sku: generateSku('OX', `${product.name}copy`),
    isActive: false,
    ratingsAverage: 0,
    ratingsCount: 0,
    soldCount: 0,
    viewCount: 0,
  });

  sendSuccess(res, copy, { status: 201, message: 'Product duplicated as a draft' });
});

export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as { stock: number; lowStockThreshold?: number };

  const product = await Product.findByIdAndUpdate(
    req.params['id'],
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  sendSuccess(res, product, { message: 'Stock updated' });
});

export const updateVariantStock = asyncHandler(async (req: Request, res: Response) => {
  const { sku, stock } = req.body as { sku: string; stock: number };

  const product = await Product.findOneAndUpdate(
    { _id: req.params['id'], 'variants.sku': sku.toUpperCase() },
    { $set: { 'variants.$.stock': stock } },
    { returnDocument: 'after', runValidators: true },
  );

  if (!product) {
    throw ApiError.notFound('Product or variant not found');
  }

  await Product.updateOne({ _id: product._id }, [{ $set: { stock: { $sum: '$variants.stock' } } }]);

  sendSuccess(res, product, { message: 'Variant stock updated' });
});

export const toggleProductFlags = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as Partial<
    Pick<ProductCreateInput, 'isActive' | 'isFeatured' | 'isNewArrival' | 'isBestSeller'>
  >;

  const product = await Product.findByIdAndUpdate(
    req.params['id'],
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  sendSuccess(res, product, { message: 'Product updated' });
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const pagination = parsePagination({});
  const [categories, total] = await Promise.all([
    Category.find()
      .sort(buildSort('sortOrder', ['sortOrder', 'name', 'createdAt']))
      .skip(pagination.skip)
      .limit(200)
      .populate('parent', 'name slug')
      .lean(),
    Category.countDocuments({}),
  ]);

  sendSuccess(res, categories, { meta: buildPaginationMeta(total, { ...pagination, limit: 200 }) });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CategoryCreateInput;

  const category = await Category.create({
    ...input,
    slug: await ensureUniqueSlug(Category, input.slug ?? input.name),
  });

  sendSuccess(res, category, { status: 201, message: 'Category created' });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as Partial<CategoryCreateInput>;
  const category = await Category.findById(req.params['id']);

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  if (input.slug && input.slug !== category.slug) {
    input.slug = await ensureUniqueSlug(Category, input.slug, String(category._id));
  }

  Object.assign(category, input);
  await category.save();

  sendSuccess(res, category, { message: 'Category updated' });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'];

  const productCount = await Product.countDocuments({ category: id, isActive: true });

  if (productCount > 0) {
    throw ApiError.conflict(
      `This category still has ${productCount} active product(s). Move or deactivate them first.`,
    );
  }

  const childCount = await Category.countDocuments({ parent: id });

  if (childCount > 0) {
    throw ApiError.conflict('This category has sub-categories. Remove them first.');
  }

  await Category.findByIdAndDelete(id);

  sendSuccess(res, { deleted: true });
});

export const reorderCategories = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; sortOrder: number }[] };

  await Promise.all(
    items.map((item) =>
      Category.updateOne({ _id: item.id }, { $set: { sortOrder: item.sortOrder } }),
    ),
  );

  sendSuccess(res, { reordered: items.length });
});

export const listCollections = asyncHandler(async (_req: Request, res: Response) => {
  const collections = await Collection.find()
    .sort({ sortOrder: 1, name: 1 })
    .populate('products', 'name slug price')
    .lean();

  sendSuccess(res, collections);
});

export const createCollection = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CollectionCreateInput;

  const collection = await Collection.create({
    ...input,
    slug: await ensureUniqueSlug(Collection, input.slug ?? input.name),
  });

  sendSuccess(res, collection, { status: 201, message: 'Collection created' });
});

export const updateCollection = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as Partial<CollectionCreateInput>;
  const collection = await Collection.findById(req.params['id']);

  if (!collection) {
    throw ApiError.notFound('Collection not found');
  }

  if (input.slug && input.slug !== collection.slug) {
    input.slug = await ensureUniqueSlug(Collection, input.slug, String(collection._id));
  }

  Object.assign(collection, input);
  await collection.save();

  sendSuccess(res, collection, { message: 'Collection updated' });
});

export const deleteCollection = asyncHandler(async (req: Request, res: Response) => {
  const collection = await Collection.findByIdAndDelete(req.params['id']);

  if (!collection) {
    throw ApiError.notFound('Collection not found');
  }

  sendSuccess(res, { deleted: true });
});

export const reorderCollections = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; sortOrder: number }[] };

  await Promise.all(
    items.map((item) =>
      Collection.updateOne({ _id: item.id }, { $set: { sortOrder: item.sortOrder } }),
    ),
  );

  sendSuccess(res, { reordered: items.length });
});
