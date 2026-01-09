// API keys and configuration
export const BRAVE_API_KEY = process.env.BRAVE_API_KEY!;

// Rate limiting configuration
export const RATE_LIMIT = {
  perSecond: 1,
  perMonth: 15000
};

export const requestCount = {
  second: 0,
  month: 0,
  lastReset: Date.now()
};

// Server metadata
export const SERVER_INFO = {
  name: "example-servers/brave-search",
  version: "0.1.0",
};

// API endpoints
export const API_ENDPOINTS = {
  webSearch: 'https://api.search.brave.com/res/v1/web/search',
  pois: 'https://api.search.brave.com/res/v1/local/pois',
  descriptions: 'https://api.search.brave.com/res/v1/local/descriptions'
};

// Server configuration
export const PORT = 8080;
export const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:8080'; // e.g., https://brave-search.shoofio.com 