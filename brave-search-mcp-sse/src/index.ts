#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Request,
  CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";

// Import configuration
import { SERVER_INFO, BRAVE_API_KEY } from './config/constants.js';

// Import tools
import { WEB_SEARCH_TOOL, handleWebSearch } from './tools/webSearch.js';
import { LOCAL_SEARCH_TOOL, handleLocalSearch } from './tools/localSearch.js';

// Import transport
import { setupSSETransport } from './transport/sseTransport.js';

// Import logger
import logger from './utils/logger.js';

// Check for API key
if (!BRAVE_API_KEY) {
  logger.error('Missing required environment variable: BRAVE_API_KEY');
  process.exit(1);
}

// Server implementation
const server = new Server(
  SERVER_INFO,
  {
    capabilities: {
      tools: {},
    },
  },
);

logger.info(`Starting Brave Search MCP Server v${SERVER_INFO.version} (${SERVER_INFO.name})`);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info(`Registering tools: ${WEB_SEARCH_TOOL.name}, ${LOCAL_SEARCH_TOOL.name}`);
  return {
    tools: [WEB_SEARCH_TOOL, LOCAL_SEARCH_TOOL],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const startTime = Date.now();
  
  try {
    const { name, arguments: args } = request.params;
    logger.info(`Tool request received - Tool: ${name}, Args: ${JSON.stringify(args).substring(0, 100)}...`);

    if (!args) {
      logger.error(`No arguments provided for tool ${name}`);
      throw new Error("No arguments provided");
    }

    let result;
    switch (name) {
      case "brave_web_search":
        result = await handleWebSearch(args);
        break;

      case "brave_local_search":
        result = await handleLocalSearch(args);
        break;

      default:
        logger.warn(`Unknown tool requested: ${name}`);
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    const duration = Date.now() - startTime;
    logger.info(`Tool request completed - Tool: ${name}, Duration: ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Tool request failed - Tool: ${request.params.name}, Error: ${error instanceof Error ? error.message : String(error)}, Duration: ${duration}ms`);

    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server with SSE transport
setupSSETransport(server).on('error', (error: Error) => {
  logger.error('[server]: Server error occurred', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
