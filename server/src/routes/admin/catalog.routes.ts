import { Router } from 'express';
import * as controller from '../../controllers/admin/catalog.admin.controller.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../validators/common.validator.js';
import {
  catalogReorderSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  collectionCreateSchema,
  collectionUpdateSchema,
  productCreateSchema,
  productQuerySchema,
  productStockUpdateSchema,
  productUpdateSchema,
  variantStockUpdateSchema,
} from '../../validators/catalog.validator.js';
import { z } from 'zod';

const router = Router();

router.get('/products', validate({ query: productQuerySchema }), controller.listProducts);
router.post('/products', validate({ body: productCreateSchema }), controller.createProduct);
router.get('/products/:id', validate({ params: idParamSchema }), controller.getProduct);
router.put(
  '/products/:id',
  validate({ params: idParamSchema, body: productUpdateSchema }),
  controller.updateProduct,
);
router.delete('/products/:id', validate({ params: idParamSchema }), controller.deleteProduct);
router.post(
  '/products/:id/duplicate',
  validate({ params: idParamSchema }),
  controller.duplicateProduct,
);
router.patch(
  '/products/:id/stock',
  validate({ params: idParamSchema, body: productStockUpdateSchema }),
  controller.updateStock,
);
router.patch(
  '/products/:id/variant-stock',
  validate({ params: idParamSchema, body: variantStockUpdateSchema }),
  controller.updateVariantStock,
);
router.patch(
  '/products/:id/flags',
  validate({
    params: idParamSchema,
    body: z
      .object({
        isActive: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        isNewArrival: z.boolean().optional(),
        isBestSeller: z.boolean().optional(),
      })
      .strict(),
  }),
  controller.toggleProductFlags,
);

router.get('/categories', controller.listCategories);
router.post('/categories', validate({ body: categoryCreateSchema }), controller.createCategory);
router.put(
  '/categories/:id',
  validate({ params: idParamSchema, body: categoryUpdateSchema }),
  controller.updateCategory,
);
router.delete('/categories/:id', validate({ params: idParamSchema }), controller.deleteCategory);
router.patch('/categories/reorder', validate({ body: catalogReorderSchema }), controller.reorderCategories);

router.get('/collections', controller.listCollections);
router.post('/collections', validate({ body: collectionCreateSchema }), controller.createCollection);
router.put(
  '/collections/:id',
  validate({ params: idParamSchema, body: collectionUpdateSchema }),
  controller.updateCollection,
);
router.delete(
  '/collections/:id',
  validate({ params: idParamSchema }),
  controller.deleteCollection,
);
router.patch(
  '/collections/reorder',
  validate({ body: catalogReorderSchema }),
  controller.reorderCollections,
);

export default router;
