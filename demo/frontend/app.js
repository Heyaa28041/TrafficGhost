const API_BASE = 'http://localhost:4000';

let currentPage = 1;
let lastFailedAction = null;

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  loadUsers();
  loadProducts(1);
  loadOrders();

  document.getElementById('btnReloadUsers')?.addEventListener('click', () => loadUsers());
  document.getElementById('btnReloadOrders')?.addEventListener('click', () => loadOrders());
  document.getElementById('btnPrevPage')?.addEventListener('click', () => {
    if (currentPage > 1) {
      loadProducts(currentPage - 1);
    }
  });
  document.getElementById('btnNextPage')?.addEventListener('click', () => {
    loadProducts(currentPage + 1);
  });
  document.getElementById('btnRetry')?.addEventListener('click', () => {
    if (lastFailedAction) {
      document.getElementById('globalErrorBanner').style.display = 'none';
      lastFailedAction();
    }
  });
});

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const viewId = `view-${btn.dataset.view}`;
      document.getElementById(viewId)?.classList.add('active');
    });
  });
}

function updateLatencyBadge(durationMs) {
  const badge = document.getElementById('latencyIndicator');
  if (badge) {
    badge.innerText = `Latency: ${durationMs}ms`;
    if (durationMs > 400) {
      badge.style.color = '#f59e0b';
    } else {
      badge.style.color = '#94a3b8';
    }
  }
}

function showErrorBanner(status, message, retryFn) {
  const banner = document.getElementById('globalErrorBanner');
  const statusEl = document.getElementById('errorStatusText');
  const msgEl = document.getElementById('errorMessageText');

  statusEl.innerText = `HTTP ${status}: ${status === 429 ? 'Rate Limited' : status === 500 ? 'Server Error' : status === 404 ? 'Not Found' : status === 401 ? 'Unauthorized' : 'Request Failed'}`;
  msgEl.innerText = message || 'Simulated backend edge-case response from TrafficGhost.';
  banner.style.display = 'flex';
  lastFailedAction = retryFn;
}

function hideErrorBanner() {
  document.getElementById('globalErrorBanner').style.display = 'none';
}

// 1. Users APIs
async function loadUsers() {
  const skeleton = document.getElementById('usersSkeleton');
  const tableWrap = document.getElementById('usersTableWrap');
  const tbody = document.getElementById('usersTableBody');

  skeleton.style.display = 'flex';
  tableWrap.style.display = 'none';
  hideErrorBanner();

  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showErrorBanner(res.status, err.error?.message, () => loadUsers());
      return;
    }

    const data = await res.json();
    const users = Array.isArray(data) ? data : data.users || [];

    tbody.innerHTML = users.map((u) => `
      <tr>
        <td style="font-family: monospace; color: #94a3b8;">${u.id}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td><span style="background: #334155; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${u.role || 'Member'}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="fetchUserDetail(${u.id})">Inspect Detail</button>
        </td>
      </tr>
    `).join('');

    skeleton.style.display = 'none';
    tableWrap.style.display = 'block';
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);
    showErrorBanner(0, 'Failed to connect to TrafficGhost mock server on http://localhost:4000. Is the server started in VS Code?', () => loadUsers());
    skeleton.style.display = 'none';
  }
}

