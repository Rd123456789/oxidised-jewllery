import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client';

/**
 * A piece the assistant mentioned. Shaped so the widget can link straight into the product route,
 * rather than naming something the shopper cannot act on.
 */
export interface ChatProduct {
  slug: string;
  name: string;
  image?: string;
  price: number;
  currency: string;
  inStock: boolean;
  stock: number;
  /** Buyable but close to running out — worth saying out loud. */
  lowStock: boolean;
}

export interface ChatReply {
  /** One short paragraph. */
  reply: string;
  /** Which branch answered. Useful when debugging an unexpected answer. */
  intent: string;
  /** Tap-able follow-ups. Always present so the thread never dead-ends. */
  suggestions: string[];
  /** Only populated for availability answers. */
  products: ChatProduct[];
  contact?: { email?: string; whatsapp?: string };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Thin wrapper over the public chat endpoint.
 *
 * All of the judgement — what counts as an availability question, which policies apply, whether a
 * piece is actually buyable — happens on the server against live data. This deliberately holds no
 * rules of its own, so the site and the app cannot drift apart in what they tell a shopper.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiClient);

  /** Public endpoint: a guest can ask before creating an account. */
  ask(message: string, history: ChatTurn[] = []): Promise<ChatReply> {
    // The server caps history, and an unbounded thread would simply be rejected. The last few turns
    // carry enough context; the rest is noise.
    return this.api.post<ChatReply>('/chat', { message: message.trim(), history: history.slice(-6) });
  }
}