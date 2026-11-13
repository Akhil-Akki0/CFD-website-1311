/**
 * Production Structured JSON Logger with Sensitive Data Redaction
 * 
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 */

import fs from 'fs';
import path from 'path';

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL ? (LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()] || 30) : 30;

// Sensitive keys whose values must be automatically redacted in logs
const SENSITIVE_PATTERNS = [
  /passw(or)?d/i,
  /secret/i,
  /authorization/i,
  /token/i,
  /cookie/i,
  /bearer/i,
  /api[-_]?key/i,
  /session/i,
  /credit[-_]?card/i,
  /totp/i,
  /stlbase64/i,
  /private[-_]?key/i,
];

function redactValue(key, value) {
  if (value === undefined || value === null) return value;
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(key)) {
      if (typeof value === 'string' && value.length > 8) {
        return `[REDACTED:${value.slice(0, 3)}...${value.slice(-2)}]`;
      }
      return '[REDACTED]';
    }
  }

  if (typeof value === 'object') {
    return redactObject(value);
  }

  // Prevent giant base64 or STL data dumps in logs
  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 100)}... [TRUNCATED ${value.length} BYTES]`;
  }

  return value;
}

function redactObject(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[CIRCULAR]';
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item, idx) => redactValue(`[${idx}]`, item));
  }

  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    cleaned[k] = redactValue(k, v);
  }
  return cleaned;
}

function formatLog(levelStr, msg, meta = {}) {
  const correlationId = meta.correlationId || meta.reqId || '-';
  const cleanMeta = redactObject(meta);

  const payload = {
    timestamp: new Date().toISOString(),
    level: levelStr.toUpperCase(),
    pid: process.pid,
    correlationId,
    message: typeof msg === 'string' ? msg : JSON.stringify(msg),
    ...cleanMeta,
  };

  return JSON.stringify(payload);
}

function writeLog(levelStr, msg, meta = {}) {
  const levelNum = LOG_LEVELS[levelStr] || 30;
  if (levelNum < CURRENT_LEVEL) return;

  const line = formatLog(levelStr, msg, meta);
  if (levelNum >= 50) {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  trace: (msg, meta) => writeLog('trace', msg, meta),
  debug: (msg, meta) => writeLog('debug', msg, meta),
  info: (msg, meta) => writeLog('info', msg, meta),
  warn: (msg, meta) => writeLog('warn', msg, meta),
  error: (msg, meta) => writeLog('error', msg, meta),
  fatal: (msg, meta) => writeLog('fatal', msg, meta),

  // Dedicated audit logger for security-critical actions
  audit: (action, meta = {}) => {
    const auditRecord = {
      audit: true,
      action,
      userId: meta.userId || 'anonymous',
      ip: meta.ip || '-',
      userAgent: meta.userAgent || '-',
      outcome: meta.outcome || 'SUCCESS',
      resource: meta.resource || '-',
      details: meta.details || {},
      correlationId: meta.correlationId || '-',
    };
    writeLog('info', `AUDIT: ${action}`, auditRecord);
  },
};

export { logger };
export default logger;
