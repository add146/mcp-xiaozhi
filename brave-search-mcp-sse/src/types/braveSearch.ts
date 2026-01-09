// Brave Web Search Response Types
export interface BraveWeb {
  web?: {
    results?: Array<{
      title: string;
      description: string;
      url: string;
      language?: string;
      published?: string;
      rank?: number;
    }>;
  };
  locations?: {
    results?: Array<{
      id: string; // Required by API
      title?: string;
    }>;
  };
}

// Brave Local Search Response Types
export interface BraveLocation {
  id: string;
  name: string;
  address: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  rating?: {
    ratingValue?: number;
    ratingCount?: number;
  };
  openingHours?: string[];
  priceRange?: string;
}

export interface BravePoiResponse {
  results: BraveLocation[];
}

export interface BraveDescription {
  descriptions: {[id: string]: string};
}

// Tool argument types
export interface WebSearchArgs {
  query: string;
  count?: number;
  offset?: number;
}

export interface LocalSearchArgs {
  query: string;
  count?: number;
}

// Type guard functions
export function isBraveWebSearchArgs(args: unknown): args is WebSearchArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
}

export function isBraveLocalSearchArgs(args: unknown): args is LocalSearchArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "query" in args &&
    typeof (args as { query: string }).query === "string"
  );
} 