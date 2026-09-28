import type { SchemaOptions } from 'mongoose';

/**
 * Renames `_id` to `id` and drops `__v` on serialisation, for documents *and*
 * subdocuments. Any sub-schema declared with `{ _id: true }` must apply this too,
 * otherwise the API leaks `_id` while clients expect `id`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const idTransform = (_doc: any, ret: any): void => {
  if (ret && typeof ret === 'object') {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
};

export const subdocumentOptions = {
  _id: true,
  versionKey: false,
  toJSON: { transform: idTransform },
  toObject: { transform: idTransform },
} satisfies SchemaOptions;

export const schemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: idTransform,
  },
  toObject: {
    virtuals: true,
    transform: idTransform,
  },
} satisfies SchemaOptions;

/**
 * Shared SEO paths. Intentionally mutable (no `as const`) so the spread keeps
 * working with Mongoose `SchemaDefinitionProperty` generics.
 */
export const seoFields = {
  metaTitle: { type: String, trim: true, maxlength: 70 },
  metaDescription: { type: String, trim: true, maxlength: 160 },
  keywords: { type: [String], default: [] as string[] },
};
