import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  FRONTEND_URL: Joi.string().uri({ scheme: ['http', 'https'] }).default('http://localhost:4173'),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .default('mongodb://localhost:27017/promocode_manager'),
  CLICKHOUSE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:8123'),
  CLICKHOUSE_DATABASE: Joi.string().default('default'),
  CLICKHOUSE_USERNAME: Joi.string().default('default'),
  CLICKHOUSE_PASSWORD: Joi.string().allow('').default(''),
  REDIS_URL: Joi.string().uri({ scheme: ['redis'] }).default('redis://localhost:6379'),
  REDIS_ANALYTICS_CACHE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  REDIS_LOCK_TTL_MS: Joi.number().integer().min(1000).default(10000),
  JWT_ACCESS_SECRET: Joi.string().min(8).default('dev-access-secret'),
  JWT_REFRESH_SECRET: Joi.string().min(8).default('dev-refresh-secret'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  ADMIN_SEED_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  ADMIN_EMAIL: Joi.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: Joi.string().min(8).default('admin12345'),
  ADMIN_NAME: Joi.string().min(2).default('Admin'),
  ADMIN_PHONE: Joi.string().min(6).default('+10000000000')
});
