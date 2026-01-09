import winston from 'winston';
import os from 'os';

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'magenta',
  debug: 'green'
};

winston.addColors(colors);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'brave-search-mcp',
    hostname: os.hostname()
  },
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, component, sessionId, tool, duration, ...meta }) => {
          const colorizer = winston.format.colorize();
          const levelStr = `[${colorizer.colorize(level, level.toUpperCase())}]`;
          const componentStr = component || (tool ? `[${tool}]` : '[server]');
          const sessionInfo = sessionId ? ` (session: ${sessionId})` : '';
          const durationInfo = duration ? ` (${duration}ms)` : '';
          
          // Clean message for structured logging
          const cleanMessage = `${levelStr} ${componentStr}: ${message}${sessionInfo}${durationInfo}`;
          
          return cleanMessage;
        })
      )
    })
  ]
});

export default logger; 