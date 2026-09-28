import { Injectable, inject } from '@angular/core';
import { IDEMPOTENCY_HEADER } from '../api/api.config';
import { ApiClient, type QueryParams } from '../api/api-client';
import type {
  ApiMeta,
  Order,
  OrderQuote,
  PaymentMethod,
  PlaceOrderPayload,
  TrackedOrder,
} from '../api/api.models';

export interface OrderListQuery {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiClient);

  async quote(payload: {
    items: { productId: string; variantSku?: string; quantity: number }[];
    couponCode?: string;
    paymentMethod?: PaymentMethod;
  }): Promise<OrderQuote> {
    return this.api.post<OrderQuote>('/orders/quote', payload);
  }

  /**
   * Places the order. Pass the same `idempotencyKey` when retrying a submission that may
   * have reached the server, so a flaky connection cannot create a second order.
   */
  async place(
    payload: PlaceOrderPayload,
    idempotencyKey?: string,
  ): Promise<{ order: Order; nextStep: string }> {
    return this.api.post<{ order: Order; nextStep: string }>(
      '/orders',
      payload,
      undefined,
      idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : undefined,
    );
  }

  async myOrders(query: OrderListQuery = {}): Promise<{ orders: Order[]; meta: ApiMeta }> {
    const result = await this.api.getWithMeta<Order[]>('/orders', query as QueryParams);

    return { orders: result.data, meta: result.meta ?? {} };
  }

  async myOrder(orderNumber: string): Promise<Order> {
    return this.api.get<Order>(`/orders/${orderNumber}`);
  }

  async cancel(orderNumber: string, reason?: string): Promise<Order> {
    return this.api.post<Order>(`/orders/${orderNumber}/cancel`, { reason });
  }

  async track(orderNumber: string, phone?: string): Promise<TrackedOrder> {
    return this.api.get<TrackedOrder>('/orders/track', { orderNumber, phone });
  }

  async confirmPayment(payload: {
    orderNumber: string;
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  }): Promise<Order> {
    return this.api.post<Order>('/orders/verify-payment', payload);
  }

}
