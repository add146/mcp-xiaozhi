import {
  BRAVE_API_KEY,
  RATE_LIMIT,
  requestCount,
  API_ENDPOINTS
} from '../config/constants.js';
import {
  BraveWeb,
  BravePoiResponse,
  BraveDescription
} from '../types/braveSearch.js';
import logger from '../utils/logger.js';

/**
 * Check if we've exceeded rate limits
 */
export function checkRateLimit() {
  const now = Date.now();
  if (now - requestCount.lastReset > 1000) {
    requestCount.second = 0;
    requestCount.lastReset = now;
  }
  if (requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.month >= RATE_LIMIT.perMonth) {
    throw new Error('Rate limit exceeded');
  }
  requestCount.second++;
  requestCount.month++;
}

/**
 * Perform a web search query
 */
export async function performWebSearch(query: string, count: number = 10, offset: number = 0) {
  try {
    checkRateLimit();
    const url = new URL(API_ENDPOINTS.webSearch);
    url.searchParams.set('q', query);
    url.searchParams.set('count', Math.min(count, 20).toString()); // API limit
    url.searchParams.set('offset', offset.toString());

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Brave API Error (Web Search) - Status: ${response.status} ${response.statusText} [query: ${query}] [response: ${errorText.substring(0, 200)}]`);
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveWeb;

    // Extract just web results
    const results = (data.web?.results || []).map((result) => ({
      title: result.title || '',
      description: result.description || '',
      url: result.url || ''
    }));

    return results.map((result) =>
      `Title: ${result.title}\nDescription: ${result.description}\nURL: ${result.url}`
    ).join('\n\n');
  } catch (error) {
    logger.error(`Brave API Call Failed (Web Search) - Error: ${error instanceof Error ? error.message : String(error)} [query: ${query}]`);
    throw error;
  }
}

/**
 * Perform a local search query
 */
export async function performLocalSearch(query: string, count: number = 5) {
  try {
    checkRateLimit();
    // Initial search to get location IDs using web search endpoint with filters
    const webUrl = new URL(API_ENDPOINTS.webSearch);
    webUrl.searchParams.set('q', query);
    webUrl.searchParams.set('search_lang', 'en');
    webUrl.searchParams.set('result_filter', 'locations');
    webUrl.searchParams.set('count', Math.min(count, 20).toString());

    const webResponse = await fetch(webUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    if (!webResponse.ok) {
      const errorText = await webResponse.text();
      // Log API error details for the initial location search
      logger.error(`Brave API Error (Local Search - Initial Location Query) - Status: ${webResponse.status} ${webResponse.statusText} [query: ${query}] [response: ${errorText.substring(0, 200)}]`); 
      throw new Error(`Brave API error (Initial Location Query): ${webResponse.status} ${webResponse.statusText}`);
    }

    const webData = await webResponse.json() as BraveWeb;
    const locationIds = webData.locations?.results?.filter((result): result is { id: string; title?: string } => result.id != null).map((result) => result.id) || [];

    if (locationIds.length === 0) {
      logger.warn(`No location IDs found for local search query: '${query}'. Falling back to web search.`);
      // Fallback to web search (error logging is handled within performWebSearch)
      return performWebSearch(query, count); 
    }

    // Get POI details and descriptions in parallel
    // Error logging is handled within getPoisData and getDescriptionsData
    const [poisData, descriptionsData] = await Promise.all([
      getPoisData(locationIds),
      getDescriptionsData(locationIds)
    ]);

    return formatLocalResults(poisData, descriptionsData);

  } catch (error) {
    // Log any other unexpected error during the local search process
    // Specific API call errors within this function (or called functions) should already be logged
    if (!(error instanceof Error && error.message.startsWith('Brave API error'))) { // Avoid double logging API errors
       logger.error(`Brave API Call Failed (Local Search - General) - Error: ${error instanceof Error ? error.message : String(error)} [query: ${query}]`);
    }
    throw error; // Re-throw the error
  }
}

/**
 * Get POI (Point of Interest) data for location IDs
 */
export async function getPoisData(ids: string[]): Promise<BravePoiResponse> {
  try {
    checkRateLimit();
    const url = new URL(API_ENDPOINTS.pois);
    ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Brave API Error (Get POIs) - Status: ${response.status} ${response.statusText} [ids: ${ids.join(',')}] [response: ${errorText.substring(0, 200)}]`);
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const poisResponse = await response.json() as BravePoiResponse;
    return poisResponse;
  } catch (error) {
    logger.error(`Brave API Call Failed (Get POIs) - Error: ${error instanceof Error ? error.message : String(error)} [ids: ${ids.join(',')}]`);
    throw error;
  }
}

/**
 * Get descriptions for location IDs
 */
export async function getDescriptionsData(ids: string[]): Promise<BraveDescription> {
  try {
    checkRateLimit();
    const url = new URL(API_ENDPOINTS.descriptions);
    ids.filter(Boolean).forEach(id => url.searchParams.append('ids', id));
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Brave API Error (Get Descriptions) - Status: ${response.status} ${response.statusText} [ids: ${ids.join(',')}] [response: ${errorText.substring(0, 200)}]`);
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const descriptionsData = await response.json() as BraveDescription;
    return descriptionsData;
  } catch (error) {
    logger.error(`Brave API Call Failed (Get Descriptions) - Error: ${error instanceof Error ? error.message : String(error)} [ids: ${ids.join(',')}]`);
    throw error;
  }
}

/**
 * Format local search results for display
 */
export function formatLocalResults(poisData: BravePoiResponse, descData: BraveDescription): string {
  return (poisData.results || []).map((poi) => {
    const address = [
      poi.address?.streetAddress ?? '',
      poi.address?.addressLocality ?? '',
      poi.address?.addressRegion ?? '',
      poi.address?.postalCode ?? ''
    ].filter(part => part !== '').join(', ') || 'N/A';

    return `Name: ${poi.name}
Address: ${address}
Phone: ${poi.phone || 'N/A'}
Rating: ${poi.rating?.ratingValue ?? 'N/A'} (${poi.rating?.ratingCount ?? 0} reviews)
Price Range: ${poi.priceRange || 'N/A'}
Hours: ${(poi.openingHours || []).join(', ') || 'N/A'}
Description: ${descData.descriptions[poi.id] || 'No description available'}
`;
  }).join('\n---\n') || 'No local results found';
} 