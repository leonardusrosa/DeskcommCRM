/**
 * lib/integrations/pms/ssrf.ts
 *
 * Server-Side Request Forgery (SSRF) prevention guard for PMS endpoints.
 * Validates external URLs against private IP ranges, local DNS names,
 * and optional host allowlists before any HTTP transport occurs.
 */

export class PmsSsrfSecurityError extends Error {
  constructor(reason: string, endpoint?: string) {
    super(`[PMS SSRF Security Error] ${reason}${endpoint ? ` (${endpoint})` : ""}`);
    this.name = "PmsSsrfSecurityError";
  }
}

const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^127\./, // Loopback 127.0.0.0/8
  /^10\./, // Private 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private 172.16.0.0/12
  /^192\.168\./, // Private 192.168.0.0/16
  /^169\.254\./, // Link-local & cloud metadata 169.254.0.0/16
  /^0\./, // Current network 0.0.0.0/8
];

const FORBIDDEN_HOSTNAMES: readonly string[] = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
];

const FORBIDDEN_SUFFIXES: readonly string[] = [
  ".local",
  ".internal",
  ".localhost",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
];

export function assertSafePmsEndpoint(endpointUrl: string): void {
  if (!endpointUrl || typeof endpointUrl !== "string") {
    throw new PmsSsrfSecurityError("Missing or invalid endpoint URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new PmsSsrfSecurityError("Malformed endpoint URL.", endpointUrl);
  }

  if (parsed.protocol !== "https:") {
    throw new PmsSsrfSecurityError(
      "Insecure protocol rejected. Only HTTPS is permitted.",
      endpointUrl
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Direct forbidden hostnames
  if (FORBIDDEN_HOSTNAMES.includes(hostname)) {
    throw new PmsSsrfSecurityError(
      `Private or loopback destination "${hostname}" is blocked.`,
      endpointUrl
    );
  }

  // 2. Private DNS suffixes
  for (const suffix of FORBIDDEN_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new PmsSsrfSecurityError(
        `Internal private domain "${hostname}" is blocked.`,
        endpointUrl
      );
    }
  }

  // 3. Private IP ranges
  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new PmsSsrfSecurityError(
        `Private network IP address "${hostname}" is blocked.`,
        endpointUrl
      );
    }
  }

  // 4. Allowed hosts filter if configured
  const allowedHostsRaw = process.env.PMS_BRIDGE_ALLOWED_HOSTS?.trim();
  if (allowedHostsRaw) {
    const allowed = allowedHostsRaw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length > 0) {
      const isAllowed = allowed.some((allowedHost) => {
        if (allowedHost.startsWith("*.")) {
          const rootDomain = allowedHost.slice(2);
          return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
        }
        return hostname === allowedHost;
      });

      if (!isAllowed) {
        throw new PmsSsrfSecurityError(
          `Host "${hostname}" is not in the PMS_BRIDGE_ALLOWED_HOSTS allowlist.`,
          endpointUrl
        );
      }
    }
  }
}
