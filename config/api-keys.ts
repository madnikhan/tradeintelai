/**
 * @deprecated This file is deprecated and no longer used.
 * API keys are now managed server-side via environment variables.
 * This stub file exists only to prevent build errors from legacy imports.
 * 
 * All API calls should use the secure proxy routes in app/api/proxy/
 */

// Empty exports to satisfy any legacy imports
export const API_KEYS = {};
export const apiKeyManager = {
  getKey: () => null,
  rotateKey: () => null,
};
