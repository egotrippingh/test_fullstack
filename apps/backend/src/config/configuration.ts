export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4173'
  },
  mongo: {
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/promocode_manager'
  },
  clickhouse: {
    url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    username: process.env.CLICKHOUSE_USERNAME ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? ''
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    analyticsCacheTtlSeconds: Number(process.env.REDIS_ANALYTICS_CACHE_TTL_SECONDS ?? 60),
    lockTtlMs: Number(process.env.REDIS_LOCK_TTL_MS ?? 10000)
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'
  },
  seed: {
    adminEnabled: process.env.ADMIN_SEED_ENABLED !== 'false',
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
    adminPassword: process.env.ADMIN_PASSWORD ?? 'admin12345',
    adminName: process.env.ADMIN_NAME ?? 'Admin',
    adminPhone: process.env.ADMIN_PHONE ?? '+10000000000'
  }
});
