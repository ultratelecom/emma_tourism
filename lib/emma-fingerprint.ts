/**
 * Emma Browser Fingerprint Generator
 * 
 * Creates a semi-unique identifier for browsers to recognize returning users
 * even before they provide their email.
 */

/**
 * Generate a browser fingerprint from available browser data
 * This runs client-side only
 */
export async function generateBrowserFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server-side';
  }

  const components: string[] = [];

  // Screen properties
  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  components.push(`${screen.pixelDepth}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);
  components.push((navigator.languages || []).join(','));

  // Platform
  components.push(navigator.platform);

  // Hardware concurrency
  components.push(String(navigator.hardwareConcurrency || 0));

  // Device memory (if available)
  components.push(String((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0));

  // Touch support
  components.push(String(navigator.maxTouchPoints || 0));

  // WebGL renderer (if available)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch {
    components.push('webgl-unavailable');
  }

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Emma Tobago 🌴', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Emma Tobago 🌴', 4, 17);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push('canvas-unavailable');
  }

  // Create hash from components
  const fingerprint = await hashString(components.join('|||'));
  return fingerprint;
}

/**
 * Simple hash function using Web Crypto API
 */
async function hashString(str: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback for environments without crypto
    return simpleHash(str);
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return simpleHash(str);
  }
}

/**
 * Simple hash fallback
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Get or create a stored fingerprint
 * Uses localStorage to persist the fingerprint across sessions
 */
export async function getStoredFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server-side';
  }

  const STORAGE_KEY = 'emma_browser_fp';

  // Try to get existing fingerprint
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length >= 16) {
      return stored;
    }
  } catch {
    // localStorage might be blocked
  }

  // Generate new fingerprint
  const fingerprint = await generateBrowserFingerprint();

  // Store it
  try {
    localStorage.setItem(STORAGE_KEY, fingerprint);
  } catch {
    // localStorage might be blocked
  }

  return fingerprint;
}

/**
 * Get stored user ID (if previously identified)
 */
export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem('emma_user_id');
  } catch {
    return null;
  }
}

/**
 * Store user ID for future sessions
 */
export function storeUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('emma_user_id', userId);
  } catch {
    // localStorage might be blocked
  }
}

/**
 * Clear stored user data (for testing/logout)
 */
export function clearStoredUserData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('emma_user_id');
    localStorage.removeItem('emma_browser_fp');
    localStorage.removeItem('emma_session');
  } catch {
    // localStorage might be blocked
  }
}
