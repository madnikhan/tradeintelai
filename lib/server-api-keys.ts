/**
 * Server-Side API Key Manager
 * Reads API keys from environment variables (server-side only)
 * This file should NEVER be imported in client-side code
 */

type ServiceName = 'FINNHUB' | 'TWELVE_DATA' | 'NEWSDATA' | 'FIXER' | 'ALPHA_VANTAGE';

interface APIKeyConfig {
  keys: string[];
  currentIndex: number;
  failures: Map<string, number>;
  lastFailure: Map<string, number>;
}

class ServerAPIKeyManager {
  private configs: Map<ServiceName, APIKeyConfig> = new Map();
  private readonly MAX_FAILURES = 3;
  private readonly FAILURE_RESET_TIME = 60 * 60 * 1000; // 1 hour

  private getConfig(service: ServiceName): APIKeyConfig {
    if (!this.configs.has(service)) {
      const keys = this.getKeysFromEnv(service);
      this.configs.set(service, {
        keys,
        currentIndex: 0,
        failures: new Map(),
        lastFailure: new Map(),
      });
    }
    return this.configs.get(service)!;
  }

  private getKeysFromEnv(service: ServiceName): string[] {
    const keys: string[] = [];
    
    // Try to get multiple keys (key_1, key_2, etc.)
    for (let i = 1; i <= 10; i++) {
      const envVar = `${service}_API_KEY_${i}`;
      const key = process.env[envVar];
      if (key) {
        keys.push(key);
      }
    }
    
    // Fallback: try single key without number
    if (keys.length === 0) {
      const singleKey = process.env[`${service}_API_KEY`];
      if (singleKey) {
        keys.push(singleKey);
      }
    }

    // Also try with underscores instead of underscores
    if (keys.length === 0) {
      const envVar = service.replace('_', '');
      const key = process.env[`${envVar}_API_KEY`];
      if (key) {
        keys.push(key);
      }
    }

    return keys;
  }

  getKey(service: ServiceName): string | null {
    const config = this.getConfig(service);
    
    if (config.keys.length === 0) {
      console.warn(`⚠️ No API keys configured for ${service}`);
      return null;
    }

    let attempts = 0;
    
    // Find a key that hasn't failed too many times
    while (attempts < config.keys.length) {
      const key = config.keys[config.currentIndex];
      const failures = config.failures.get(key) || 0;
      const lastFailure = config.lastFailure.get(key) || 0;
      const timeSinceFailure = Date.now() - lastFailure;
      
      // Reset failures if enough time has passed
      if (timeSinceFailure > this.FAILURE_RESET_TIME && failures > 0) {
        config.failures.set(key, 0);
      }
      
      // Use this key if it hasn't failed too many times
      if (failures < this.MAX_FAILURES) {
        // Rotate to next key for next call
        config.currentIndex = (config.currentIndex + 1) % config.keys.length;
        return key;
      }
      
      // This key has failed too many times, try next one
      config.currentIndex = (config.currentIndex + 1) % config.keys.length;
      attempts++;
    }
    
    // All keys have failed, reset and return first key
    config.currentIndex = 0;
    return config.keys[0];
  }

  recordFailure(service: ServiceName, key: string): void {
    const config = this.getConfig(service);
    const currentFailures = config.failures.get(key) || 0;
    config.failures.set(key, currentFailures + 1);
    config.lastFailure.set(key, Date.now());
  }

  recordSuccess(service: ServiceName, key: string): void {
    const config = this.getConfig(service);
    config.failures.set(key, 0); // Reset failures on success
  }

  hasKeys(service: ServiceName): boolean {
    const config = this.getConfig(service);
    return config.keys.length > 0;
  }
}

// Export singleton instance (server-side only)
export const serverAPIKeyManager = new ServerAPIKeyManager();

// Type guard to ensure this is only used server-side
if (typeof window !== 'undefined') {
  throw new Error('server-api-keys.ts must only be used server-side!');
}