window.fetchUserDetail = async function(userId) {
  const card = document.getElementById('userDetailCard');
  const nameEl = document.getElementById('detailUserName');
  const jsonEl = document.getElementById('detailUserJson');

  card.style.display = 'block';
  jsonEl.innerText = '// Loading user detail...';
  hideErrorBanner();

  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/users/${userId}`);
    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      jsonEl.innerText = JSON.stringify(err, null, 2);
      showErrorBanner(res.status, err.error?.message, () => fetchUserDetail(userId));
      return;
    }

    const data = await res.json();
    nameEl.innerText = `User Details: ${data.name || `User #${data.id}`}`;
    jsonEl.innerText = JSON.stringify(data, null, 2);
  } catch (err) {
    jsonEl.innerText = `Error: ${err.message}`;
  }
};

window.fetchCustomUser = function() {
  const id = document.getElementById('inputCustomUserId').value;
  if (id) {
    fetchUserDetail(id);
  }
};

window.closeUserDetail = function() {
  document.getElementById('userDetailCard').style.display = 'none';
};

// 2. Products APIs (Pagination)
async function loadProducts(page) {
  const grid = document.getElementById('productsGrid');
  const pageIndicator = document.getElementById('pageIndicator');
  grid.innerHTML = '<div style="padding: 20px; color: #94a3b8;">Loading page ' + page + '...</div>';
  hideErrorBanner();

  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/products?page=${page}&limit=5`);
    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showErrorBanner(res.status, err.error?.message, () => loadProducts(page));
      grid.innerHTML = '';
      return;
    }

    const data = await res.json();
    const products = Array.isArray(data) ? data : data.products || data.data || [];
    currentPage = page;
    pageIndicator.innerText = `Page ${page} of ${data.totalPages || 2}`;

    if (products.length === 0) {
      grid.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">No products found on this page.</div>';
      return;
    }

    grid.innerHTML = products.map((p) => `
      <div class="product-card">
        <div>
          <span style="font-size: 10px; color: #94a3b8; font-family: monospace;">#${p.id} • ${p.category || 'General'}</span>
          <h4>${p.title || p.name}</h4>
        </div>
        <div>
          <div class="product-price">$${typeof p.price === 'number' ? p.price.toFixed(2) : p.price}</div>
          <div class="product-footer">
            <span>Rating: ★ ${p.rating || 4.5}</span>
            <span style="color: ${p.inStock ? '#10b981' : '#ef4444'};">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '';
    showErrorBanner(0, 'Failed to fetch products from mock server.', () => loadProducts(page));
  }
}

// 3. Orders APIs
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = '<tr><td colspan="5">Loading orders...</td></tr>';
  hideErrorBanner();

  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showErrorBanner(res.status, err.error?.message, () => loadOrders());
      return;
    }

    const data = await res.json();
    const orders = Array.isArray(data) ? data : data.orders || [];

    tbody.innerHTML = orders.map((o) => {
      const statusColor = o.status === 'DELIVERED' ? '#10b981' : o.status === 'PROCESSING' ? '#f59e0b' : '#38bdf8';
      return `
        <tr>
          <td style="font-family: monospace; font-weight: 600;">${o.id}</td>
          <td>${o.customerName}</td>
          <td style="font-weight: 700;">$${typeof o.totalAmount === 'number' ? o.totalAmount.toFixed(2) : o.totalAmount}</td>
          <td><span style="background: rgba(255,255,255,0.05); color: ${statusColor}; border: 1px solid ${statusColor}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${o.status}</span></td>
          <td style="color: #94a3b8; font-size: 12px;">${o.createdAt || 'Recent'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="color: #ef4444;">Failed to load orders.</td></tr>';
  }
}

// 4. GraphQL Queries
window.runGqlQuery = async function(operationName, variables = {}) {
  const viewer = document.getElementById('gqlResponseViewer');
  viewer.innerText = `// Executing operation: ${operationName}...`;

  document.querySelectorAll('.gql-op-btn').forEach((b) => {
    b.classList.toggle('active', b.innerText.includes(operationName));
  });

  const queryMap = {
    GetUsers: 'query GetUsers {\n  users {\n    id\n    name\n    email\n    role\n  }\n}',
    GetUserById: 'query GetUserById($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n    role\n    department\n  }\n}',
    GetProductCatalog: 'query GetProductCatalog {\n  products {\n    id\n    title\n    price\n    inStock\n  }\n}',
    CreateUser: 'mutation CreateUser($name: String!, $email: String!) {\n  createUser(name: $name, email: $email) {\n    id\n    name\n    email\n  }\n}'
  };

  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationName,
        query: queryMap[operationName] || `query ${operationName} { ... }`,
        variables
      })
    });

    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);

    const data = await res.json();
    viewer.innerText = JSON.stringify(data, null, 2);
  } catch (err) {
    viewer.innerText = `GraphQL execution error: ${err.message}`;
  }
};

// 5. Latency tester
window.testLatency = async function() {
  const resultEl = document.getElementById('latencyTestResult');
  resultEl.innerText = 'Measuring latency...';

  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    const duration = Math.round(performance.now() - start);
    updateLatencyBadge(duration);

    let assessment = duration > 500 ? '🐢 Slow Network Simulation Active!' : '⚡ Fast Mock Response!';
    resultEl.innerText = `Status: ${res.status} | Roundtrip Latency: ${duration}ms\nAssessment: ${assessment}`;
  } catch (err) {
    resultEl.innerText = `Test error: ${err.message}`;
  }
};
