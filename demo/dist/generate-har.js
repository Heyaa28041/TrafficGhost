"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSampleHar = generateSampleHar;
const fs = require("fs");
const path = require("path");
function makeHarEntry(method, urlPath, queryParams, reqBody, status, resBody, duration = 45) {
    const host = 'api.staging.example.com';
    const queryStr = Object.entries(queryParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const fullUrl = `https://${host}${urlPath}${queryStr ? '?' + queryStr : ''}`;
    const resText = typeof resBody === 'string' ? resBody : JSON.stringify(resBody);
    const reqText = reqBody ? (typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody)) : '';
    return {
        startedDateTime: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
        time: duration,
        request: {
            method,
            url: fullUrl,
            httpVersion: 'HTTP/1.1',
            headers: [
                { name: 'Host', value: host },
                { name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
                { name: 'Accept', value: 'application/json' },
                { name: 'Authorization', value: 'Bearer secret_token_xyz987654321' },
                { name: 'Cookie', value: 'session_id=s%3Aabcdef123456; theme=dark' },
                { name: 'X-API-Key', value: 'staging_key_9988776655' },
                ...(reqBody ? [{ name: 'Content-Type', value: 'application/json' }] : [])
            ],
            queryString: Object.entries(queryParams).map(([name, value]) => ({ name, value })),
            postData: reqBody ? { mimeType: 'application/json', text: reqText } : undefined,
            headersSize: 250,
            bodySize: reqText.length
        },
        response: {
            status,
            statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : status === 404 ? 'Not Found' : status === 429 ? 'Too Many Requests' : 'Internal Server Error',
            httpVersion: 'HTTP/1.1',
            headers: [
                { name: 'Content-Type', value: 'application/json; charset=utf-8' },
                { name: 'Set-Cookie', value: 'session_refresh=secret_cookie_val; HttpOnly' },
                { name: 'Server', value: 'nginx/1.24.0' },
                { name: 'X-Powered-By', value: 'Express' }
            ],
            content: {
                size: resText.length,
                mimeType: 'application/json',
                text: resText
            },
            headersSize: 200,
            bodySize: resText.length
        },
        timings: {
            blocked: 1,
            dns: 2,
            connect: 4,
            send: 1,
            wait: duration - 10,
            receive: 2,
            ssl: 3
        }
    };
}
function generateSampleHar() {
    const entries = [];
    // 1. Users endpoints
    entries.push(makeHarEntry('GET', '/api/users', {}, undefined, 200, {
        users: [
            { id: 1, name: 'Alice Walker', email: 'alice@example.com', role: 'Staff Frontend Engineer', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
            { id: 2, name: 'Bob Martinez', email: 'bob@example.com', role: 'Backend Lead', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
            { id: 3, name: 'Charlie Kim', email: 'charlie@example.com', role: 'Product Designer', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }
        ],
        total: 3
    }));
    // Distinct user IDs for route inferrer
    entries.push(makeHarEntry('GET', '/api/users/1', {}, undefined, 200, {
        id: 1,
        name: 'Alice Walker',
        email: 'alice@example.com',
        role: 'Staff Frontend Engineer',
        department: 'Web Platform',
        status: 'active',
        joinedDate: '2023-01-15'
    }));
    entries.push(makeHarEntry('GET', '/api/users/2', {}, undefined, 200, {
        id: 2,
        name: 'Bob Martinez',
        email: 'bob@example.com',
        role: 'Backend Lead',
        department: 'Infrastructure',
        status: 'active',
        joinedDate: '2022-06-20'
    }));
    entries.push(makeHarEntry('GET', '/api/users/3', {}, undefined, 200, {
        id: 3,
        name: 'Charlie Kim',
        email: 'charlie@example.com',
        role: 'Product Designer',
        department: 'Design Systems',
        status: 'active',
        joinedDate: '2023-09-01'
    }));
    // Create User
    entries.push(makeHarEntry('POST', '/api/users', {}, { name: 'Diana Prince', email: 'diana@example.com', role: 'Security Architect' }, 201, {
        id: 4,
        name: 'Diana Prince',
        email: 'diana@example.com',
        role: 'Security Architect',
        createdAt: new Date().toISOString()
    }));
    // Update User
    entries.push(makeHarEntry('PUT', '/api/users/1', {}, { name: 'Alice Walker Updated', role: 'Principal Engineer' }, 200, {
        id: 1,
        name: 'Alice Walker Updated',
        role: 'Principal Engineer',
        updatedAt: new Date().toISOString()
    }));
    // Delete User
    entries.push(makeHarEntry('DELETE', '/api/users/3', {}, undefined, 200, {
        success: true,
        message: 'User 3 deleted successfully'
    }));
    // 2. Products endpoints with Pagination
    const page1Products = [
        { id: 101, title: 'Mechanical Keyboard Pro', category: 'Hardware', price: 179.99, rating: 4.8, inStock: true },
        { id: 102, title: 'Ergonomic Vertical Mouse', category: 'Hardware', price: 89.99, rating: 4.6, inStock: true },
        { id: 103, title: 'UltraWide Curved 34-inch Monitor', category: 'Displays', price: 649.00, rating: 4.9, inStock: false },
        { id: 104, title: 'Active Noise-Cancelling Headphones', category: 'Audio', price: 299.99, rating: 4.7, inStock: true },
        { id: 105, title: 'USB-C Dual 4K Docking Station', category: 'Accessories', price: 149.50, rating: 4.5, inStock: true }
    ];
    const page2Products = [
        { id: 106, title: 'Motorized Standing Desk 60x30', category: 'Furniture', price: 549.00, rating: 4.9, inStock: true },
        { id: 107, title: 'Mesh Ergonomic Office Chair', category: 'Furniture', price: 420.00, rating: 4.8, inStock: true },
        { id: 108, title: 'Studio Condenser Microphone XLR', category: 'Audio', price: 199.00, rating: 4.7, inStock: false },
        { id: 109, title: '4K Ultra HD Streaming Webcam', category: 'Hardware', price: 129.99, rating: 4.4, inStock: true },
        { id: 110, title: 'Wireless Fast Charging Desk Pad', category: 'Accessories', price: 49.99, rating: 4.3, inStock: true }
    ];
    entries.push(makeHarEntry('GET', '/api/products', { page: '1', limit: '5' }, undefined, 200, {
        products: page1Products,
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2
    }));
    entries.push(makeHarEntry('GET', '/api/products', { page: '2', limit: '5' }, undefined, 200, {
        products: page2Products,
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2
    }));
    // Individual product lookups
    entries.push(makeHarEntry('GET', '/api/products/101', {}, undefined, 200, page1Products[0]));
    entries.push(makeHarEntry('GET', '/api/products/102', {}, undefined, 200, page1Products[1]));
    entries.push(makeHarEntry('GET', '/api/products/103', {}, undefined, 200, page1Products[2]));
    // 3. Orders endpoints
    const ordersList = [
        { id: 'ORD-901', customerName: 'Alice Walker', totalAmount: 329.49, status: 'DELIVERED', itemsCount: 2, createdAt: '2026-08-20' },
        { id: 'ORD-902', customerName: 'Bob Martinez', totalAmount: 649.00, status: 'PROCESSING', itemsCount: 1, createdAt: '2026-08-22' },
        { id: 'ORD-903', customerName: 'Charlie Kim', totalAmount: 189.98, status: 'SHIPPED', itemsCount: 3, createdAt: '2026-08-25' }
    ];
    entries.push(makeHarEntry('GET', '/api/orders', {}, undefined, 200, {
        orders: ordersList,
        total: 3
    }));
    entries.push(makeHarEntry('GET', '/api/orders/ORD-901', {}, undefined, 200, ordersList[0]));
    entries.push(makeHarEntry('GET', '/api/orders/ORD-902', {}, undefined, 200, ordersList[1]));
    entries.push(makeHarEntry('GET', '/api/orders/ORD-903', {}, undefined, 200, ordersList[2]));
    // 4. Analytics & Settings REST Endpoints
    entries.push(makeHarEntry('GET', '/api/metrics/summary', {}, undefined, 200, {
        monthlyRevenue: 48250.00,
        activeSubscribers: 1420,
        apiRequestsToday: 89430,
        systemUptime: '99.98%'
    }));
    entries.push(makeHarEntry('GET', '/api/settings/notifications', {}, undefined, 200, {
        emailNotifications: true,
        slackWebhookEnabled: false,
        digestFrequency: 'weekly'
    }));
    // 5. GraphQL Operations
    entries.push(makeHarEntry('POST', '/graphql', {}, {
        operationName: 'GetUsers',
        query: 'query GetUsers {\n  users {\n    id\n    name\n    email\n    role\n  }\n}',
        variables: {}
    }, 200, {
        data: {
            users: [
                { id: '1', name: 'Alice Walker', email: 'alice@example.com', role: 'Staff Frontend Engineer' },
                { id: '2', name: 'Bob Martinez', email: 'bob@example.com', role: 'Backend Lead' },
                { id: '3', name: 'Charlie Kim', email: 'charlie@example.com', role: 'Product Designer' }
            ]
        }
    }));
    entries.push(makeHarEntry('POST', '/graphql', {}, {
        operationName: 'GetUserById',
        query: 'query GetUserById($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n    role\n    department\n  }\n}',
        variables: { id: '1' }
    }, 200, {
        data: {
            user: {
                id: '1',
                name: 'Alice Walker',
                email: 'alice@example.com',
                role: 'Staff Frontend Engineer',
                department: 'Web Platform'
            }
        }
    }));
    entries.push(makeHarEntry('POST', '/graphql', {}, {
        operationName: 'CreateUser',
        query: 'mutation CreateUser($name: String!, $email: String!) {\n  createUser(name: $name, email: $email) {\n    id\n    name\n    email\n  }\n}',
        variables: { name: 'Elena Rostova', email: 'elena@example.com' }
    }, 200, {
        data: {
            createUser: {
                id: '5',
                name: 'Elena Rostova',
                email: 'elena@example.com'
            }
        }
    }));
    entries.push(makeHarEntry('POST', '/graphql', {}, {
        operationName: 'GetProductCatalog',
        query: 'query GetProductCatalog {\n  products {\n    id\n    title\n    price\n    inStock\n  }\n}',
        variables: {}
    }, 200, {
        data: {
            products: page1Products
        }
    }));
    // Add remaining entries to reach exactly 47 total
    const remainingNeeded = 47 - entries.length;
    for (let i = 1; i <= remainingNeeded; i++) {
        const pick = i % 5;
        if (pick === 0) {
            entries.push(makeHarEntry('GET', '/api/users', {}, undefined, 200, { users: page1Products.map((p, idx) => ({ id: idx + 1, name: `User ${idx + 1}` })), total: 5 }));
        }
        else if (pick === 1) {
            entries.push(makeHarEntry('GET', `/api/users/${(i % 3) + 1}`, {}, undefined, 200, { id: (i % 3) + 1, name: `User ${(i % 3) + 1}` }));
        }
        else if (pick === 2) {
            entries.push(makeHarEntry('GET', '/api/products', { page: `${(i % 2) + 1}`, limit: '5' }, undefined, 200, { products: page1Products, page: (i % 2) + 1, limit: 5, total: 10 }));
        }
        else if (pick === 3) {
            entries.push(makeHarEntry('GET', '/api/orders', {}, undefined, 200, { orders: ordersList, total: 3 }));
        }
        else {
            entries.push(makeHarEntry('POST', '/graphql', {}, { operationName: 'GetUsers', query: 'query GetUsers { users { id name } }' }, 200, { data: { users: [{ id: '1', name: 'Alice' }] } }));
        }
    }
    const harRoot = {
        log: {
            version: '1.2',
            creator: {
                name: 'TrafficGhost Capture Engine',
                version: '1.0.0'
            },
            entries
        }
    };
    return JSON.stringify(harRoot, null, 2);
}
// Generate the HAR file
const harContent = generateSampleHar();
const outPath = path.join(__dirname, 'sample-traffic.har');
fs.writeFileSync(outPath, harContent, 'utf-8');
console.log(`Generated ${outPath} with exactly 47 requests.`);
