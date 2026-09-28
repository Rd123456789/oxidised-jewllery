import { Schema, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

/**
 * Records the outcome of a mutating request that carried an `Idempotency-Key`.
 *
 * Redis would be the natural home for this, but the API stays dependency-free until
 * Phase 2, so a TTL collection keeps retries safe on the standalone database too.
 * `statusCode: 0` marks a request that is still in flight.
 */
export interface IdempotencyRecordDocument {
  key: string;
  method: string;
  path: string;
  userId: string;
  statusCode: number;
  response?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type IdempotencyRecordHydratedDocument = HydratedDocument<IdempotencyRecordDocument>;

const idempotencySchema = new Schema<IdempotencyRecordDocument>(
  {
    key: { type: String, required: true, maxlength: 200 },
    method: { type: String, required: true },
    path: { type: String, required: true },
    userId: { type: String, required: true, default: 'guest' },
    statusCode: { type: Number, required: true, default: 0 },
    response: { type: Schema.Types.Mixed },
  },
  schemaOptions,
);

idempotencySchema.index({ key: 1, method: 1, path: 1, userId: 1 }, { unique: true });
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const IdempotencyRecord = model<IdempotencyRecordDocument>(
  'IdempotencyRecord',
  idempotencySchema,
);
