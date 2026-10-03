import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { replyToChat } from '../services/chat.service.js';
import { chatSchema } from '../validators/chat.validator.js';
import type { ChatInput } from '../services/chat.service.js';

const router = Router();

/**
 * Public and guest-allowed on purpose: the questions worth asking — "is this in stock?", "how do I
 * stop it tarnishing?" — are exactly the ones a shopper asks before they have an account, and
 * blocking them would defeat the point.
 *
 * `writeLimiter` rather than nothing, because each message costs a catalog query and a settings read.
 */
router.post(
  '/chat',
  writeLimiter,
  validate({ body: chatSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as ChatInput;

    sendSuccess(res, await replyToChat(body));
  }),
);

export default router;