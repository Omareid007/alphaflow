import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface Order {
  id: string;
  broker: string;
  brokerOrderId: string;
  clientOrderId?: string | null;
  symbol: string;
  side: string;
  type: string;
  timeInForce?: string | null;
  qty?: string | null;
  notional?: string | null;
  limitPrice?: string | null;
  stopPrice?: string | null;
  status: string;
  extendedHours?: boolean;
  orderClass?: string | null;
  submittedAt: string;
  updatedAt: string;
  filledAt?: string | null;
  expiredAt?: string | null;
  canceledAt?: string | null;
  failedAt?: string | null;
  filledQty?: string | null;
  filledAvgPrice?: string | null;
  traceId?: string | null;
  decisionId?: string | null;
  tradeIntentId?: string | null;
  workItemId?: string | null;
  rawJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface OrdersResponse {
  orders: Order[];
  _source?: {
    type: string;
    table: string;
    fetchedAt: string;
    note?: string;
  };
}

export function useOrders(options?: { limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['orders', options],
    queryFn: async () => {
      const response = await api.get<OrdersResponse>('/api/orders', {
        params: options,
      });
      return response.orders || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
    enabled: !!id,
  });
}

export function useRecentOrders(limit: number = 50) {
  return useQuery({
    queryKey: ['orders', 'recent', limit],
    queryFn: async () => {
      const response = await api.get<OrdersResponse>('/api/orders/recent', {
        params: { limit },
      });
      return response.orders || [];
    },
    refetchInterval: 30000,
  });
}
