// TrafficGhost — Exasol DDL
// Table definitions for persisting traffic analytics to Exasol Personal.

export const CREATE_SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS TRAFFICGHOST`;

export const CREATE_REQUEST_LOGS_SQL = `
CREATE TABLE IF NOT EXISTS TRAFFICGHOST.REQUEST_LOGS (
  SESSION_ID   VARCHAR(36),
  LOG_ID       VARCHAR(36),
  TS           TIMESTAMP,
  METHOD       VARCHAR(10),
  PATH         VARCHAR(2000),
  STATUS_CODE  DECIMAL(5,0),
  DURATION_MS  DECIMAL(10,0)
)
`.trim();

export const CREATE_ENDPOINTS_SQL = `
CREATE TABLE IF NOT EXISTS TRAFFICGHOST.ENDPOINTS (
  SESSION_ID   VARCHAR(36),
  EP_ID        VARCHAR(36),
  METHOD       VARCHAR(10),
  PATH         VARCHAR(2000),
  IS_DYNAMIC   BOOLEAN,
  GROUP_NAME   VARCHAR(200)
)
`.trim();

export const ALL_DDL = [
  CREATE_SCHEMA_SQL,
  CREATE_REQUEST_LOGS_SQL,
  CREATE_ENDPOINTS_SQL,
];

export const AI_SCHEMA_CONTEXT = `
You are a SQL expert working with an Exasol database.

Available tables:

TRAFFICGHOST.REQUEST_LOGS:
  SESSION_ID   VARCHAR(36)   -- current capture session
  LOG_ID       VARCHAR(36)   -- unique ID per request
  TS           TIMESTAMP     -- when the request was made
  METHOD       VARCHAR(10)   -- HTTP method (GET, POST, etc.)
  PATH         VARCHAR(2000) -- URL path (e.g. /api/users/123)
  STATUS_CODE  DECIMAL(5,0)  -- HTTP status code (200, 404, 500...)
  DURATION_MS  DECIMAL(10,0) -- response time in milliseconds

TRAFFICGHOST.ENDPOINTS:
  SESSION_ID   VARCHAR(36)   -- current capture session
  EP_ID        VARCHAR(36)   -- unique endpoint ID
  METHOD       VARCHAR(10)   -- HTTP method
  PATH         VARCHAR(2000) -- normalized path with :param placeholders
  IS_DYNAMIC   BOOLEAN       -- true if the path contains dynamic segments
  GROUP_NAME   VARCHAR(200)  -- resource group (e.g. "users", "products")

Rules:
- Use Exasol SQL syntax (similar to standard SQL).
- Always use schema-qualified table names: TRAFFICGHOST.REQUEST_LOGS
- Return only the SQL query, no explanation, no markdown fences.
- Keep queries simple and readable.
`.trim();
