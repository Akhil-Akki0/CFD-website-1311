# Enterprise Security Policy, Threat Model & Defense-in-Depth Architecture

**DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com**

## 1. System Architecture & Threat Model

The platform executes high-performance Computational Fluid Dynamics (CFD) simulations via OpenFOAM v2606. Because numerical solvers execute native binaries that read files and allocate significant CPU and RAM, security is designed using a multi-layer **Defense-in-Depth** model:

```
[ Client Browser ] 
       │  (HTTPS / TLS 1.3 / HSTS / Strict CSP)
       ▼
[ Nginx Reverse Proxy ] ── (DDoS Rate Limiting, 50MB STL Cap, Header Hardening)
       │
       ▼
[ Express API Gateway ] ── (Zod Strict Schemas, JWT 15m + Rotating Refresh 7d,
       │                    Double-Submit CSRF, bcrypt cost 12, Pwned Check,
       │                    Account Lockout, RBAC, Structured JSON Audit Logs)
       ▼
[ OpenFOAM Safe Runner ] ── (UUIDv4 Directory Isolation, Path Canonicalization,
       │                     Zero Shell Interpolation, execFile / spawn array)
       ▼
[ Docker / Cgroups Sandbox ] ── (--network none, --read-only, tmpfs /tmp/of_cases:2g,
                                 --cap-drop ALL, no-new-privileges, 2 CPUs, 2GB RAM)
```

---

## 2. OWASP Top 10 Mitigation Matrix

| OWASP Top 10 (2021/2025) | Threat Scenario | Implemented Countermeasure | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** | User tampering with other users' case IDs (IDOR), or unauthorized CFD execution. | Strict JWT authentication on all simulation endpoints. Standard users can only view cases matching their `ownerId`. Role-Based Access Control (Admin/User). | Unit test testing status endpoint with foreign UUID yields `403 Forbidden`. |
| **A02: Cryptographic Failures** | Weak password hashes, exposed JWT secrets in Git, or unencrypted transport. | Passwords hashed using bcrypt (cost 12). Min 12-char policy + HaveIBeenPwned API check. Short-lived access tokens (15m) and rotating refresh tokens (7d) in `httpOnly` `SameSite=Strict` cookies. HTTPS enforced via HSTS preload. | Secrets excluded via `.gitignore`; TLS 1.2/1.3 enforced in `nginx.conf`. |
| **A03: Injection (Command & Path)** | Malicious filenames or CFD parameters escaping to the host shell via `wsl` or bash. | **Zero Shell Concatenation**: `execFile` and `spawn` with fixed argument arrays. Strict whitelist of OpenFOAM binaries (`blockMesh`, `snappyHexMesh`, `checkMesh`, `simpleFoam`, `foamToVTK`). Case directories strictly restricted to `/tmp/of_cases/<uuid>`. Path traversal (`../`, `\0`) rejected. | Penetration tests passing shell metacharacters (`;`, `|`, `` ` ``) return immediate validation errors. |
| **A04: Insecure Design & DoS** | Massive STL files, memory exhaustion, infinite loop solver attacks, or concurrent job flooding. | 50 MB hard body limit for STLs. Binary STL header and triangle count validation (max 2,000,000 triangles). Per-user concurrency limit (max 2) and global FIFO queue (max 10). Hard 10-minute timeout killing the entire process tree (`SIGKILL`). | Submission rate limiting (10/hr) and process timeouts. |
| **A05: Security Misconfiguration** | Directory listing, default credentials, verbose stack traces leaking server files. | Helmet.js enabled with strict Content Security Policy (no `unsafe-inline` or `eval`). Error handling middleware strips stack traces and internal paths in production, returning correlation IDs. `server_tokens off` in Nginx. | Responses contain only `{ error, correlationId }`. |
| **A06: Vulnerable Components** | Outdated libraries or vulnerable container base images. | GitHub Actions CI runs `npm audit --audit-level=high` and Aqua Security Trivy container scanning. Dependabot weekly updates. CycloneDX SBOM generation. | Automated pull requests on CVE discovery. |
| **A07: Identification & Auth Failures** | Brute-force attacks, session hijacking, or credential stuffing. | Rate limiting on `/api/auth/login` (5 req / 15 min / IP). Account lockout after 5 consecutive failures for 15 minutes. TOTP 2FA mandatory for admins. Refresh token family reuse detection (revokes all family tokens upon replay). | Automated lockout test locks account after 5 attempts. |
| **A08: Software & Data Integrity** | Corrupted or malicious STL meshes, untrusted script evaluation in UI. | Binary & ASCII STL integrity checking (validating 80-byte header, facet counts, and vertex bounds). React auto-escaping and DOMPurify sanitization on rendered documentation or AI writeups. | Tampered headers rejected with `400 Bad Request`. |
| **A09: Security Logging & Monitoring** | Silent compromise or untraceable unauthorized simulations. | Structured JSON logs (via `logger.js`) with correlation IDs (`X-Correlation-ID`). Explicit audit logging for logins, lockouts, password resets, 2FA, and CFD job dispatches. Sensitive fields (`password`, `token`, `secret`, `stlBase64`) automatically redacted. Prometheus `/metrics` endpoint. | Centralized logs with machine-parsable JSON. |
| **A10: Server-Side Request Forgery** | Solver making outbound connections or SSRF via callbacks. | Worker runs in isolated container with `--network none`. No external URLs or callbacks accepted in simulation configurations. | Network isolation blocks outbound sockets. |

---

## 3. Reporting Security Vulnerabilities

Please report security issues directly to the platform developer:
- **Lead Developer**: Akhil.A
- **Email**: `akkedu01@gmail.com`
- **Response Window**: Critical security vulnerabilities will be acknowledged within 24 hours with an expedited patch window.
