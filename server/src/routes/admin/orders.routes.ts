import { Router } from 'express';
import * as controller from '../../controllers/admin/order.admin.controller.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../validators/common.validator.js';
import { orderQuerySchema, updateOrderStatusSchema } from '../../validators/order.validator.js';
import { customerQuerySchema, customerUpdateSchema } from '../../validators/content.validator.js';

const router = Router();

router.get('/orders', validate({ query: orderQuerySchema }), controller.listOrders);
router.get('/orders/stats', controller.orderStats);
router.get('/orders/export', validate({ query: orderQuerySchema }), controller.exportOrders);
router.get('/orders/:orderNumber', controller.getOrder);
router.patch(
  '/orders/:orderNumber/status',
  validate({ body: updateOrderStatusSchema }),
  controller.updateStatus,
);

router.get('/customers', validate({ query: customerQuerySchema }), controller.listCustomers);
router.get('/customers/:id', validate({ params: idParamSchema }), controller.getCustomer);
router.patch(
  '/customers/:id',
  validate({ params: idParamSchema, body: customerUpdateSchema }),
  controller.updateCustomer,
);
router.delete('/customers/:id', validate({ params: idParamSchema }), controller.deleteCustomer);

export default router;
