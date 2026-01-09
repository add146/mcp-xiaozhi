import { Registry, Counter, Gauge, Histogram } from 'prom-client';

// Create a Registry
const register = new Registry();

// Search Request Metrics
export const searchRequestsTotal = new Counter({
  name: 'brave_search_requests_total',
  help: 'Total number of search requests',
  labelNames: ['type'] as const,
  registers: [register]
});

export const searchResponseTime = new Histogram({
  name: 'brave_search_response_time_seconds',
  help: 'Response time in seconds',
  labelNames: ['type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

export const searchErrors = new Counter({
  name: 'brave_search_errors_total',
  help: 'Total number of search errors',
  labelNames: ['type', 'error'] as const,
  registers: [register]
});

// SSE Connection Metrics
export const activeConnections = new Gauge({
  name: 'brave_search_active_connections',
  help: 'Number of active SSE connections',
  registers: [register]
});

export const connectionDuration = new Histogram({
  name: 'brave_search_connection_duration_seconds',
  help: 'Duration of SSE connections in seconds',
  buckets: [60, 300, 600, 1800, 3600],
  registers: [register]
});

// Rate Limiting Metrics
export const rateLimitUsage = new Gauge({
  name: 'brave_search_rate_limit_usage',
  help: 'Current rate limit usage',
  labelNames: ['period'] as const,
  registers: [register]
});

export const rateLimitHits = new Counter({
  name: 'brave_search_rate_limit_hits_total',
  help: 'Number of rate limit hits',
  labelNames: ['period'] as const,
  registers: [register]
});

// Export the registry
export { register }; 