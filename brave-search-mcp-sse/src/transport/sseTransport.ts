import express, { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { PORT, PUBLIC_URL } from "../config/constants.js";
import { register } from './metrics.js';
import logger from '../utils/logger.js';

/**
 * Set up the Express server with SSE transport
 */
export function setupSSETransport(server: Server) {
  const app = express();
  let transport: SSEServerTransport | null = null;

  // Add health endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Add metrics endpoint
  app.get("/metrics", async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err: unknown) {
      res.status(500).end(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // Handle SSE connections
  app.get("/sse", (req: Request, res: Response) => {
    logger.info(`SSE connection established`);
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
    
    // Increase timeout to prevent connection from closing
    req.socket.setTimeout(0);
    res.setTimeout(0);
    
    transport = new SSEServerTransport("/messages", res);

    // Send keep-alive ping every 30 seconds
    const keepAlivePing = setInterval(() => {
      res.write(':\n\n'); // SSE comment as ping
    }, 30000);

    req.on('close', () => {
      logger.info(`Client disconnected`);
      clearInterval(keepAlivePing);
      transport = null;
    });

    server.connect(transport)
      .then(() => logger.info(`Transport connected successfully`))
      .catch((err: unknown) => logger.error(`Failed to connect transport: ${err instanceof Error ? err.message : err}`));
  });

  // Handle POST messages from client
  app.post("/messages", (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    logger.info(`POST /messages received [session: ${sessionId || 'undefined'}]`);

    if (transport) {
      // Pass the original request directly to the SDK handler
      transport.handlePostMessage(req, res); 
    } else {
      logger.error('Message received but no active transport');
      res.status(400).send({ error: "No active transport" });
    }
  });

  // Start the server
  return app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
    if (PUBLIC_URL) {
      // Log endpoints as separate messages
      logger.info(`> Public URL: ${PUBLIC_URL}`);
      logger.info(`> SSE endpoint: ${PUBLIC_URL}/sse`);
      logger.info(`> Health endpoint: ${PUBLIC_URL}/health`);
      logger.info(`> Metrics endpoint: ${PUBLIC_URL}/metrics`);
    } else {
      // Log endpoints as separate messages
      logger.info(`> SSE endpoint: /sse`);
      logger.info(`> Health endpoint: /health`);
      logger.info(`> Metrics endpoint: /metrics`);
    }
  });
} 