let API_BASE = 'http://localhost:4000';
let activeView = 'dashboard';
let currentProductsPage = 1;
let currentProductsTotalPages = 1;
let lastFailedRequest = null;
let lastLoginAttempt = null;

document.addEventListener('DOMContentLoaded', () => {
  setupRouting();
  setupModals();
  initializeConsole();
  document.body.classList.add('auth-locked');
  document.getElementById('loginForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    lastLoginAttempt = () => submitLogin();
    submitLogin();
  });
  
  // Try loading dashboard
  loadView('login');

  document.getElementById('btnRetryBanner')?.addEventListener('click', () => {
    if (lastFailedRequest) {
      document.getElementById('globalErrorBanner').style.display = 'none';
      lastFailedRequest();
    }
  });

  document.getElementById('btnSaveConsoleSettings')?.addEventListener('click', () => {
    const target = document.getElementById('settingEndpointTarget').value;
    if (target) {
      API_BASE = target;
      initializeConsole();
      loadView(activeView);
    }
  });

  document.getElementById('searchUsersInput')?.addEventListener('input', () => loadUsers());
  document.getElementById('filterUsersRole')?.addEventListener('change', () => loadUsers());
});

function setupRouting() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetView = btn.dataset.view;
      loadView(targetView);
    });
  });
}

function setupModals() {
  // User Modal
  document.getElementById('btnCreateUserModal')?.addEventListener('click', () => {
    document.getElementById('createUserModal').style.display = 'flex';
  });
  
  const closeUserModal = () => {
    document.getElementById('createUserModal').style.display = 'none';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
  };

  document.getElementById('btnCancelCreateUser')?.addEventListener('click', closeUserModal);
  document.getElementById('btnDismissCreateUser')?.addEventListener('click', closeUserModal);
  document.getElementById('btnSubmitCreateUser')?.addEventListener('click', async () => {
    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const role = document.getElementById('newUserRole').value;

    if (!name || !email) return;

    const res = await apiRequest('POST', '/api/users', { name, email, role });
    if (res) {
      closeUserModal();
      loadView('users'); // reload users
    }
  });

  // Edit User Modal
  const closeEditModal = () => {
    document.getElementById('editUserModal').style.display = 'none';
  };
  document.getElementById('btnCancelEditUser')?.addEventListener('click', closeEditModal);
  document.getElementById('btnDismissEditUser')?.addEventListener('click', closeEditModal);
  document.getElementById('btnSubmitEditUser')?.addEventListener('click', async () => {
    const id = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value;
    const email = document.getElementById('editUserEmail').value;
    const role = document.getElementById('editUserRole').value;

    if (!name || !email) return;

    const res = await apiRequest('PUT', `/api/users/${id}`, { name, email, role });
    if (res) {
      closeEditModal();
      loadView('users');
    }
  });

  // Order Modal
  document.getElementById('btnCreateOrderModal')?.addEventListener('click', () => {
    document.getElementById('createOrderModal').style.display = 'flex';
  });

  const closeOrderModal = () => {
    document.getElementById('createOrderModal').style.display = 'none';
  };

  document.getElementById('btnCancelCreateOrder')?.addEventListener('click', closeOrderModal);
  document.getElementById('btnDismissCreateOrder')?.addEventListener('click', closeOrderModal);
  document.getElementById('btnSubmitCreateOrder')?.addEventListener('click', async () => {
    const userId = parseInt(document.getElementById('orderUserId').value, 10) || 1;
    const total = parseFloat(document.getElementById('orderTotal').value) || 0;

    const res = await apiRequest('POST', '/api/orders', { userId, total, status: 'Pending' });
    if (res) {
      closeOrderModal();
      loadView('orders'); // reload
    }
  });
}

async function initializeConsole() {
  const dot = document.getElementById('systemStatusDot');
  const text = document.getElementById('systemStatusText');
  
  try {
    const res = await fetch(`${API_BASE}/__trafficghost/health`);
    if (res.ok) {
      dot.className = 'status-indicator-dot online';
      text.innerText = 'Connected';
    } else {
      dot.className = 'status-indicator-dot offline';
      text.innerText = 'Server Error';
    }
  } catch {
    dot.className = 'status-indicator-dot offline';
    text.innerText = 'Offline';
  }
}

async function apiRequest(method, path, body = null) {
  const start = performance.now();
  document.getElementById('globalErrorBanner').style.display = 'none';

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    const duration = Math.round(performance.now() - start);
    updateLatency(duration);

    if (!res.ok) {
      handleError(res.status, `API returned status code ${res.status}`, () => apiRequest(method, path, body));
      return null;
    }

    if (res.status === 204) return true;
    return await res.json();
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    updateLatency(duration);
    handleError(500, 'Could not connect to target server API.', () => apiRequest(method, path, body));
    return null;
  }
}

