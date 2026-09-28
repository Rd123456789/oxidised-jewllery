import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../api/api.config';
import { toApiError } from '../api/api-client';
import type { Address, AuthResponse, AuthUser } from '../api/api.models';
import {
  clearCartSessionId,
  persistUser,
  readStoredUser,
  registerRefreshHandler,
  registerSessionExpiredHandler,
  setAccessToken,
} from '../auth/session.store';

interface Envelope<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);

  private readonly userSignal = signal<AuthUser | null>(readStoredUser());
  private readonly readySignal = signal(false);

  readonly user = this.userSignal.asReadonly();
  readonly isReady = this.readySignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => {
    const role = this.userSignal()?.role;

    return role === 'admin' || role === 'manager';
  });
  readonly displayName = computed(() => this.userSignal()?.name ?? 'Guest');

  constructor() {
    registerRefreshHandler(() => this.refreshAccessToken());
    registerSessionExpiredHandler(() => this.clearLocalSession());
  }

  /** Called once at app start: silently restores the session from the refresh cookie. */
  async restore(): Promise<void> {
    if (!readStoredUser()) {
      this.readySignal.set(true);

      return;
    }

    try {
      await this.refreshAccessToken();
    } catch {
      this.clearLocalSession();
    } finally {
      this.readySignal.set(true);
    }
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await this.post<AuthResponse>('/auth/login', { email, password });

    return this.applySession(response);
  }

  async loginAsAdmin(email: string, password: string): Promise<AuthUser> {
    const response = await this.post<AuthResponse>('/auth/admin/login', { email, password });

    return this.applySession(response);
  }

  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    marketingOptIn?: boolean;
  }): Promise<AuthUser> {
    const response = await this.post<AuthResponse>('/auth/register', payload);

    return this.applySession(response);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<Envelope<unknown>>(`${API_PREFIX}/auth/logout`, {}));
    } catch {
      /* the local session is cleared regardless of the API response */
    }

    this.clearLocalSession();
  }

  async updateProfile(payload: {
    name?: string;
    phone?: string;
    marketingOptIn?: boolean;
  }): Promise<AuthUser> {
    const response = await this.patch<{ user: AuthUser }>('/auth/me', payload);

    this.userSignal.set(response.user);
    persistUser(response.user);

    return response.user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.post('/auth/change-password', { currentPassword, newPassword });
    this.clearLocalSession();
  }

  async reloadProfile(): Promise<AuthUser | null> {
    if (!this.userSignal()) {
      return null;
    }

    try {
      const response = await this.get<{ user: AuthUser }>('/auth/me');
      this.userSignal.set(response.user);
      persistUser(response.user);

      return response.user;
    } catch {
      return this.userSignal();
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await this.post<AuthResponse>('/auth/refresh', {});

      this.userSignal.set(response.user);
      persistUser(response.user);
      setAccessToken(response.accessToken);

      return response.accessToken;
    } catch {
      this.clearLocalSession();

      return null;
    }
  }

  async addAddress(address: Address): Promise<Address[]> {
    const addresses = await this.post<Address[]>('/auth/addresses', address);

    return this.syncAddresses(addresses);
  }

  async updateAddress(id: string, address: Partial<Address>): Promise<Address[]> {
    const addresses = await this.patch<Address[]>(`/auth/addresses/${id}`, address);

    return this.syncAddresses(addresses);
  }

  async removeAddress(id: string): Promise<Address[]> {
    const addresses = await this.delete<Address[]>(`/auth/addresses/${id}`);

    return this.syncAddresses(addresses);
  }

  async setDefaultAddress(id: string): Promise<Address[]> {
    const addresses = await this.put<Address[]>(`/auth/addresses/${id}/default`, {});

    return this.syncAddresses(addresses);
  }

  defaultAddress(): Address | null {
    const addresses = this.userSignal()?.addresses ?? [];

    return addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
  }

  clearLocalSession(): void {
    setAccessToken(null);
    this.userSignal.set(null);
    persistUser(null);
    clearCartSessionId();
  }

  private syncAddresses(addresses: Address[]): Address[] {
    const current = this.userSignal();

    if (current) {
      const next = { ...current, addresses };
      this.userSignal.set(next);
      persistUser(next);
    }

    return addresses;
  }

  private applySession(response: AuthResponse): AuthUser {
    setAccessToken(response.accessToken);
    this.userSignal.set(response.user);
    persistUser(response.user);
    this.readySignal.set(true);

    return response.user;
  }

  private async get<T>(path: string): Promise<T> {
    return this.unwrap(
      firstValueFrom(this.http.get<Envelope<T>>(`${API_PREFIX}${path}`, { withCredentials: true })),
    );
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.post<Envelope<T>>(`${API_PREFIX}${path}`, body, { withCredentials: true }),
      ),
    );
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.put<Envelope<T>>(`${API_PREFIX}${path}`, body, { withCredentials: true }),
      ),
    );
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.patch<Envelope<T>>(`${API_PREFIX}${path}`, body, { withCredentials: true }),
      ),
    );
  }

  private async delete<T>(path: string): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.delete<Envelope<T>>(`${API_PREFIX}${path}`, { withCredentials: true }),
      ),
    );
  }

  private async unwrap<T>(promise: Promise<Envelope<T>>): Promise<T> {
    try {
      const envelope = await promise;

      return envelope.data;
    } catch (error) {
      throw toApiError(error);
    }
  }
}
