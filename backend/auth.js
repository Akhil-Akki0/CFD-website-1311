/**
 * Enterprise Production Authentication, Authorization, RBAC & TOTP 2FA Module
 * 
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from './logger.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'aero_cfd_access_secret_super_hardened_2026_min32chars!';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'aero_cfd_refresh_secret_rotating_family_2026_min32chars!';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes cooldown

// In-Memory Persistent Store (with seed accounts for production demo & audit)
// Seed admin password is 'AdminCFD@2026#Secure'
// Seed user password is 'UserCFD@2026#Secure'
const USERS = new Map();
const REFRESH_TOKENS = new Map(); // tokenId -> { userId, familyId, isRevoked, expiresAt, ip, userAgent }
const EMAIL_VERIFICATION_TOKENS = new Map(); // token -> { userId, expiresAt }
const PASSWORD_RESET_TOKENS = new Map(); // token -> { userId, expiresAt }
const USER_SESSIONS = new Map(); // userId -> Map(sessionId -> { device, ip, userAgent, lastSeen, refreshTokenId })

// Helper: Standard RFC 6238 TOTP implementation
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output = [];
  const clean = base32.replace(/=+$/, '').toUpperCase();

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateTotpSecret() {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

function computeTotp(secretBase32, timeStep = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32Decode(secretBase32);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

function verifyTotp(secretBase32, tokenStr) {
  if (!secretBase32 || !tokenStr) return false;
  const cleanToken = tokenStr.trim();
  const currentStep = Math.floor(Date.now() / 1000 / 30);

  // Allow a +/- 1 step window (skew allowance: 90s total)
  for (let offset = -1; offset <= 1; offset++) {
    if (computeTotp(secretBase32, currentStep + offset) === cleanToken) {
      return true;
    }
  }
  return false;
}

// Check HaveIBeenPwned k-Anonymity API (Fail-open with warning if offline)
async function isPasswordPwned(password) {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OpenFOAM-CFD-Hardened-Auth/2.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) return false;
    const body = await res.text();
    const lines = body.split('\n');
    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix && parseInt(count, 10) > 0) {
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.warn('HaveIBeenPwned API check skipped or unreachable', { error: err.message });
    return false;
  }
}

// Seed Users
async function initSeedUsers() {
  const adminHash = await bcrypt.hash('AdminCFD@2026#Secure', 12);
  const userHash = await bcrypt.hash('UserCFD@2026#Secure', 12);

  const adminUser = {
    id: 'usr_admin_001',
    email: 'akkedu01@gmail.com',
    name: 'Akhil.A (Lead Engineer)',
    role: 'admin',
    passwordHash: adminHash,
    isEmailVerified: true,
    failedAttempts: 0,
    lockedUntil: null,
    totpEnabled: true,
    totpSecret: generateTotpSecret(),
    createdAt: new Date().toISOString(),
  };

  const standardUser = {
    id: 'usr_operator_002',
    email: 'operator@cfd.local',
    name: 'Aerospace Analyst',
    role: 'user',
    passwordHash: userHash,
    isEmailVerified: true,
    failedAttempts: 0,
    lockedUntil: null,
    totpEnabled: false,
    totpSecret: null,
    createdAt: new Date().toISOString(),
  };

  USERS.set(adminUser.id, adminUser);
  USERS.set(standardUser.id, standardUser);

  logger.info('Initialized seed user credentials in hardened auth store', {
    adminEmail: adminUser.email,
    userEmail: standardUser.email,
    adminTotpSecretPreview: adminUser.totpSecret ? '[CONFIGURED]' : '[NONE]',
  });
}
initSeedUsers();

// Helper: Token Generation
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'access',
    },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user, familyId = crypto.randomUUID(), meta = {}) {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: user.id,
      jti: tokenId,
      familyId,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_MS;
  REFRESH_TOKENS.set(tokenId, {
    userId: user.id,
    familyId,
    isRevoked: false,
    expiresAt,
    ip: meta.ip || '-',
    userAgent: meta.userAgent || '-',
  });

  // Track user session
  if (!USER_SESSIONS.has(user.id)) {
    USER_SESSIONS.set(user.id, new Map());
  }
  const sessions = USER_SESSIONS.get(user.id);
  const sessionId = meta.sessionId || crypto.randomUUID();
  sessions.set(sessionId, {
    sessionId,
    refreshTokenId: tokenId,
    device: meta.userAgent ? meta.userAgent.slice(0, 60) : 'Desktop Browser',
    ip: meta.ip || '-',
    lastSeen: new Date().toISOString(),
  });

  return { token, tokenId, familyId, sessionId };
}

// Cookie Helper
function setAuthCookies(res, refreshToken, csrfToken) {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('cfd_refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/auth',
  });

  if (csrfToken) {
    res.cookie('cfd_csrf_token', csrfToken, {
      httpOnly: false, // Double submit readable by client JavaScript
      secure: isProd,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
      path: '/',
    });
  }
}

function clearAuthCookies(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('cfd_refresh_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth',
  });
  res.clearCookie('cfd_csrf_token', {
    httpOnly: false,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  });
}

// Middleware: Authenticate JWT Access Token
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    if (decoded.type !== 'access') {
      return res.status(403).json({ error: 'Invalid token classification', code: 'TOKEN_INVALID' });
    }

    const user = USERS.get(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists', code: 'USER_NOT_FOUND' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid authentication token', code: 'TOKEN_INVALID' });
  }
}

// Middleware: Require Specific Role
function requireRole(allowedRoles = ['admin']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      logger.audit('RBAC_DENIED', {
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: allowedRoles,
        ip: req.ip,
        correlationId: req.correlationId,
      });
      return res.status(403).json({
        error: 'Forbidden: Insufficient role permissions for this operation.',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }
    next();
  };
}

// Middleware: Verify CSRF Double-Submit Token on mutation endpoints
function verifyCsrf(req, res, next) {
  // Safe methods do not require CSRF check
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt auth bootstrap endpoints if cookie doesn't exist yet
  if (req.path === '/api/auth/login' || req.path === '/api/auth/signup') {
    return next();
  }

  const cookieToken = req.cookies && req.cookies['cfd_csrf_token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.audit('CSRF_VALIDATION_FAILED', {
      ip: req.ip,
      path: req.path,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      correlationId: req.correlationId,
    });
    return res.status(403).json({
      error: 'CSRF token mismatch or missing. Request rejected.',
      code: 'CSRF_INVALID',
    });
  }

  next();
}

export {
  USERS,
  REFRESH_TOKENS,
  EMAIL_VERIFICATION_TOKENS,
  PASSWORD_RESET_TOKENS,
  USER_SESSIONS,
  generateTotpSecret,
  computeTotp,
  verifyTotp,
  isPasswordPwned,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  authenticate,
  requireRole,
  verifyCsrf,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
};

export default {
  USERS,
  REFRESH_TOKENS,
  EMAIL_VERIFICATION_TOKENS,
  PASSWORD_RESET_TOKENS,
  USER_SESSIONS,
  generateTotpSecret,
  computeTotp,
  verifyTotp,
  isPasswordPwned,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  authenticate,
  requireRole,
  verifyCsrf,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
};
