import { Schema, model, type Model } from 'mongoose';
import { schemaOptions } from './common.js';

export interface CounterDocument {
  key: string;
  value: number;
}

interface CounterModel extends Model<CounterDocument> {
  next(key: string, step?: number): Promise<number>;
}

const counterSchema = new Schema<CounterDocument, CounterModel>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Number, required: true, default: 0 },
  },
  schemaOptions,
);

counterSchema.statics.next = async function next(key: string, step = 1): Promise<number> {
  const counter = await this.findOneAndUpdate(
    { key },
    { $inc: { value: step } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return counter?.value ?? step;
};

export const Counter = model<CounterDocument, CounterModel>('Counter', counterSchema);

export async function nextSequence(key: string, step = 1): Promise<number> {
  return Counter.next(key, step);
}

export function formatSequence(prefix: string, value: number, pad = 4): string {
  return `${prefix}${String(value).padStart(pad, '0')}`;
}