async function submitLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const button = document.getElementById('loginSubmit');
  const message = document.getElementById('loginMessage');

  button.disabled = true;
  button.innerText = 'Signing In...';
  message.className = 'login-message';
  message.innerText = '';

  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();

    if (res.ok) {
      document.body.classList.remove('auth-locked');
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      document.querySelector('.nav-item[data-view="dashboard"]')?.classList.add('active');
      loadView('dashboard');
      return;
    }

    if (res.status === 400) {
      showLoginMessage(body.message || 'Email and password are required', 'validation');
    } else if (res.status === 401) {
      showLoginMessage('Invalid email or password', 'error');
    } else if (res.status === 429) {
      showLoginMessage('Too many attempts. Please try again later.', 'error');
    } else if (res.status >= 500) {
      showLoginMessage(body.message || 'Authentication service temporarily unavailable', 'error', true);
    } else {
      showLoginMessage('Unable to sign in. Please try again.', 'error', true);
    }
  } catch {
    showLoginMessage('Unable to connect to authentication service.', 'error', true);
  } finally {
    button.disabled = false;
    button.innerText = 'Sign In';
  }
}

function showLoginMessage(text, state, retry = false) {
  const message = document.getElementById('loginMessage');
  message.className = `login-message ${state}`;
  message.innerText = text;
  if (retry) {
    message.innerHTML = `${text} <button type="button" class="login-retry" onclick="retryLogin()">Retry</button>`;
  }
}

window.retryLogin = function() {
  if (lastLoginAttempt) lastLoginAttempt();
};

function updateLatency(ms) {
  const el = document.getElementById('latencyIndicator');
  if (el) el.innerText = `Latency: ${ms}ms`;
}

function handleError(status, msg, retryFn) {
  lastFailedRequest = retryFn;
  const banner = document.getElementById('globalErrorBanner');
  const messageEl = document.getElementById('errorBannerMessage');
  
  let friendlyMsg = msg;
  if (status === 401) {
    friendlyMsg = 'Authentication required. Access to this resource is protected.';
  } else if (status === 429) {
    friendlyMsg = 'Too many requests. Rate limit exceeded, please retry shortly.';
  } else if (status === 404) {
    friendlyMsg = 'Requested API resource not found on local mockup.';
  }

  messageEl.innerText = friendlyMsg;
  banner.style.display = 'flex';
}

function loadView(viewId) {
  activeView = viewId;
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`view-${viewId}`)?.classList.add('active');

  switch (viewId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'users':
      loadUsers();
      break;
    case 'products':
      loadProducts(currentProductsPage);
      break;
    case 'orders':
      loadOrders();
      break;
    case 'analytics':
      loadAnalytics();
      break;
  }
}

async function loadDashboard() {
  const skel = document.getElementById('activityFeedSkeleton');
  const list = document.getElementById('activityList');
  skel.style.display = 'block';
  list.style.display = 'none';

  // Load summary metrics via GraphQL query
  const qStats = {
    query: `query GetDashboardStats {
      stats {
        totalUsers
        totalOrders
        revenue
      }
    }`
  };
  const statsRes = await apiRequest('POST', '/graphql', qStats);
  if (statsRes && statsRes.data) {
    const s = statsRes.data.stats || { totalUsers: 12, totalOrders: 42, revenue: '$4,150.00' };
    document.getElementById('statUsersCount').innerText = s.totalUsers;
    document.getElementById('statOrdersCount').innerText = s.totalOrders;
    document.getElementById('statRevenue').innerText = s.revenue;
  } else {
    // REST fallback metrics if graphql not supported by mock schemas
    document.getElementById('statUsersCount').innerText = '12';
    document.getElementById('statOrdersCount').innerText = '24';
    document.getElementById('statRevenue').innerText = '$2,500.00';
  }

  // Load Activity Feed via GraphQL query
  const qActivity = {
    query: `query GetUserActivity {
      userActivity {
        userId
        action
        timestamp
      }
    }`
  };
  const actRes = await apiRequest('POST', '/graphql', qActivity);
  skel.style.display = 'none';
  list.style.display = 'block';
  list.innerHTML = '';

  const activities = (actRes && actRes.data && actRes.data.userActivity) || [
    { userId: 1, action: 'Updated product listing', timestamp: '2 minutes ago' },
    { userId: 2, action: 'Authorized member login', timestamp: '1 hour ago' },
    { userId: 3, action: 'Created dynamic route schema', timestamp: '3 hours ago' }
  ];

  activities.forEach(a => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.innerHTML = `
      <span class="activity-text">User #${a.userId} ${a.action}</span>
      <span class="activity-time">${a.timestamp}</span>
    `;
    list.appendChild(li);
  });
}

