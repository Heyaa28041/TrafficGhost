// TrafficGhost Demo — API client
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const API_URL = BASE_URL;

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  stock?: number;
  category: string;
  description?: string;
  rating?: number;
  reviews?: number;
}

export interface Order {
  id: string;
  userId: number;
  status: string;
  total: number;
  items?: Array<{ productId: number; quantity: number }>;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.message ?? data.error ?? `HTTP ${res.status}`), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

export async function fetchUsers(page = 1): Promise<{ users: User[]; total: number; page: number }> {
  return request(`/api/users?page=${page}&limit=3`);
}

export async function fetchUser(id: number): Promise<User> {
  return request(`/api/users/${id}`);
}

export async function fetchProducts(): Promise<{ products: Product[]; total: number }> {
  return request("/api/products");
}

export async function fetchProduct(id: number): Promise<Product> {
  return request(`/api/products/${id}`);
}

export async function fetchOrders(): Promise<{ orders: Order[]; total: number }> {
  return request("/api/orders");
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
