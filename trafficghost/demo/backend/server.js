/**
 * Nexus API — Realistic SaaS Mock Backend for TrafficGhost
 * 
 * Provides stateful in-memory CRUD, authentication, GraphQL, analytics,
 * pagination, filtering, search, rate-limiting, and error/latency simulation.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { graphql, buildSchema } = require('graphql');

const app = express();
const PORT = process.env.PORT || 4000;
const START_TIME = Date.now();

// ---------------------------------------------------------------------------
// 1. In-Memory Data Store Initialization
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');

function loadSeedData(fileName) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, fileName), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to load ${fileName}:`, err.message);
    return [];
  }
}

let users = [];
let products = [];
let orders = [];
let notifications = [];

function resetStore() {
  users = loadSeedData('users.json');
  products = loadSeedData('products.json');
  orders = loadSeedData('orders.json');
  notifications = loadSeedData('notifications.json');
}

resetStore();

function getNextUserId() {
  const max = users.reduce((acc, u) => (typeof u.id === 'number' && u.id > acc ? u.id : acc), 0);
  return max + 1;
}

function getNextProductId() {
  const max = products.reduce((acc, p) => (typeof p.id === 'number' && p.id > acc ? p.id : acc), 0);
  return max + 1;
}

function getNextOrderNumber() {
  const max = orders.reduce((acc, o) => {
    const num = typeof o.orderNumber === 'number' ? o.orderNumber : parseInt(String(o.id).replace(/\D/g, ''), 10) || 0;
    return num > acc ? num : acc;
  }, 1000);
  return max + 1;
}

function getNextNotificationId() {
  const max = notifications.reduce((acc, n) => (typeof n.id === 'number' && n.id > acc ? n.id : acc), 0);
  return max + 1;
}

// ---------------------------------------------------------------------------
// 2. Middleware (CORS, Headers, Request ID, Logging, JSON parsing)
// ---------------------------------------------------------------------------

// Enhanced CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (like curl, postman, powershell) or known origins or any localhost
    if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for demo flexibility
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-ID', 'X-API-Version'],
  exposedHeaders: ['X-Request-ID', 'X-API-Version', 'X-Response-Time', 'X-Total-Count', 'Retry-After', 'Location']
}));

// Request Tracking & Headers Middleware
app.use((req, res, next) => {
  const startTime = process.hrtime();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-API-Version', '1.4.0');
  res.setHeader('X-Powered-By', 'Nexus-API/1.0');

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const now = new Date().toISOString().substring(11, 19);
    console.log(`[${now}] ${req.method} ${req.originalUrl} ${res.statusCode} ${timeInMs}ms (ID: ${requestId})`);
  });

  next();
});

// JSON Body Parser with malformed JSON handler
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Malformed JSON payload in request body',
      status: 400
    });
  }
  next();
});

// ---------------------------------------------------------------------------
// 3. Health & Status Endpoints
// ---------------------------------------------------------------------------
const getHealthInfo = () => ({
  status: 'ok',
  service: 'nexus-api',
  version: '1.4.0',
  environment: 'development',
  uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
  timestamp: new Date().toISOString(),
  counts: {
    users: users.length,
    products: products.length,
    orders: orders.length,
    notifications: notifications.length
  }
});

app.get('/health', (req, res) => res.json(getHealthInfo()));
app.get('/api/status', (req, res) => res.json(getHealthInfo()));
app.get('/api/health', (req, res) => res.json(getHealthInfo()));

// ---------------------------------------------------------------------------
// 4. Authentication Endpoints
// ---------------------------------------------------------------------------
const DUMMY_TOKEN = 'nexus_test_tok_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlciI6ImFkbWluQG5leHVzLnRlc3QiLCJpYXQiOjE3MTcyMzA0MDl9';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization token. Header format must be "Authorization: Bearer <token>"',
      status: 401
    });
  }
  const token = authHeader.split(' ')[1];
  if (!token || token === 'invalid' || token === 'expired') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token is invalid or has expired',
      status: 401
    });
  }
  req.user = users[0] || { id: 1, name: 'Alice Walker', email: 'alice@nexus.test', role: 'Frontend Engineer' };
  next();
}

const handleLogin = (req, res) => {
  const { email, username, password } = req.body || {};
  const identifier = (email || username || '').trim().toLowerCase();

  if (!identifier || !password) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Email/username and password are required',
      fields: {
        identifier: !identifier ? 'Email or username is required' : undefined,
        password: !password ? 'Password is required' : undefined
      },
      status: 422
    });
  }

  // Find user by email or username
  const matchedUser = users.find(u => 
    (u.email && u.email.toLowerCase() === identifier) ||
    (u.name && u.name.toLowerCase() === identifier)
  );

  // Allow standard demo credentials: admin@nexus.test / password123, alice@example.com / correct-password
  // or any valid user with password123 / correct-password / password
  const isValidPass = (password === 'password123' || password === 'correct-password' || password === 'admin' || password === 'password');

  if ((matchedUser && isValidPass) || (identifier === 'admin@nexus.test' && isValidPass) || (identifier === 'alice@example.com' && isValidPass)) {
    const user = matchedUser || users[0];
    const token = `nexus_test_tok_${Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64')}`;
    return res.status(200).json({
      token,
      user,
      expiresIn: 86400,
      tokenType: 'Bearer',
      message: 'Authentication successful'
    });
  }

  return res.status(401).json({
    error: 'UNAUTHORIZED',
    message: 'Invalid credentials. Please check your email/username and password.',
    status: 401
  });
};

app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

const handleLogout = (req, res) => {
  res.status(200).json({
    message: 'Logged out successfully',
    success: true,
    timestamp: new Date().toISOString()
  });
};

app.post('/api/auth/logout', handleLogout);
app.post('/api/logout', handleLogout);

const handleMe = (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization token',
      status: 401
    });
  }
  const token = authHeader.split(' ')[1];
  if (!token || token === 'invalid' || token === 'expired') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token is invalid or has expired',
      status: 401
    });
  }

  const user = users[0] || { id: 1, name: 'Alice Walker', email: 'alice@nexus.test', role: 'Frontend Engineer' };
  res.status(200).json({
    user,
    authenticated: true,
    sessionExpiresAt: new Date(Date.now() + 86400 * 1000).toISOString()
  });
};

app.get('/api/auth/me', handleMe);
app.get('/api/me', handleMe);

app.post('/api/auth/refresh', (req, res) => {
  const token = `nexus_test_tok_refreshed_${Date.now()}`;
  res.status(200).json({
    token,
    user: users[0],
    expiresIn: 86400,
    tokenType: 'Bearer'
  });
});

// ---------------------------------------------------------------------------
// 5. Users CRUD Endpoints (Stateful in-memory)
// ---------------------------------------------------------------------------

// GET /api/users (supports page, limit, search, role, status, department)
app.get('/api/users', (req, res) => {
  let result = [...users];
  const { page, limit, search, q, role, status, department } = req.query;

  // Search filter
  const searchQuery = (search || q || '').toLowerCase().trim();
  if (searchQuery) {
    result = result.filter(u => 
      (u.name && u.name.toLowerCase().includes(searchQuery)) ||
      (u.email && u.email.toLowerCase().includes(searchQuery)) ||
      (u.department && u.department.toLowerCase().includes(searchQuery)) ||
      (u.role && u.role.toLowerCase().includes(searchQuery))
    );
  }

  // Role filter
  if (role) {
    result = result.filter(u => u.role && u.role.toLowerCase() === role.toLowerCase());
  }

  // Status filter
  if (status) {
    result = result.filter(u => u.status && u.status.toLowerCase() === status.toLowerCase());
  }

  // Department filter
  if (department) {
    result = result.filter(u => u.department && u.department.toLowerCase() === department.toLowerCase());
  }

  const total = result.length;
  res.setHeader('X-Total-Count', total.toString());

  // Pagination
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10);

  if (limitNum && limitNum > 0) {
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = result.slice(startIndex, startIndex + limitNum);
    return res.json({
      users: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  }

  res.json({
    users: result,
    total,
    page: 1,
    limit: total,
    pages: 1,
    totalPages: 1
  });
});

// GET /api/users/:id
app.get('/api/users/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const user = users.find(u => u.id === idNum || String(u.id) === idStr);

  if (!user) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `User ${idStr} does not exist`,
      status: 404
    });
  }

  res.json(user);
});

// POST /api/users
app.post('/api/users', (req, res) => {
  const { name, email, role, status, department, phone, avatar } = req.body || {};

  // Validation
  const errors = {};
  if (!name || !name.trim()) errors.name = 'Name is required';
  if (!email || !email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Invalid email format';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid user request payload',
      fields: errors,
      status: 422
    });
  }

  const newUser = {
    id: getNextUserId(),
    name: name.trim(),
    email: email.trim(),
    role: role || 'Frontend Engineer',
    status: status || 'active',
    department: department || 'Engineering',
    phone: phone || '+1 (555) 000-0000',
    avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };

  users.push(newUser);
  res.setHeader('Location', `/api/users/${newUser.id}`);
  res.status(201).json(newUser);
});

// PUT /api/users/:id
app.put('/api/users/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const index = users.findIndex(u => u.id === idNum || String(u.id) === idStr);

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `User ${idStr} does not exist`,
      status: 404
    });
  }

  const { name, email, role, status, department, phone, avatar } = req.body || {};
  if (!name || !email) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Name and email are required for complete update',
      status: 422
    });
  }

  users[index] = {
    ...users[index],
    name: name.trim(),
    email: email.trim(),
    role: role || users[index].role,
    status: status || users[index].status,
    department: department || users[index].department,
    phone: phone || users[index].phone,
    avatar: avatar || users[index].avatar,
    updatedAt: new Date().toISOString()
  };

  res.json(users[index]);
});

// PATCH /api/users/:id
app.patch('/api/users/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const index = users.findIndex(u => u.id === idNum || String(u.id) === idStr);

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `User ${idStr} does not exist`,
      status: 404
    });
  }

  const updates = req.body || {};
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid email address',
      fields: { email: 'Invalid email format' },
      status: 422
    });
  }

  users[index] = {
    ...users[index],
    ...updates,
    id: users[index].id, // preserve ID
    updatedAt: new Date().toISOString()
  };

  res.json(users[index]);
});

// DELETE /api/users/:id
app.delete('/api/users/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const index = users.findIndex(u => u.id === idNum || String(u.id) === idStr);

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `User ${idStr} does not exist`,
      status: 404
    });
  }

  const deletedUser = users.splice(index, 1)[0];
  res.json({
    message: `User ${idStr} deleted successfully`,
    success: true,
    user: deletedUser
  });
});

// ---------------------------------------------------------------------------
// 6. Products CRUD Endpoints (Stateful in-memory)
// ---------------------------------------------------------------------------

// GET /api/products (supports category, search, minPrice, maxPrice, page, limit)
app.get('/api/products', (req, res) => {
  let result = [...products];
  const { category, search, q, minPrice, maxPrice, page, limit, sort } = req.query;

  // Category filter
  if (category) {
    result = result.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
  }

  // Search filter
  const searchQuery = (search || q || '').toLowerCase().trim();
  if (searchQuery) {
    result = result.filter(p => 
      (p.name && p.name.toLowerCase().includes(searchQuery)) ||
      (p.description && p.description.toLowerCase().includes(searchQuery)) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery))
    );
  }

  // Price filters
  if (minPrice) {
    const min = parseFloat(minPrice);
    if (!isNaN(min)) result = result.filter(p => p.price >= min);
  }
  if (maxPrice) {
    const max = parseFloat(maxPrice);
    if (!isNaN(max)) result = result.filter(p => p.price <= max);
  }

  // Sorting
  if (sort === 'price_asc') result.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') result.sort((a, b) => b.price - a.price);
  if (sort === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const total = result.length;
  res.setHeader('X-Total-Count', total.toString());

  // Pagination
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10);

  if (limitNum && limitNum > 0) {
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = result.slice(startIndex, startIndex + limitNum);
    return res.json({
      products: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  }

  res.json({
    products: result,
    total,
    page: 1,
    limit: total,
    pages: 1
  });
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const product = products.find(p => p.id === idNum || String(p.id) === idStr);

  if (!product) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Product ${idStr} not found`,
      status: 404
    });
  }

  res.json(product);
});

// POST /api/products
app.post('/api/products', (req, res) => {
  const { name, price, stock, category, description, rating, sku } = req.body || {};

  const errors = {};
  if (!name || !name.trim()) errors.name = 'Product name is required';
  if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) errors.price = 'Valid price is required';
  if (!category || !category.trim()) errors.category = 'Category is required';

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid product payload',
      fields: errors,
      status: 422
    });
  }

  const newProduct = {
    id: getNextProductId(),
    name: name.trim(),
    price: parseFloat(price),
    stock: parseInt(stock, 10) || 50,
    category: category.trim(),
    description: description || '',
    rating: parseFloat(rating) || 4.5,
    reviews: 0,
    sku: sku || `NEX-PRD-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  res.setHeader('Location', `/api/products/${newProduct.id}`);
  res.status(201).json(newProduct);
});

// PATCH /api/products/:id
app.patch('/api/products/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const index = products.findIndex(p => p.id === idNum || String(p.id) === idStr);

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Product ${idStr} not found`,
      status: 404
    });
  }

  const updates = req.body || {};
  if (updates.price !== undefined && (isNaN(parseFloat(updates.price)) || parseFloat(updates.price) < 0)) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Price must be a non-negative number',
      status: 422
    });
  }

  products[index] = {
    ...products[index],
    ...updates,
    id: products[index].id,
    updatedAt: new Date().toISOString()
  };

  res.json(products[index]);
});

// DELETE /api/products/:id
app.delete('/api/products/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const index = products.findIndex(p => p.id === idNum || String(p.id) === idStr);

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Product ${idStr} not found`,
      status: 404
    });
  }

  const deletedProduct = products.splice(index, 1)[0];
  res.json({
    message: `Product ${idStr} deleted successfully`,
    success: true,
    product: deletedProduct
  });
});

// ---------------------------------------------------------------------------
// 7. Orders CRUD Endpoints (Stateful in-memory)
// ---------------------------------------------------------------------------

// GET /api/orders (supports status, userId, page, limit)
app.get('/api/orders', (req, res) => {
  let result = [...orders];
  const { status, userId, page, limit } = req.query;

  if (status) {
    result = result.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
  }

  if (userId) {
    const uId = parseInt(userId, 10);
    result = result.filter(o => o.userId === uId || String(o.userId) === userId);
  }

  const total = result.length;
  res.setHeader('X-Total-Count', total.toString());

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10);

  if (limitNum && limitNum > 0) {
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = result.slice(startIndex, startIndex + limitNum);
    return res.json({
      orders: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  }

  res.json({
    orders: result,
    total
  });
});

// GET /api/orders/:id
app.get('/api/orders/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr.replace(/\D/g, ''), 10);
  const order = orders.find(o => 
    String(o.id).toLowerCase() === idStr.toLowerCase() || 
    o.orderNumber === idNum ||
    String(o.orderNumber) === idStr
  );

  if (!order) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Order ${idStr} not found`,
      status: 404
    });
  }

  res.json(order);
});

// POST /api/orders
app.post('/api/orders', (req, res) => {
  const { userId, items, status, paymentMethod } = req.body || {};

  if (!userId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'userId and non-empty items array are required',
      fields: {
        userId: !userId ? 'userId is required' : undefined,
        items: (!items || !items.length) ? 'items array must contain at least one item' : undefined
      },
      status: 422
    });
  }

  // Calculate order total
  let total = 0;
  const processedItems = items.map(item => {
    const matchedProduct = products.find(p => p.id === item.productId || String(p.id) === String(item.productId));
    const price = item.price !== undefined ? parseFloat(item.price) : (matchedProduct ? matchedProduct.price : 49.99);
    const quantity = parseInt(item.quantity, 10) || 1;
    total += price * quantity;
    return {
      productId: item.productId,
      name: item.name || (matchedProduct ? matchedProduct.name : `Product #${item.productId}`),
      quantity,
      price: parseFloat(price.toFixed(2))
    };
  });

  const nextNum = getNextOrderNumber();
  const newOrder = {
    id: `ORD-${String(nextNum).padStart(3, '0')}`,
    orderNumber: nextNum,
    userId: parseInt(userId, 10) || userId,
    status: status || 'pending',
    total: parseFloat(total.toFixed(2)),
    currency: 'USD',
    paymentStatus: 'pending',
    paymentMethod: paymentMethod || 'credit_card',
    items: processedItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.push(newOrder);
  res.setHeader('Location', `/api/orders/${newOrder.id}`);
  res.status(201).json(newOrder);
});

// PATCH /api/orders/:id
app.patch('/api/orders/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr.replace(/\D/g, ''), 10);
  const index = orders.findIndex(o => 
    String(o.id).toLowerCase() === idStr.toLowerCase() || 
    o.orderNumber === idNum ||
    String(o.orderNumber) === idStr
  );

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Order ${idStr} not found`,
      status: 404
    });
  }

  const updates = req.body || {};
  orders[index] = {
    ...orders[index],
    ...updates,
    id: orders[index].id,
    updatedAt: new Date().toISOString()
  };

  res.json(orders[index]);
});

// DELETE /api/orders/:id
app.delete('/api/orders/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr.replace(/\D/g, ''), 10);
  const index = orders.findIndex(o => 
    String(o.id).toLowerCase() === idStr.toLowerCase() || 
    o.orderNumber === idNum ||
    String(o.orderNumber) === idStr
  );

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Order ${idStr} not found`,
      status: 404
    });
  }

  const deletedOrder = orders.splice(index, 1)[0];
  res.json({
    message: `Order ${idStr} deleted successfully`,
    success: true,
    order: deletedOrder
  });
});

// ---------------------------------------------------------------------------
// 8. Analytics Endpoints
// ---------------------------------------------------------------------------
app.get('/api/analytics/overview', (req, res) => {
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const activeUsersCount = users.filter(u => u.status === 'active').length;

  res.json({
    timestamp: new Date().toISOString(),
    metrics: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      currency: 'USD',
      activeUsers: activeUsersCount,
      totalUsers: users.length,
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.status === 'completed' || o.status === 'delivered').length,
      pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'processing').length,
      averageOrderValue: parseFloat((totalRevenue / (orders.length || 1)).toFixed(2)),
      mrr: 18450.00,
      arr: 221400.00,
      conversionRate: 4.82,
      growthRateMoM: 14.5
    },
    systemHealth: {
      uptimePercent: 99.98,
      avgLatencyMs: 42.6,
      errorRatePercent: 0.12
    }
  });
});

app.get('/api/analytics/revenue', (req, res) => {
  res.json({
    currency: 'USD',
    period: '2024-YTD',
    monthly: [
      { month: '2024-01', revenue: 12450.00, ordersCount: 84, growth: 12.0 },
      { month: '2024-02', revenue: 14120.00, ordersCount: 96, growth: 13.4 },
      { month: '2024-03', revenue: 16890.00, ordersCount: 112, growth: 19.6 },
      { month: '2024-04', revenue: 17400.00, ordersCount: 119, growth: 3.0 },
      { month: '2024-05', revenue: 18450.00, ordersCount: 131, growth: 6.0 },
      { month: '2024-06', revenue: 19900.00, ordersCount: 145, growth: 7.8 }
    ],
    byCategory: [
      { category: 'Cloud Infrastructure', total: 42500.00, share: 42.8 },
      { category: 'Security', total: 24800.00, share: 24.9 },
      { category: 'Developer Tools', total: 18300.00, share: 18.4 },
      { category: 'Electronics', total: 13800.00, share: 13.9 }
    ]
  });
});

app.get('/api/analytics/users', (req, res) => {
  res.json({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    inactiveUsers: users.filter(u => u.status === 'inactive').length,
    suspendedUsers: users.filter(u => u.status === 'suspended').length,
    byDepartment: {
      Engineering: users.filter(u => u.department === 'Engineering').length,
      Product: users.filter(u => u.department === 'Product').length,
      Security: users.filter(u => u.department === 'Security').length,
      Infrastructure: users.filter(u => u.department === 'Infrastructure').length,
      Marketing: users.filter(u => u.department === 'Marketing').length,
      Other: users.filter(u => !['Engineering', 'Product', 'Security', 'Infrastructure', 'Marketing'].includes(u.department)).length
    },
    weeklyActiveUsers: [450, 482, 510, 538, 590, 612],
    retentionRate90Day: 88.4
  });
});

app.get('/api/analytics/activity', (req, res) => {
  res.json({
    recentEvents: [
      { id: 'evt-101', event: 'user.login', user: 'admin@nexus.test', ip: '192.168.1.10', timestamp: new Date(Date.now() - 120000).toISOString() },
      { id: 'evt-102', event: 'order.created', orderId: 'ORD-021', amount: 99.98, timestamp: new Date(Date.now() - 300000).toISOString() },
      { id: 'evt-103', event: 'product.updated', productId: 201, changedField: 'stock', timestamp: new Date(Date.now() - 600000).toISOString() },
      { id: 'evt-104', event: 'security.token_refreshed', userId: 1, timestamp: new Date(Date.now() - 900000).toISOString() },
      { id: 'evt-105', event: 'system.backup_completed', durationMs: 14200, timestamp: new Date(Date.now() - 1800000).toISOString() }
    ],
    totalEventsLast24h: 14820,
    peakHour: '14:00 UTC'
  });
});

// ---------------------------------------------------------------------------
// 9. Notifications Endpoints
// ---------------------------------------------------------------------------
app.get('/api/notifications', (req, res) => {
  let result = [...notifications];
  const { unreadOnly, limit } = req.query;

  if (unreadOnly === 'true' || unreadOnly === '1') {
    result = result.filter(n => !n.read);
  }

  const limitNum = parseInt(limit, 10);
  if (limitNum && limitNum > 0) {
    result = result.slice(0, limitNum);
  }

  res.json({
    notifications: result,
    unreadCount: notifications.filter(n => !n.read).length,
    total: notifications.length
  });
});

app.patch('/api/notifications/:id/read', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const notification = notifications.find(n => n.id === idNum || String(n.id) === idStr);

  if (!notification) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Notification ${idStr} not found`,
      status: 404
    });
  }

  notification.read = true;
  notification.readAt = new Date().toISOString();

  res.json({
    message: 'Notification marked as read',
    notification
  });
});

app.patch('/api/notifications/read-all', (req, res) => {
  notifications.forEach(n => {
    n.read = true;
    n.readAt = new Date().toISOString();
  });

  res.json({
    message: 'All notifications marked as read',
    count: notifications.length
  });
});

app.delete('/api/notifications/:id', (req, res) => {
  const idStr = req.params.id;
  const idNum = parseInt(idStr, 10);
  const index = notifications.findIndex(n => n.id === idNum || String(n.id) === idStr);

  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Notification ${idStr} not found`,
      status: 404
    });
  }

  const deleted = notifications.splice(index, 1)[0];
  res.json({
    message: `Notification ${idStr} deleted successfully`,
    notification: deleted
  });
});

// ---------------------------------------------------------------------------
// 10. Global Search Endpoint
// ---------------------------------------------------------------------------
app.get('/api/search', (req, res) => {
  const query = (req.query.q || req.query.query || '').trim().toLowerCase();
  if (!query) {
    return res.json({
      query: '',
      results: { users: [], products: [], orders: [] },
      totalMatches: 0
    });
  }

  const matchedUsers = users.filter(u =>
    (u.name && u.name.toLowerCase().includes(query)) ||
    (u.email && u.email.toLowerCase().includes(query)) ||
    (u.department && u.department.toLowerCase().includes(query)) ||
    (u.role && u.role.toLowerCase().includes(query))
  );

  const matchedProducts = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.category && p.category.toLowerCase().includes(query)) ||
    (p.description && p.description.toLowerCase().includes(query)) ||
    (p.sku && p.sku.toLowerCase().includes(query))
  );

  const matchedOrders = orders.filter(o =>
    String(o.id).toLowerCase().includes(query) ||
    String(o.status).toLowerCase().includes(query) ||
    (o.items && o.items.some(i => i.name && i.name.toLowerCase().includes(query)))
  );

  res.json({
    query,
    results: {
      users: matchedUsers,
      products: matchedProducts,
      orders: matchedOrders
    },
    totalMatches: matchedUsers.length + matchedProducts.length + matchedOrders.length
  });
});

// ---------------------------------------------------------------------------
// 11. GraphQL Implementation (POST /graphql)
// ---------------------------------------------------------------------------
const schema = buildSchema(`
  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    status: String
    department: String
    phone: String
    avatar: String
    createdAt: String
  }

  type Product {
    id: ID!
    name: String!
    price: Float!
    stock: Int
    category: String!
    description: String
    rating: Float
    reviews: Int
    sku: String
  }

  type OrderItem {
    productId: Int!
    name: String
    quantity: Int!
    price: Float!
  }

  type Order {
    id: ID!
    orderNumber: Int
    userId: Int!
    status: String!
    total: Float!
    currency: String
    items: [OrderItem]
    createdAt: String
  }

  type Query {
    users(limit: Int, role: String, department: String): [User]
    user(id: ID!): User
    products(limit: Int, category: String): [Product]
    product(id: ID!): Product
    orders(userId: Int, status: String): [Order]
    order(id: ID!): Order
  }

  type Mutation {
    createUser(name: String!, email: String!, role: String!, department: String): User
    updateUser(id: ID!, name: String, email: String, role: String): User
    deleteUser(id: ID!): Boolean
    createProduct(name: String!, price: Float!, category: String!, stock: Int): Product
  }
`);

const rootResolvers = {
  users: ({ limit, role, department }) => {
    let list = [...users];
    if (role) list = list.filter(u => u.role && u.role.toLowerCase() === role.toLowerCase());
    if (department) list = list.filter(u => u.department && u.department.toLowerCase() === department.toLowerCase());
    if (limit && limit > 0) list = list.slice(0, limit);
    return list;
  },
  user: ({ id }) => {
    const idNum = parseInt(id, 10);
    return users.find(u => u.id === idNum || String(u.id) === String(id)) || null;
  },
  products: ({ limit, category }) => {
    let list = [...products];
    if (category) list = list.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
    if (limit && limit > 0) list = list.slice(0, limit);
    return list;
  },
  product: ({ id }) => {
    const idNum = parseInt(id, 10);
    return products.find(p => p.id === idNum || String(p.id) === String(id)) || null;
  },
  orders: ({ userId, status }) => {
    let list = [...orders];
    if (userId) list = list.filter(o => o.userId === parseInt(userId, 10));
    if (status) list = list.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
    return list;
  },
  order: ({ id }) => {
    const idNum = parseInt(String(id).replace(/\D/g, ''), 10);
    return orders.find(o => String(o.id).toLowerCase() === String(id).toLowerCase() || o.orderNumber === idNum) || null;
  },
  createUser: ({ name, email, role, department }) => {
    const newUser = {
      id: getNextUserId(),
      name: name.trim(),
      email: email.trim(),
      role: role || 'Frontend Engineer',
      status: 'active',
      department: department || 'Engineering',
      phone: '+1 (555) 000-0000',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    users.push(newUser);
    return newUser;
  },
  updateUser: ({ id, name, email, role }) => {
    const idNum = parseInt(id, 10);
    const index = users.findIndex(u => u.id === idNum || String(u.id) === String(id));
    if (index === -1) return null;
    if (name) users[index].name = name;
    if (email) users[index].email = email;
    if (role) users[index].role = role;
    return users[index];
  },
  deleteUser: ({ id }) => {
    const idNum = parseInt(id, 10);
    const index = users.findIndex(u => u.id === idNum || String(u.id) === String(id));
    if (index === -1) return false;
    users.splice(index, 1);
    return true;
  },
  createProduct: ({ name, price, category, stock }) => {
    const newProduct = {
      id: getNextProductId(),
      name: name.trim(),
      price: parseFloat(price),
      category: category.trim(),
      stock: stock || 50,
      description: '',
      rating: 4.5,
      reviews: 0,
      sku: `NEX-GQL-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    return newProduct;
  }
};

app.post('/graphql', async (req, res) => {
  const { query, variables, operationName } = req.body || {};

  if (!query) {
    return res.status(400).json({
      errors: [{ message: 'GraphQL query or mutation string is required in request body' }]
    });
  }

  try {
    const result = await graphql({
      schema,
      source: query,
      rootValue: rootResolvers,
      variableValues: variables,
      operationName
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      errors: [{ message: err.message }]
    });
  }
});

// ---------------------------------------------------------------------------
// 12. Error Simulation Endpoints (Explicit HTTP Status Code Testing)
// ---------------------------------------------------------------------------
const errorResponses = {
  400: { error: 'BAD_REQUEST', message: 'The request was unacceptable, often due to missing a required parameter.', status: 400 },
  401: { error: 'UNAUTHORIZED', message: 'No valid API key or Bearer token provided.', status: 401 },
  403: { error: 'FORBIDDEN', message: 'The API key does not have permissions to perform the request.', status: 403 },
  404: { error: 'NOT_FOUND', message: 'The requested resource does not exist.', status: 404 },
  409: { error: 'CONFLICT', message: 'The request could not be completed due to a conflict with current resource state.', status: 409 },
  422: { error: 'UNPROCESSABLE_ENTITY', message: 'The request payload contains semantic validation errors.', status: 422, fields: { email: 'Invalid format', price: 'Must be positive' } },
  429: { error: 'RATE_LIMITED', message: 'Too many requests. You have exceeded your tier request quota.', status: 429, retryAfter: 30 },
  500: { error: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred on Nexus API servers. Our engineers have been notified.', status: 500 },
  502: { error: 'BAD_GATEWAY', message: 'The upstream microservice failed to respond within time.', status: 502 },
  503: { error: 'SERVICE_UNAVAILABLE', message: 'Nexus API is temporarily undergoing scheduled maintenance.', status: 503, retryAfter: 60 },
  504: { error: 'GATEWAY_TIMEOUT', message: 'The gateway timed out waiting for the database replica to respond.', status: 504 }
};

// Explicit route for each status
Object.entries(errorResponses).forEach(([code, payload]) => {
  app.get(`/api/demo/errors/${code}`, (req, res) => {
    const statusCode = parseInt(code, 10);
    if (statusCode === 429 || statusCode === 503) {
      res.setHeader('Retry-After', payload.retryAfter.toString());
    }
    res.status(statusCode).json(payload);
  });
});

// Dynamic error code route
app.get('/api/demo/errors/:code', (req, res) => {
  const code = parseInt(req.params.code, 10);
  if (isNaN(code) || code < 100 || code > 599) {
    return res.status(400).json({ error: 'INVALID_STATUS_CODE', message: 'Status code must be between 100 and 599' });
  }
  const payload = errorResponses[code] || {
    error: `HTTP_${code}`,
    message: `Simulated error for HTTP status ${code}`,
    status: code
  };
  res.status(code).json(payload);
});

// ---------------------------------------------------------------------------
// 13. Latency & Chaos Testing Endpoints
// ---------------------------------------------------------------------------

// GET /api/demo/slow/:milliseconds (cap at 10,000ms)
app.get('/api/demo/slow/:milliseconds', (req, res) => {
  const reqMs = parseInt(req.params.milliseconds, 10);
  const ms = isNaN(reqMs) ? 1000 : Math.min(Math.max(reqMs, 0), 10000);

  setTimeout(() => {
    res.json({
      status: 'ok',
      delayedMs: ms,
      message: `Response was intentionally delayed by ${ms}ms for TrafficGhost latency testing.`
    });
  }, ms);
});

// GET /api/demo/flaky (configurable probability of 500 failure)
app.get('/api/demo/flaky', (req, res) => {
  const rate = parseFloat(req.query.failureRate || '0.5');
  const isFailure = Math.random() < rate;

  if (isFailure) {
    return res.status(500).json({
      error: 'CHAOS_FAILURE',
      message: 'Simulated intermittent server breakdown (Flaky endpoint).',
      status: 500,
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    status: 'ok',
    message: 'Flaky endpoint succeeded on this attempt.',
    timestamp: new Date().toISOString()
  });
});

// GET /api/demo/timeout (12 second delay to test client timeouts)
app.get('/api/demo/timeout', (req, res) => {
  const delay = parseInt(req.query.delay || '12000', 10);
  setTimeout(() => {
    res.json({
      status: 'ok',
      message: `Timeout endpoint completed after ${delay}ms.`
    });
  }, Math.min(delay, 20000));
});

// ---------------------------------------------------------------------------
// 14. Rate Limiting Demo Endpoint
// ---------------------------------------------------------------------------
const rateLimitCounters = new Map();

app.get('/api/demo/rate-limit', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'client';
  const now = Date.now();
  const windowMs = 30000; // 30 second window
  const maxRequests = 5;

  let clientData = rateLimitCounters.get(clientIp);
  if (!clientData || (now - clientData.startTime) > windowMs) {
    clientData = { count: 1, startTime: now };
  } else {
    clientData.count += 1;
  }
  rateLimitCounters.set(clientIp, clientData);

  const remaining = Math.max(0, maxRequests - clientData.count);
  const resetSeconds = Math.ceil((clientData.startTime + windowMs - now) / 1000);

  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

  if (clientData.count > maxRequests) {
    res.setHeader('Retry-After', resetSeconds.toString());
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: `Rate limit exceeded. Maximum ${maxRequests} requests per 30 seconds.`,
      status: 429,
      retryAfter: resetSeconds,
      currentCount: clientData.count
    });
  }

  res.json({
    status: 'ok',
    message: `Request accepted. ${remaining} requests remaining in current window.`,
    requestsMade: clientData.count,
    limit: maxRequests,
    windowSecondsRemaining: resetSeconds
  });
});

app.get('/api/demo/rate-limit/reset', (req, res) => {
  rateLimitCounters.clear();
  res.json({ message: 'Rate limit counters reset successfully', success: true });
});

// Reset entire database store to initial seed
app.post('/api/demo/reset', (req, res) => {
  resetStore();
  res.json({
    message: 'Store reset to initial JSON seed data successfully',
    counts: {
      users: users.length,
      products: products.length,
      orders: orders.length,
      notifications: notifications.length
    }
  });
});

// ---------------------------------------------------------------------------
// 15. Catch-All 404 Handler for Unknown Routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route '${req.method} ${req.originalUrl}' not found on Nexus API`,
    path: req.originalUrl,
    method: req.method,
    status: 404,
    availableEndpoints: '/health'
  });
});

// ---------------------------------------------------------------------------
// 16. Server Startup
// ---------------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Nexus API Mock Backend running on http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/health`);
    console.log(`📊 Total Seed: ${users.length} users, ${products.length} products, ${orders.length} orders`);
    console.log(`🔮 GraphQL: POST http://localhost:${PORT}/graphql`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
