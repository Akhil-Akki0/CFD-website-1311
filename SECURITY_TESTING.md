# Security Penetration Testing & Automated Verification Manual

**DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com**

This document provides exact, reproducible curl commands and expected responses to verify that all OWASP Top 10 vulnerabilities, injection vectors, and bypass techniques are securely blocked by the platform.

---

### Setup Variables for Testing
```bash
export TARGET_URL="http://localhost:3001"
export ADMIN_EMAIL="akkedu01@gmail.com"
export ADMIN_PASS="AdminCFD@2026#Secure"
export USER_EMAIL="operator@cfd.local"
export USER_PASS="UserCFD@2026#Secure"
```

---

### 1. Command Injection Prevention (OpenFOAM Parameter Hardening)

#### Test 1.1: Shell metacharacter injection in inlet velocity
```bash
curl -i -X POST "$TARGET_URL/api/run-simulation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  --data '{"config":{"inletVelocity":"10.0; cat /etc/passwd","maxIterations":100}}'
```
*Expected Result:*
- **HTTP 400 Bad Request**
- Response Body:
```json
{
  "error": "Input validation failed. Unknown or malformed fields rejected.",
  "code": "VALIDATION_ERROR",
  "details": [{"path": "config.inletVelocity", "message": "Expected number, received string"}]
}
```

#### Test 1.2: Shell metacharacter injection in Geometry filename
```bash
curl -i -X POST "$TARGET_URL/api/run-simulation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "X-CSRF-Token: <CSRF_TOKEN>" \
  --data '{"geometry":{"name":"test","filename":"mesh$(whoami).stl"},"config":{"inletVelocity":15.0}}'
```
*Expected Result:*
- **HTTP 400 Bad Request**
- `Invalid filename format` (regex rejects `$`, `(`, `)`).

---

### 2. Path Traversal Prevention

#### Test 2.1: Directory traversal in case status query
```bash
curl -i -X GET "$TARGET_URL/api/simulation-status/..%2F..%2F..%2Fetc%2Fpasswd" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
*Expected Result:*
- **HTTP 400 Bad Request**
- `Invalid caseId parameter. Must be valid UUIDv4 format.` (Path traversal completely blocked before filesystem access).

---

### 3. Insecure Direct Object References (IDOR)

#### Test 3.1: Operator attempting to view Admin's simulation case
```bash
# Obtain operator user token
USER_TOKEN=$(curl -s -X POST "$TARGET_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}" | jq -r .accessToken)

# Query an existing case owned by a different user
curl -i -X GET "$TARGET_URL/api/simulation-status/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \
  -H "Authorization: Bearer $USER_TOKEN"
```
*Expected Result:*
- **HTTP 403 Forbidden**
- Response Body:
```json
{
  "error": "Forbidden: You do not have permission to access this simulation case.",
  "code": "FORBIDDEN"
}
```

---

### 4. Cross-Site Request Forgery (CSRF Double-Submit Verification)

#### Test 4.1: POST request without matching CSRF token header
```bash
curl -i -X POST "$TARGET_URL/api/run-simulation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -b "cfd_csrf_token=random_attacker_cookie_val" \
  -H "X-CSRF-Token: mismatched_token" \
  --data '{"config":{"inletVelocity":25.0}}'
```
*Expected Result:*
- **HTTP 403 Forbidden**
- Response Body:
```json
{
  "error": "CSRF token mismatch or missing. Request rejected.",
  "code": "CSRF_INVALID"
}
```

---

### 5. Authentication Bypass & Account Lockout

#### Test 5.1: 5 Consecutive Failed Logins trigger account lockout
```bash
for i in {1..5}; do
  curl -s -X POST "$TARGET_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    --data "{\"email\":\"$USER_EMAIL\",\"password\":\"WrongPassword$i!\"}"
done

# 6th Attempt:
curl -i -X POST "$TARGET_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$USER_EMAIL\",\"password\":\"UserCFD@2026#Secure\"}"
```
*Expected Result:*
- **HTTP 423 Locked**
- Response Body:
```json
{
  "error": "Account is temporarily locked due to consecutive failed logins. Try again in 15 minute(s).",
  "code": "ACCOUNT_LOCKED"
}
```

---

### 6. Rate Limiting DoS Prevention

#### Test 6.1: Rapid-fire requests to Auth Login endpoint
```bash
for i in {1..12}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$TARGET_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    --data '{"email":"test@example.com","password":"DummyPassword123!"}'
done
```
*Expected Result:*
- Requests 1 through 10: `401`
- Requests 11 and 12: **HTTP 429 Too Many Requests**
```json
{
  "error": "Too many authentication attempts. Please try again after 15 minutes.",
  "code": "AUTH_RATE_LIMIT_EXCEEDED"
}
```

---

### 7. Cross-Site Scripting (XSS) & Content-Security-Policy

#### Test 7.1: Verify HTTP Security Headers
```bash
curl -I "$TARGET_URL/api/health"
```
*Expected Result:*
```http
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' ...
```

---

### 8. Server-Side Request Forgery (SSRF) Prevention

#### Test 8.1: Simulation worker has no network access
When OpenFOAM is executed with `--network none` in Docker:
- Outbound network calls from within solver modules or subprocesses fail immediately with `ENETUNREACH` or `EPERM`.
- No webhook URLs or callbacks are exposed in the simulation API schema.

---

### 9. SQL / Operator Injection Prevention

#### Test 9.1: MongoDB / SQL operator injection in Login
```bash
curl -i -X POST "$TARGET_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  --data '{"email":{"$gt":""},"password":{"$gt":""}}'
```
*Expected Result:*
- **HTTP 400 Bad Request**
- Zod schema enforces: `email must be string`, `password must be string`. Object operators (`$gt`, `$ne`, `$where`) fail validation instantly.
