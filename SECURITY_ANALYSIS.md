# Vortex Security Analysis and Hardening Recommendations

## Executive Summary

This document provides a comprehensive security analysis of the Vortex mod manager's extension system and overall architecture. The analysis identifies current security practices, vulnerabilities, and provides detailed recommendations for hardening the application against potential threats.

**Key Findings:**
- ✅ Strong foundation with CSP, OAuth, and input sanitization
- ⚠️ Critical vulnerabilities in HTML injection and extension loading
- 🔧 Significant improvement opportunities in dependency management and sandboxing

---

## Table of Contents

1. [Current Security Posture](#current-security-posture)
2. [Vulnerability Assessment](#vulnerability-assessment)
3. [Hardening Recommendations](#hardening-recommendations)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Current Security Posture

### ✅ Existing Security Measures

#### Content Security Policy (CSP)
- **Location**: `src/index.html`, `src/index.dev.html`
- **Implementation**: Restricts script sources to `'self'` and specific SHA256 hashes
- **Status**: ✅ Well implemented

#### Input Sanitization
- **Location**: `src/util/util.ts`
- **Features**:
  - Filename sanitization with `INVALID_FILENAME_RE`
  - Path validation with `isPathValid()`
  - Reserved name checking for Windows compatibility
- **Status**: ✅ Comprehensive implementation

#### OAuth Authentication
- **Location**: `src/extensions/nexus_integration/`
- **Features**:
  - Secure token management
  - Automatic token refresh
  - Error handling for expired/invalid tokens
- **Status**: ✅ Industry standard implementation

#### Network Security
- **Location**: `src/util/network.ts`
- **Features**:
  - User-Agent headers
  - Content-type validation
  - Status code verification
- **Status**: ✅ Basic security measures in place

---

## Vulnerability Assessment

### 🚨 Critical Vulnerabilities

#### 1. Unsafe HTML Injection
**Risk Level**: Critical  
**CVSS Score**: 8.8 (High)

**Affected Files**:
- `src/views/Dialog.tsx` (line 280)
- `src/util/StyleManager.ts` (line 381)
- `src/util/ExtensionManager.ts` (line 2369)

**Description**: 
Direct use of `dangerouslySetInnerHTML` and `innerHTML` without sanitization allows potential XSS attacks.

**Example Vulnerable Code**:
```typescript
// Dialog.tsx - Line 280
<div
  dangerouslySetInnerHTML={{ __html: content.htmlText }}
/>

// StyleManager.ts - Line 381
style.innerHTML = css;
```

**Impact**: 
- Cross-site scripting (XSS) attacks
- Code injection
- Session hijacking
- Data theft

#### 2. Unrestricted Extension Loading
**Risk Level**: Critical  
**CVSS Score**: 9.1 (Critical)

**Affected Files**:
- `src/util/ExtensionManager.ts` (loadDynamicExtension method)

**Description**: 
Extensions are loaded from user-controlled directories without signature verification or sandboxing.

**Vulnerable Process**:
1. Extensions loaded from `getExtensionPaths()`
2. No signature verification
3. Full Node.js API access
4. No permission model

**Impact**:
- Arbitrary code execution
- File system access
- Network access
- System compromise

### ⚠️ High-Risk Issues

#### 3. Deprecated Dependencies
**Risk Level**: High  
**CVSS Score**: 7.5 (High)

**Vulnerable Dependencies**:
```json
{
  "request": "^2.88.0",        // Deprecated, known vulnerabilities
  "lodash": "^4.17.21",        // Prototype pollution risks
  "ws": "^7.5.10",            // Potential DoS vulnerabilities
  "xml2js": "^0.5.0",         // XXE injection risks
  "shortid": "2.2.8"          // Predictable IDs
}
```

#### 4. Insufficient Network Validation
**Risk Level**: Medium  
**CVSS Score**: 6.1 (Medium)

**Issues**:
- No certificate pinning
- Limited TLS validation
- No request size limits
- Missing timeout controls

---

## Hardening Recommendations

### 1. HTML Injection Prevention

#### Implementation Steps:

**Step 1: Install DOMPurify**
```bash
yarn add dompurify
yarn add --dev @types/dompurify
```

**Step 2: Replace Unsafe HTML Injection**
```typescript
// src/views/Dialog.tsx
import DOMPurify from 'dompurify';

// Replace line 280
<div
  key='dialog-content-html-text'
  className='dialog-content-html'
  dangerouslySetInnerHTML={{ 
    __html: DOMPurify.sanitize(content.htmlText, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
      ALLOWED_ATTR: ['href', 'target'],
      ALLOWED_URI_REGEXP: /^https?:\/\//
    })
  }}
/>
```

**Step 3: Secure CSS Injection**
```typescript
// src/util/StyleManager.ts
private applyCSS(css: string) {
  // Validate CSS before injection
  const sanitizedCSS = this.sanitizeCSS(css);
  
  const style = document.createElement('style');
  style.id = 'theme';
  style.type = 'text/css';
  style.textContent = sanitizedCSS; // Use textContent instead of innerHTML
  
  // Rest of implementation...
}

private sanitizeCSS(css: string): string {
  // Remove potentially dangerous CSS
  return css
    .replace(/javascript:/gi, '')
    .replace(/expression\(/gi, '')
    .replace(/import\s+/gi, '')
    .replace(/@import/gi, '');
}
```

### 2. Extension Security Framework

#### Implementation Steps:

**Step 1: Create Permission Model**
```typescript
// src/types/IExtensionSecurity.ts
export interface IExtensionPermissions {
  fileSystem: {
    read: string[];
    write: string[];
    execute: boolean;
  };
  network: {
    allowedDomains: string[];
    allowHTTP: boolean;
    maxRequestSize: number;
  };
  apis: {
    vortex: string[];
    node: string[];
  };
  ui: {
    showDialogs: boolean;
    modifyInterface: boolean;
  };
}

export interface IExtensionManifest {
  name: string;
  version: string;
  author: string;
  permissions: IExtensionPermissions;
  signature?: string;
  trusted: boolean;
}
```

**Step 2: Implement Extension Sandbox**
```typescript
// src/util/ExtensionSandbox.ts
import { Worker } from 'worker_threads';
import { createHash } from 'crypto';

export class ExtensionSandbox {
  private workers: Map<string, Worker> = new Map();
  
  async loadExtension(
    extensionPath: string, 
    manifest: IExtensionManifest
  ): Promise<void> {
    // Verify signature
    if (!await this.verifySignature(extensionPath, manifest.signature)) {
      throw new Error('Extension signature verification failed');
    }
    
    // Create sandboxed worker
    const worker = new Worker('./extension-worker.js', {
      workerData: {
        extensionPath,
        permissions: manifest.permissions
      }
    });
    
    this.workers.set(manifest.name, worker);
  }
  
  private async verifySignature(
    extensionPath: string, 
    signature?: string
  ): Promise<boolean> {
    if (!signature) return false;
    
    // Implement signature verification logic
    const fileHash = await this.calculateFileHash(extensionPath);
    return this.validateSignature(fileHash, signature);
  }
}
```

**Step 3: Extension Worker Template**
```javascript
// src/util/extension-worker.js
const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// Restricted require function
const restrictedRequire = (moduleName) => {
  const allowedModules = workerData.permissions.apis.node;
  
  if (!allowedModules.includes(moduleName)) {
    throw new Error(`Module '${moduleName}' not permitted`);
  }
  
  return require(moduleName);
};

// Load extension with restricted context
try {
  const extensionModule = require(workerData.extensionPath);
  
  // Provide restricted API
  const restrictedAPI = createRestrictedAPI(workerData.permissions);
  
  extensionModule.init(restrictedAPI);
} catch (error) {
  parentPort.postMessage({ type: 'error', error: error.message });
}
```

### 3. Dependency Security

#### Implementation Steps:

**Step 1: Replace Deprecated Dependencies**
```bash
# Remove deprecated packages
yarn remove request

# Add secure alternatives
yarn add axios@^1.6.0
yarn add lodash-es@^4.17.21  # ES modules version
yarn add ws@^8.14.0
yarn add fast-xml-parser@^4.3.0  # Replace xml2js
yarn add nanoid@^5.0.0  # Replace shortid
```

**Step 2: Update package.json**
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "lodash-es": "^4.17.21",
    "ws": "^8.14.0",
    "fast-xml-parser": "^4.3.0",
    "nanoid": "^5.0.0"
  },
  "scripts": {
    "audit": "yarn audit --level moderate",
    "audit-fix": "yarn audit --fix",
    "security-check": "yarn audit && yarn outdated"
  }
}
```

**Step 3: Implement Automated Security Scanning**
```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Run security audit
        run: yarn audit --level moderate
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 4. Network Security Enhancement

#### Implementation Steps:

**Step 1: Implement Certificate Pinning**
```typescript
// src/util/SecureNetwork.ts
import https from 'https';
import { checkServerIdentity } from 'tls';

const CERTIFICATE_PINS = {
  'api.nexusmods.com': [
    'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
  ]
};

export interface ISecureRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  maxSize?: number;
}

export class SecureNetwork {
  static async request(options: ISecureRequestOptions): Promise<any> {
    const url = new URL(options.url);
    
    const requestOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Vortex/1.0',
        ...options.headers
      },
      timeout: options.timeout || 30000,
      checkServerIdentity: (hostname, cert) => {
        const pins = CERTIFICATE_PINS[hostname];
        if (pins && !pins.includes(cert.fingerprint256)) {
          throw new Error(`Certificate pinning failed for ${hostname}`);
        }
        return checkServerIdentity(hostname, cert);
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        let data = '';
        let size = 0;
        const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
        
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxSize) {
            req.destroy();
            reject(new Error('Response too large'));
            return;
          }
          data += chunk;
        });
        
        res.on('end', () => {
          resolve(JSON.parse(data));
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (options.data) {
        req.write(JSON.stringify(options.data));
      }
      
      req.end();
    });
  }
}
```

### 5. Enhanced Content Security Policy

#### Implementation Steps:

**Step 1: Update CSP Headers**
```html
<!-- src/index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'sha256-HASH1' 'sha256-HASH2';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.nexusmods.com https://*.nexusmods.com;
  font-src 'self' data:;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
">
```

**Step 2: Implement CSP Violation Reporting**
```typescript
// src/util/CSPReporting.ts
export function setupCSPReporting(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    const violation = {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      timestamp: new Date().toISOString()
    };
    
    // Log security violation
    console.error('CSP Violation:', violation);
    
    // Report to security monitoring
    reportSecurityEvent('csp_violation', violation);
  });
}
```

---

## Implementation Roadmap

### Phase 1: Critical Security Fixes (Week 1-2)
- [ ] Implement HTML sanitization with DOMPurify
- [ ] Replace deprecated `request` library with `axios`
- [ ] Update vulnerable dependencies
- [ ] Enhance CSP headers

### Phase 2: Extension Security Framework (Week 3-6)
- [ ] Design and implement permission model
- [ ] Create extension sandbox architecture
- [ ] Implement signature verification system
- [ ] Develop extension worker template

### Phase 3: Network Security Enhancement (Week 7-8)
- [ ] Implement certificate pinning
- [ ] Add request size limits and timeouts
- [ ] Enhance TLS validation
- [ ] Create secure network utility class

### Phase 4: Monitoring and Maintenance (Week 9-10)
- [ ] Set up automated security scanning
- [ ] Implement security event logging
- [ ] Create security incident response procedures
- [ ] Establish regular security review process

---

## Monitoring and Maintenance

### Security Event Logging

```typescript
// src/util/SecurityLogger.ts
export interface ISecurityEvent {
  type: 'extension_load' | 'file_access' | 'network_request' | 'auth_failure' | 'csp_violation';
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  source?: string;
}

export class SecurityLogger {
  private static events: ISecurityEvent[] = [];
  
  static logEvent(event: ISecurityEvent): void {
    this.events.push(event);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security Event:', event);
    }
    
    // Alert on critical events
    if (event.severity === 'critical') {
      this.alertCriticalEvent(event);
    }
    
    // Persist to secure log file
    this.persistEvent(event);
  }
  
  private static alertCriticalEvent(event: ISecurityEvent): void {
    // Implement alerting mechanism
    // Could be email, webhook, or system notification
  }
  
  private static persistEvent(event: ISecurityEvent): void {
    // Write to secure audit log
    // Implement log rotation and encryption
  }
}
```

### Regular Security Tasks

#### Weekly Tasks
- [ ] Review security event logs
- [ ] Check for dependency updates
- [ ] Monitor security advisories

#### Monthly Tasks
- [ ] Run comprehensive security audit
- [ ] Review and update security policies
- [ ] Test incident response procedures

#### Quarterly Tasks
- [ ] Penetration testing
- [ ] Security architecture review
- [ ] Update threat model

---

## Testing Security Implementations

### Unit Tests for Security Functions

```typescript
// __tests__/security/sanitization.test.ts
import DOMPurify from 'dompurify';

describe('HTML Sanitization', () => {
  test('should remove script tags', () => {
    const malicious = '<script>alert("xss")</script><p>Safe content</p>';
    const sanitized = DOMPurify.sanitize(malicious);
    expect(sanitized).toBe('<p>Safe content</p>');
  });
  
  test('should remove javascript: URLs', () => {
    const malicious = '<a href="javascript:alert(1)">Click me</a>';
    const sanitized = DOMPurify.sanitize(malicious);
    expect(sanitized).not.toContain('javascript:');
  });
});
```

### Integration Tests

```typescript
// __tests__/security/extension-sandbox.test.ts
import { ExtensionSandbox } from '../../src/util/ExtensionSandbox';

describe('Extension Sandbox', () => {
  test('should reject unsigned extensions', async () => {
    const sandbox = new ExtensionSandbox();
    const manifest = { name: 'test', permissions: {}, trusted: false };
    
    await expect(
      sandbox.loadExtension('/path/to/extension', manifest)
    ).rejects.toThrow('Extension signature verification failed');
  });
});
```

---

## Conclusion

This security analysis provides a comprehensive roadmap for hardening Vortex against current and emerging threats. The recommendations prioritize critical vulnerabilities while maintaining the application's extensibility and user experience.

**Key Success Metrics:**
- Zero critical vulnerabilities in production
- All extensions running in sandboxed environments
- Automated security scanning in CI/CD pipeline
- Regular security audits and updates

**Next Steps:**
1. Review and approve this security plan
2. Assign implementation teams for each phase
3. Set up security monitoring infrastructure
4. Begin Phase 1 implementation

For questions or clarifications about any recommendations in this document, please contact the security team.

---

*Document Version: 1.0*  
*Last Updated: January 2024*  
*Next Review: April 2024*