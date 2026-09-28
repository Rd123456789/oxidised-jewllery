import { Router } from 'express';
import * as controller from '../controllers/catalog.controller.js';
import { validate } from '../middleware/validate.js';
import { slugParamSchema } from '../validators/common.validator.js';
import { productQuerySchema, searchSuggestQuerySchema } from '../validators/catalog.validator.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

router.get('/search/suggest', validate({ query: searchSuggestQuerySchema }), controller.suggest);
router.get('/products', validate({ query: productQuerySchema }), controller.listProducts);
router.get('/products/facets', controller.getFacets);
router.get('/products/:slug', validate({ params: slugParamSchema }), controller.getProduct);
router.get(
  '/products/:slug/related',
  validate({ params: slugParamSchema }),
  controller.getRelatedProducts,
);
router.get('/products/:id/reviews', controller.listProductReviews);

router.get('/categories', controller.listCategories);
router.get('/categories/:slug', validate({ params: slugParamSchema }), controller.getCategory);

router.get('/collections', controller.listCollections);
router.get('/collections/:slug', validate({ params: slugParamSchema }), controller.getCollection);

router.get('/banners', optionalAuthenticate(), controller.listBanners);

export default router;
