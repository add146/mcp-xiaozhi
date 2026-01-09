import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { performLocalSearch } from "../services/braveSearchApi.js";
import { isBraveLocalSearchArgs, LocalSearchArgs } from "../types/braveSearch.js";
import { searchCounter, searchLatency } from '../transport/metrics.js';

// Local Search Tool definition
export const LOCAL_SEARCH_TOOL: Tool = {
  name: "brave_local_search",
  description:
    "Searches for local businesses and places using Brave's Local Search API. " +
    "Best for queries related to physical locations, businesses, restaurants, services, etc. " +
    "Returns detailed information including:\n" +
    "- Business names and addresses\n" +
    "- Ratings and review counts\n" +
    "- Phone numbers and opening hours\n" +
    "Use this when the query implies 'near me' or mentions specific locations. " +
    "Automatically falls back to web search if no local results are found.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Local search query (e.g. 'pizza near Central Park')"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 5)",
        default: 5
      },
    },
    required: ["query"]
  }
};

// Handler for local search requests
export async function handleLocalSearch(args: unknown) {
  const end = searchLatency.startTimer({ type: 'local' });
  try {
    searchCounter.inc({ type: 'local' });
    if (!isBraveLocalSearchArgs(args)) {
      throw new Error("Invalid arguments for brave_local_search");
    }
    
    const { query, count = 5 } = args as LocalSearchArgs;
    const results = await performLocalSearch(query, count);
    
    end();
    return {
      content: [{ type: "text", text: results }],
      isError: false,
    };
  } catch (error) {
    end();
    throw error;
  }
} 