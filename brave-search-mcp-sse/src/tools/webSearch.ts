import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { performWebSearch } from "../services/braveSearchApi.js";
import { isBraveWebSearchArgs, WebSearchArgs } from "../types/braveSearch.js";
import { searchCounter, searchLatency } from '../transport/metrics.js';

// Web Search Tool definition
export const WEB_SEARCH_TOOL: Tool = {
  name: "brave_web_search",
  description:
    "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
    "Use this for broad information gathering, recent events, or when you need diverse web sources. " +
    "Supports pagination, content filtering, and freshness controls. " +
    "Maximum 20 results per request, with offset for pagination. ",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (max 400 chars, 50 words)"
      },
      count: {
        type: "number",
        description: "Number of results (1-20, default 10)",
        default: 10
      },
      offset: {
        type: "number",
        description: "Pagination offset (max 9, default 0)",
        default: 0
      },
    },
    required: ["query"],
  },
};

// Handler for web search requests
export async function handleWebSearch(args: unknown) {
  const end = searchLatency.startTimer({ type: 'web' });
  
  try {
    searchCounter.inc({ type: 'web' });
    if (!isBraveWebSearchArgs(args)) {
      throw new Error("Invalid arguments for brave_web_search");
    }
    
    const { query, count = 10, offset = 0 } = args as WebSearchArgs;
    const results = await performWebSearch(query, count, offset);
    
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