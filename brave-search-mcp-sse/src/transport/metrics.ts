import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

// Create a Registry to store metrics
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Add custom metrics here if needed
export const searchCounter = new Counter({
    name: 'brave_search_total',
    help: 'Total number of search requests',
    labelNames: ['type'], // 'web' or 'local'
    registers: [register]
});

export const searchLatency = new Histogram({
    name: 'brave_search_duration_seconds',
    help: 'Search request duration in seconds',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register]
}); 