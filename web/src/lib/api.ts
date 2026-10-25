import type { Drill, DrillDoc, DrillMeta } from '../../../shared/types';

export interface User {
  id: number;
  email: string;
  name: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export type DrillPayload = DrillMeta & { doc: DrillDoc };

export const api = {
  me: () => req<User>('GET', '/api/auth/me'),
  login: (email: string, password: string) => req<User>('POST', '/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => req<User>('POST', '/api/auth/register', { name, email, password }),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),
  listDrills: () => req<Drill[]>('GET', '/api/drills'),
  getDrill: (id: number) => req<Drill>('GET', `/api/drills/${id}`),
  createDrill: (d: DrillPayload) => req<Drill>('POST', '/api/drills', d),
  updateDrill: (id: number, d: DrillPayload) => req<Drill>('PUT', `/api/drills/${id}`, d),
  deleteDrill: (id: number) => req<{ ok: true }>('DELETE', `/api/drills/${id}`),
  duplicateDrill: (id: number) => req<Drill>('POST', `/api/drills/${id}/duplicate`),
  share: (id: number) => req<{ shareToken: string }>('POST', `/api/drills/${id}/share`),
  unshare: (id: number) => req<{ shareToken: null }>('DELETE', `/api/drills/${id}/share`),
  addSamples: () => req<Drill[]>('POST', '/api/drills/samples'),
  shared: (token: string) => req<Drill>('GET', `/api/shared/${encodeURIComponent(token)}`),
};
