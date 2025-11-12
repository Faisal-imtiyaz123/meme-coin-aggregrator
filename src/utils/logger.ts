// src/utils/logger.ts
import winston from 'winston';
import fs from 'fs';
import Table from 'cli-table3';

// Define types for our log data
interface LogData {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  context?: string;
  [key: string]: any;
}

// CLI Table format for console logs
const cliTableFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, context, ...meta } = info as unknown as LogData;

    // For simple messages, use a single row table
    if (Object.keys(meta).length === 0) {
      const table = new Table({
        head: ['Time', 'Level', 'Service', 'Message'],
        colWidths: [10, 12, 25, 50],
        style: { 
          head: ['cyan', 'bold'],
          border: ['gray']
        }
      });
      
      table.push([
        timestamp,
        level,
        context || service || 'meme-coin-aggregator',
        message
      ] as Table.Cell[]);
      
      return table.toString();
    }
    
    // For messages with metadata, create a detailed table
    const table = new Table({
      head: ['Time', 'Level', 'Service', 'Message'],
      colWidths: [10, 12, 25, 50],
      style: { 
        head: ['cyan', 'bold'],
        border: ['gray']
      }
    });
    
    table.push([
      timestamp,
      level,
      context || service || 'meme-coin-aggregator',
      message
    ] as Table.Cell[]);
    
    // Add metadata as additional tables
    Object.entries(meta).forEach(([key, value]) => {
      if (key !== 'service' && key !== 'context') {
        const formattedValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        const metaTable = new Table({
          colWidths: [20, 80],
          style: { border: ['gray'] }
        });
        
        // Split long values into multiple lines
        const lines = formattedValue.split('\n');
        metaTable.push([key, lines[0] || ''] as Table.Cell[]);
        lines.slice(1).forEach(line => {
          metaTable.push(['', line] as Table.Cell[]);
        });
        
        return metaTable.toString();
      }
    });
    
    return table.toString();
  })
);

// Compact table format for high-frequency logs
const compactTableFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, context } = info as unknown as LogData;
    
    const table = new Table({
      colWidths: [10, 8, 20, 52],
      chars: {
        'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
        'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
        'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
        'right': '│', 'right-mid': '┤', 'middle': '│'
      },
      style: { 
        'padding-left': 1,
        'padding-right': 1
      }
    });
    
    table.push([
      { content: timestamp, hAlign: 'center' },
      level,
      context || 'main',
      message
    ] as Table.Cell[]);
    
    return table.toString();
  })
);

// JSON format for file logs (keeping structured data)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'meme-coin-aggregator' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Add console transport with CLI table format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: process.env.COMPACT_LOGS ? compactTableFormat : cliTableFormat
  }));
} else {
  // Production: use compact format
  logger.add(new winston.transports.Console({
    format: compactTableFormat
  }));
}

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
}

// Special table logger for structured data
export const tableLogger = {
  // Log data in proper table format
  data: (title: string, headers: string[], rows: any[][], context?: string) => {
    const table = new Table({
      head: headers,
      style: { 
        head: ['cyan', 'bold'],
        border: ['yellow']
      }
    });
    
    rows.forEach(row => table.push(row as Table.Cell[]));
    
    logger.info(`${title}\n${table.toString()}`, { context, type: 'data-table' });
  },
  
  // Summary table for important metrics
  summary: (title: string, data: Record<string, any>, context?: string) => {
    const table = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 50],
      style: { 
        head: ['green', 'bold'],
        border: ['green']
      }
    });
    
    Object.entries(data).forEach(([key, value]) => {
      table.push([key, String(value)] as Table.Cell[]);
    });
    
    logger.info(`${title}\n${table.toString()}`, { context, type: 'summary' });
  },
  
  // Key-value pairs in table format
  keyValue: (title: string, data: Record<string, any>, context?: string) => {
    const table = new Table({
      colWidths: [25, 55],
      style: { border: ['blue'] }
    });
    
    Object.entries(data).forEach(([key, value]) => {
      table.push([{ content: key, hAlign: 'right' }, String(value)] as Table.Cell[]);
    });
    
    logger.info(`${title}\n${table.toString()}`, { context, type: 'key-value' });
  }
};

// Contextual logger with built-in table support
export const createLogger = (context: string) => ({
  // Standard log methods
  info: (message: string, meta?: any) => 
    logger.info(message, { ...meta, context }),
  
  error: (message: string, meta?: any) => 
    logger.error(message, { ...meta, context }),
  
  warn: (message: string, meta?: any) => 
    logger.warn(message, { ...meta, context }),
  
  debug: (message: string, meta?: any) => 
    logger.debug(message, { ...meta, context }),
  
  // Table methods
  table: (title: string, headers: string[], rows: any[][]) =>
    tableLogger.data(title, headers, rows, context),
  
  summary: (title: string, data: Record<string, any>) =>
    tableLogger.summary(title, data, context),
  
  keyValue: (title: string, data: Record<string, any>) =>
    tableLogger.keyValue(title, data, context)
});

// Export types
export type { LogData };