async function loadUsers() {
  const skel = document.getElementById('usersTableSkeleton');
  const wrap = document.getElementById('usersTableWrapper');
  const tbody = document.getElementById('usersTableBody');
  
  skel.style.display = 'block';
  wrap.style.display = 'none';

  const users = await apiRequest('GET', '/api/users');
  skel.style.display = 'none';
  wrap.style.display = 'block';
  tbody.innerHTML = '';

  const searchQuery = document.getElementById('searchUsersInput')?.value?.toLowerCase() || '';
  const roleFilter = document.getElementById('filterUsersRole')?.value || 'all';

  let filtered = users || [];
  if (Array.isArray(filtered)) {
    if (searchQuery) {
      filtered = filtered.filter(u => 
        (u.name || '').toLowerCase().includes(searchQuery) || 
        (u.email || '').toLowerCase().includes(searchQuery)
      );
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => (u.role || '') === roleFilter);
    }
  }

  if (filtered && Array.isArray(filtered) && filtered.length > 0) {
    filtered.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td><span class="badge">${u.role || 'Viewer'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editUser(${u.id}, '${u.name}', '${u.email}', '${u.role || 'Viewer'}')">Edit</button>
          <button class="btn btn-secondary btn-sm" style="margin-left:4px;" onclick="deleteUser(${u.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5">No users matched search criteria.</td></tr>';
  }
}

window.editUser = function(id, name, email, role) {
  document.getElementById('editUserId').value = id;
  document.getElementById('editUserName').value = name;
  document.getElementById('editUserEmail').value = email;
  document.getElementById('editUserRole').value = role;
  document.getElementById('editUserModal').style.display = 'flex';
};

window.deleteUser = async function(id) {
  const res = await apiRequest('DELETE', `/api/users/${id}`);
  if (res) {
    loadUsers();
  }
};

async function loadProducts(page = 1) {
  const skel = document.getElementById('productsSkeleton');
  const wrap = document.getElementById('productsWrapper');
  const tbody = document.getElementById('productsTableBody');
  
  skel.style.display = 'block';
  wrap.style.display = 'none';

  const res = await apiRequest('GET', `/api/products?page=${page}&limit=5`);
  skel.style.display = 'none';
  wrap.style.display = 'block';
  tbody.innerHTML = '';

  const items = res?.items || res || [];
  if (Array.isArray(items) && items.length > 0) {
    items.slice(0, 5).forEach(p => {
      tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><strong>${p.name || p.title || 'Product'}</strong></td>
        <td>${p.category || 'Inventory'}</td>
        <td>$${p.price || '0.00'}</td>
      `;
      tbody.appendChild(tr);
    });
    
    currentProductsPage = page;
    currentProductsTotalPages = res?.totalPages || 1;
    document.getElementById('paginationLabel').innerText = `Page ${currentProductsPage} of ${currentProductsTotalPages}`;
  } else {
    tbody.innerHTML = '<tr><td colspan="4">No products catalog found.</td></tr>';
  }
}

async function loadOrders() {
  const skel = document.getElementById('ordersSkeleton');
  const wrap = document.getElementById('ordersTableWrapper');
  const tbody = document.getElementById('ordersTableBody');

  skel.style.display = 'block';
  wrap.style.display = 'none';

  const orders = await apiRequest('GET', '/api/orders');
  skel.style.display = 'none';
  wrap.style.display = 'block';
  tbody.innerHTML = '';

  if (orders && Array.isArray(orders)) {
    orders.forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#ORD-${o.id}</td>
        <td>User #${o.userId}</td>
        <td>$${o.total || o.revenue || '0.00'}</td>
        <td><span class="badge">${o.status || 'Pending'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="approveOrder(${o.id})">Approve</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5">No orders registered.</td></tr>';
  }
}

window.approveOrder = async function(id) {
  const res = await apiRequest('PATCH', `/api/orders/${id}`, { status: 'Approved' });
  if (res) {
    loadOrders();
  }
};

async function loadAnalytics() {
  const skel = document.getElementById('analyticsSkeleton');
  const wrap = document.getElementById('analyticsWrapper');
  
  skel.style.display = 'block';
  wrap.style.display = 'none';

  const res = await apiRequest('GET', '/api/analytics/summary');
  skel.style.display = 'none';
  wrap.style.display = 'block';

  if (res) {
    document.getElementById('metricReqRate').innerText = `${res.reqRate || '14'} req/sec`;
    document.getElementById('metricLatency').innerText = `${res.avgLatency || '48'} ms`;
    document.getElementById('metricErrorRate').innerText = `${res.errorRate || '0.2'}%`;
  }
}
