/**
 * Comprehensive Verification Test Suite for Nexus API Mock Backend
 */

const http = require('http');

const BASE_URL = 'http://localhost:4000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 Starting Nexus API Comprehensive Verification Test Suite');
  console.log('===========================================================\n');

  try {
    // 1. Health & Status
    console.log('1. Testing Health & Status Endpoints...');
    const health = await request('GET', '/health');
    assert(health.status === 200, 'GET /health returns 200');
    assert(health.data.status === 'ok', 'Health status is "ok"');
    assert(health.data.service === 'nexus-api', 'Service is "nexus-api"');
    assert(health.headers['x-request-id'] !== undefined, 'X-Request-ID header present');
    assert(health.headers['x-api-version'] === '1.4.0', 'X-API-Version header is 1.4.0');

    const status = await request('GET', '/api/status');
    assert(status.status === 200, 'GET /api/status returns 200');

    // 2. Authentication
    console.log('\n2. Testing Authentication...');
    const loginFail = await request('POST', '/api/auth/login', { email: 'admin@nexus.test', password: 'wrong' });
    assert(loginFail.status === 401, 'Login with wrong password returns 401');

    const loginSuccess = await request('POST', '/api/auth/login', { email: 'admin@nexus.test', password: 'password123' });
    assert(loginSuccess.status === 200, 'Login with valid credentials returns 200');
    assert(!!loginSuccess.data.token, 'Login returns JWT/auth token');
    const token = loginSuccess.data.token;

    // Frontend compatible route
    const loginCompat = await request('POST', '/api/login', { username: 'alice@example.com', password: 'correct-password' });
    assert(loginCompat.status === 200, 'POST /api/login compatibility route works');

    // Profile me
    const meUnauth = await request('GET', '/api/auth/me');
    assert(meUnauth.status === 401, 'GET /api/auth/me without token returns 401');

    const meAuth = await request('GET', '/api/auth/me', null, { Authorization: `Bearer ${token}` });
    assert(meAuth.status === 200, 'GET /api/auth/me with Bearer token returns 200');
    assert(meAuth.data.authenticated === true, 'Profile indicates authenticated');

    // Refresh & Logout
    const refresh = await request('POST', '/api/auth/refresh');
    assert(refresh.status === 200 && !!refresh.data.token, 'POST /api/auth/refresh returns 200 with new token');

    const logout = await request('POST', '/api/auth/logout');
    assert(logout.status === 200 && logout.data.success === true, 'POST /api/auth/logout returns 200');

    // 3. Stateful Users CRUD
    console.log('\n3. Testing Stateful Users CRUD...');
    const usersList = await request('GET', '/api/users?page=1&limit=5');
    assert(usersList.status === 200, 'GET /api/users returns 200');
    assert(Array.isArray(usersList.data.users) && usersList.data.users.length === 5, 'Users pagination returns 5 users');
    assert(usersList.data.total >= 20, 'Seed data has 20+ users');

    // Filter by role
    const adminUsers = await request('GET', '/api/users?role=admin');
    assert(adminUsers.data.users.every(u => u.role.toLowerCase() === 'admin'), 'Role filtering functions accurately');

    // Single User GET
    const user1 = await request('GET', '/api/users/1');
    assert(user1.status === 200 && user1.data.name === 'Alice Walker', 'GET /api/users/1 retrieves Alice Walker');

    const user404 = await request('GET', '/api/users/99999');
    assert(user404.status === 404, 'GET /api/users/99999 returns 404');

    // Validation error
    const userInvalid = await request('POST', '/api/users', { name: 'No Email' });
    assert(userInvalid.status === 422, 'POST /api/users without email returns 422 validation error');

    // State lifecycle: POST -> GET -> PATCH -> GET -> DELETE -> GET
    console.log('   Testing state lifecycle: POST -> GET -> PATCH -> GET -> DELETE -> GET...');
    const createRes = await request('POST', '/api/users', {
      name: 'Test Engineer Alpha',
      email: 'alpha.test@nexus.test',
      role: 'QA Architect',
      department: 'Engineering'
    });
    assert(createRes.status === 201, 'POST /api/users creates user with 201 Created');
    const createdUserId = createRes.data.id;
    assert(createdUserId !== undefined, `User created with ID ${createdUserId}`);

    const verifyCreate = await request('GET', `/api/users/${createdUserId}`);
    assert(verifyCreate.status === 200 && verifyCreate.data.email === 'alpha.test@nexus.test', 'GET verifies newly created user exists');

    const patchRes = await request('PATCH', `/api/users/${createdUserId}`, { role: 'Principal QA Architect' });
    assert(patchRes.status === 200 && patchRes.data.role === 'Principal QA Architect', 'PATCH modifies user role in-memory');

    const verifyPatch = await request('GET', `/api/users/${createdUserId}`);
    assert(verifyPatch.data.role === 'Principal QA Architect', 'GET verifies updated role persisted');

    const deleteRes = await request('DELETE', `/api/users/${createdUserId}`);
    assert(deleteRes.status === 200, 'DELETE /api/users/:id deletes user');

    const verifyDelete = await request('GET', `/api/users/${createdUserId}`);
    assert(verifyDelete.status === 404, 'GET after DELETE returns 404 Not Found (Stateful lifecycle verified)');

    // 4. Products CRUD
    console.log('\n4. Testing Products Endpoints...');
    const productsList = await request('GET', '/api/products?category=Electronics');
    assert(productsList.status === 200, 'GET /api/products returns 200');
    assert(productsList.data.products.length > 0, 'Products catalog returned items');

    const createProduct = await request('POST', '/api/products', {
      name: 'Edge AI Node',
      price: 199.99,
      category: 'AI & ML',
      stock: 45
    });
    assert(createProduct.status === 201, 'POST /api/products creates product');
    const newProductId = createProduct.data.id;

    const patchProduct = await request('PATCH', `/api/products/${newProductId}`, { price: 179.99 });
    assert(patchProduct.status === 200 && patchProduct.data.price === 179.99, 'PATCH product updates price');

    const deleteProduct = await request('DELETE', `/api/products/${newProductId}`);
    assert(deleteProduct.status === 200, 'DELETE product removes product');

    // 5. Orders CRUD
    console.log('\n5. Testing Orders Endpoints...');
    const ordersList = await request('GET', '/api/orders');
    assert(ordersList.status === 200 && ordersList.data.orders.length >= 20, 'GET /api/orders returns 20+ orders');

    const createOrder = await request('POST', '/api/orders', {
      userId: 1,
      items: [
        { productId: 201, quantity: 2, price: 79.99 },
        { productId: 202, quantity: 1, price: 49.99 }
      ]
    });
    assert(createOrder.status === 201, 'POST /api/orders creates order with 201');
    assert(createOrder.data.total === 209.97, 'Order calculates total correctly (79.99*2 + 49.99 = 209.97)');

    // 6. Analytics
    console.log('\n6. Testing Analytics Endpoints...');
    const overview = await request('GET', '/api/analytics/overview');
    assert(overview.status === 200 && overview.data.metrics.totalRevenue > 0, 'GET /api/analytics/overview returns metrics');

    const revenue = await request('GET', '/api/analytics/revenue');
    assert(revenue.status === 200 && Array.isArray(revenue.data.monthly), 'GET /api/analytics/revenue returns time-series');

    const analyticsUsers = await request('GET', '/api/analytics/users');
    assert(analyticsUsers.status === 200 && analyticsUsers.data.totalUsers > 0, 'GET /api/analytics/users returns cohort data');

    const activity = await request('GET', '/api/analytics/activity');
    assert(activity.status === 200 && Array.isArray(activity.data.recentEvents), 'GET /api/analytics/activity returns events');

    // 7. Notifications
    console.log('\n7. Testing Notifications Endpoints...');
    const notifs = await request('GET', '/api/notifications');
    assert(notifs.status === 200 && notifs.data.notifications.length >= 10, 'GET /api/notifications returns 10+ notifications');

    const readNotif = await request('PATCH', '/api/notifications/1/read');
    assert(readNotif.status === 200 && readNotif.data.notification.read === true, 'PATCH /api/notifications/1/read marks read');

    // 8. Search
    console.log('\n8. Testing Search Endpoint...');
    const searchRes = await request('GET', '/api/search?q=keyboard');
    assert(searchRes.status === 200, 'GET /api/search returns 200');
    assert(searchRes.data.results.products.some(p => p.name.includes('Keyboard')), 'Search matches "Keyboard" in products');

    // 9. GraphQL
    console.log('\n9. Testing GraphQL (POST /graphql)...');
    const gqlUsers = await request('POST', '/graphql', {
      query: `
        query {
          users(limit: 3) {
            id
            name
            email
            role
          }
          products(limit: 2) {
            id
            name
            price
          }
        }
      `
    });
    assert(gqlUsers.status === 200, 'POST /graphql returns 200');
    assert(gqlUsers.data.data && Array.isArray(gqlUsers.data.data.users), 'GraphQL users query resolved successfully');
    assert(gqlUsers.data.data.products.length === 2, 'GraphQL products query resolved successfully');

    // GraphQL Mutation
    const gqlMut = await request('POST', '/graphql', {
      query: `
        mutation {
          createUser(name: "GraphQL User", email: "gql@nexus.test", role: "Developer") {
            id
            name
            email
          }
        }
      `
    });
    assert(gqlMut.data.data && gqlMut.data.data.createUser.name === 'GraphQL User', 'GraphQL createUser mutation succeeds');

    // 10. Error Simulation
    console.log('\n10. Testing Error Simulation Endpoints...');
    const codes = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504];
    for (const code of codes) {
      const errRes = await request('GET', `/api/demo/errors/${code}`);
      assert(errRes.status === code, `GET /api/demo/errors/${code} correctly returns HTTP ${code}`);
      assert(errRes.data.status === code, `Error payload contains status: ${code}`);
    }

    // 11. Latency Testing
    console.log('\n11. Testing Latency Endpoint...');
    const startT = Date.now();
    const slowRes = await request('GET', '/api/demo/slow/300');
    const elapsed = Date.now() - startT;
    assert(slowRes.status === 200, 'GET /api/demo/slow/300 returns 200');
    assert(elapsed >= 280, `Response delayed appropriately (${elapsed}ms >= 300ms nominal)`);

    // 12. Rate Limiting Demo
    console.log('\n12. Testing Rate Limiting...');
    await request('GET', '/api/demo/rate-limit/reset');
    for (let i = 1; i <= 5; i++) {
      await request('GET', '/api/demo/rate-limit');
    }
    const rateLimitExceeded = await request('GET', '/api/demo/rate-limit');
    assert(rateLimitExceeded.status === 429, 'Rate limit endpoint returns 429 after 5 requests');
    assert(rateLimitExceeded.headers['retry-after'] !== undefined, 'Retry-After header present on 429');

    // 13. Unknown Route 404 Catch-All
    console.log('\n13. Testing 404 Catch-All...');
    const unknownRoute = await request('GET', '/api/nonexistent/endpoint');
    assert(unknownRoute.status === 404, 'Unknown route returns 404');
    assert(unknownRoute.data.error === 'NOT_FOUND', '404 error code is NOT_FOUND');

    console.log('\n===========================================================');
    console.log(`🎉 TEST SUITE COMPLETE: ${passed} passed, ${failed} failed`);
    console.log('===========================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
