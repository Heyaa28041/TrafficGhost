import { useState, useEffect, useCallback } from "react";
import {
  API_URL,
  fetchUsers,
  fetchProducts,
  fetchOrders,
  login,
  User,
  Product,
  Order,
} from "./api";

// ── Utility Components ────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return <span className={`spinner ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div>
      {[1, 2, 3].map((k) => (
        <div key={k} style={{ marginBottom: 10, padding: "12px 16px", background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div className="loading-skeleton skeleton-line medium" />
          <div className="loading-skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ status, message, onRetry }: { status?: number; message: string; onRetry: () => void }) {
  const isRateLimit = status === 429;
  const isServerError = status !== undefined && status >= 500;

  if (isRateLimit) {
    return (
      <div className="rate-limit-state fade-in">
        <div className="rate-limit-icon">🚦</div>
        <div className="rate-limit-title">Rate Limited (429)</div>
        <div className="rate-limit-desc">Too many requests. TrafficGhost is simulating rate limiting.</div>
        <button className="refresh-btn" style={{ marginTop: 12 }} onClick={onRetry}>Retry</button>
      </div>
    );
  }

  return (
    <div className="error-state fade-in">
      <div className="error-icon">{isServerError ? "💥" : "⚠️"}</div>
      <div className="error-title">
        {isServerError ? "Server Error" : "Something went wrong"}
      </div>
      <div className="error-message">{message}</div>
      {status && <span className="error-code">HTTP {status}</span>}
      <br />
      <button className="refresh-btn" style={{ marginTop: 12 }} onClick={onRetry}>Try Again</button>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [selected, setSelected] = useState<User | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers(p);
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      setError({ message: err.message, status: err.status });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const avatarClass = (idx: number) => `av-${(idx % 5) + 1}`;
  const initial = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">👥 Users</div>
            <div className="card-subtitle">{total > 0 ? `${total} total users` : "Loading..."}</div>
          </div>
          <button className="refresh-btn" onClick={() => load(page)} disabled={loading}>
            {loading ? <Spinner className="dark" /> : "↺ Refresh"}
          </button>
        </div>

        {loading && <LoadingSkeleton />}
        {!loading && error && <ErrorState status={error.status} message={error.message} onRetry={() => load(page)} />}
        {!loading && !error && users.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <div className="empty-title">No users found</div>
            <div className="empty-desc">The API returned an empty list.</div>
          </div>
        )}
        {!loading && !error && users.length > 0 && (
          <div className="user-grid">
            {users.map((user, idx) => (
              <div key={user.id} className="user-card" onClick={() => setSelected(user)}>
                <div className={`user-avatar ${avatarClass(idx)}`} style={{ color: "white" }}>
                  {initial(user.name)}
                </div>
                <div>
                  <div className="user-name">{user.name}</div>
                  <div className="user-email">{user.email}</div>
                </div>
                <span className={`user-role ${user.role === "admin" ? "role-admin" : "role-user"}`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="pagination">
          <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}>← Prev</button>
          <span className="page-info">Page {page}</span>
          <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={users.length < 3 || loading}>Next →</button>
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            <h2 style={{ marginBottom: 16, fontSize: 18 }}>User #{selected.id}</h2>
            {(["name", "email", "role", "department", "createdAt", "lastLogin"] as const).map(field =>
              selected[field] ? (
                <div className="modal-field" key={field}>
                  <div className="modal-field-key">{field}</div>
                  <div className="modal-field-val">{String(selected[field])}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts();
      setProducts(data.products ?? []);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      setError({ message: err.message, status: err.status });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📦 Products</div>
            <div className="card-subtitle">{products.length > 0 ? `${products.length} products` : "Loading..."}</div>
          </div>
          <button className="refresh-btn" onClick={load} disabled={loading}>
            {loading ? <Spinner className="dark" /> : "↺ Refresh"}
          </button>
        </div>

        {loading && (
          <div className="product-grid">
            {[1, 2, 3, 4].map(k => (
              <div key={k} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <div className="loading-skeleton skeleton-line medium" />
                <div className="loading-skeleton skeleton-line short" />
                <div className="loading-skeleton skeleton-line medium" style={{ height: 20, marginTop: 8 }} />
              </div>
            ))}
          </div>
        )}
        {!loading && error && <ErrorState status={error.status} message={error.message} onRetry={load} />}
        {!loading && !error && (
          <div className="product-grid">
            {products.map(product => (
              <div key={product.id} className="product-card" onClick={() => setSelected(product)}>
                <div className="product-name">{product.name}</div>
                <div className="product-cat">{product.category}</div>
                <div className="product-price">${product.price.toFixed(2)}</div>
                {product.stock !== undefined && (
                  <div className="product-stock">{product.stock} in stock</div>
                )}
                {product.rating !== undefined && (
                  <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 4 }}>
                    ★ {product.rating} ({product.reviews} reviews)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            <h2 style={{ marginBottom: 16, fontSize: 18 }}>{selected.name}</h2>
            <div className="modal-field"><div className="modal-field-key">Price</div><div className="modal-field-val" style={{ color: "var(--accent2)", fontSize: 20, fontWeight: 700 }}>${selected.price}</div></div>
            <div className="modal-field"><div className="modal-field-key">Category</div><div className="modal-field-val">{selected.category}</div></div>
            {selected.description && <div className="modal-field"><div className="modal-field-key">Description</div><div className="modal-field-val" style={{ fontSize: 13, color: "var(--fg2)", lineHeight: 1.5 }}>{selected.description}</div></div>}
            {selected.rating !== undefined && <div className="modal-field"><div className="modal-field-key">Rating</div><div className="modal-field-val" style={{ color: "var(--warn)" }}>★ {selected.rating} / 5 ({selected.reviews} reviews)</div></div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ─────────────────────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders();
      setOrders(data.orders ?? []);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      setError({ message: err.message, status: err.status });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusClass = (s: string) => `order-status status-${s}`;

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">🛒 Orders</div>
            <div className="card-subtitle">{orders.length > 0 ? `${orders.length} orders` : "Loading..."}</div>
          </div>
          <button className="refresh-btn" onClick={load} disabled={loading}>
            {loading ? <Spinner className="dark" /> : "↺ Refresh"}
          </button>
        </div>
        {loading && <LoadingSkeleton />}
        {!loading && error && <ErrorState status={error.status} message={error.message} onRetry={load} />}
        {!loading && !error && orders.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No orders</div>
            <div className="empty-desc">No orders have been placed yet.</div>
          </div>
        )}
        {!loading && !error && orders.map(order => (
          <div key={order.id} className="order-item">
            <div className="order-id">{order.id}</div>
            <span className={statusClass(order.status)}>{order.status}</span>
            <div className="order-date">{new Date(order.createdAt).toLocaleDateString()}</div>
            <div className="order-total">${order.total.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Login Tab ─────────────────────────────────────────────────────────────

function LoginTab() {
  const [username, setUsername] = useState("alice@example.com");
  const [password, setPassword] = useState("correct-password");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ token: string; user: User } | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await login(username, password);
      setResult(data);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      setError({ message: e.message, status: e.status });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-title" style={{ marginBottom: 20 }}>🔐 Login</div>
        <div className="login-form">
          {error && <ErrorState status={error.status} message={error.message} onRetry={() => setError(null)} />}
          {result ? (
            <div className="login-success fade-in">
              <div className="login-success-title">✓ Logged in as {result.user.name}</div>
              <div className="login-success-sub">Role: {result.user.role}</div>
              <div className="token-preview">{result.token.substring(0, 60)}...</div>
              <button className="refresh-btn" style={{ marginTop: 12, width: "100%" }} onClick={() => setResult(null)}>Try Again</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={username} onChange={e => setUsername(e.target.value)} placeholder="alice@example.com" />
                <div className="form-hint">Try: alice@example.com (correct-password) or any wrong password for 401</div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? <><Spinner /> Authenticating...</> : "Sign In"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────

type TabId = "users" | "products" | "orders" | "login";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "users", label: "Users", icon: "👥" },
  { id: "products", label: "Products", icon: "📦" },
  { id: "orders", label: "Orders", icon: "🛒" },
  { id: "login", label: "Login", icon: "🔐" },
];

function useApiHealth() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users`, { signal: AbortSignal.timeout(3000) });
        setApiOk(res.ok || res.status === 401);
      } catch {
        setApiOk(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return apiOk;
}

export default function App() {
  const [tab, setTab] = useState<TabId>("users");
  const apiOk = useApiHealth();

  return (
    <div className="app">
      <header className="header">
        <span className="header-logo">👻</span>
        <span className="header-title">TrafficGhost</span>
        <span className="header-subtitle">Demo Frontend</span>
        <div className="backend-indicator">
          <span className={`backend-dot ${apiOk === false ? "error" : ""}`} />
          <span>{apiOk === null ? "Checking..." : apiOk ? "Backend connected" : "Backend unavailable"}</span>
          <span className="backend-url">{API_URL.replace("http://", "")}</span>
        </div>
      </header>

      <nav className="nav-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "users" && <UsersTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "login" && <LoginTab />}
      </main>
    </div>
  );
}
