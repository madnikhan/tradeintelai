/**
 * Bridge agent presence + pairing (Firestore server-side).
 */

import { createHash, randomBytes } from 'crypto';

export type BridgeTunnelType = 'named' | 'ephemeral';
export type BridgeAgentStatus = 'online' | 'offline';

export interface BridgeAgentDoc {
  bridgeUrl: string | null;
  tunnelType: BridgeTunnelType;
  status: BridgeAgentStatus;
  lastSeen: string;
  mt5Connected: boolean;
  accountLogin?: string | number;
  bridgeVersion?: string;
  agentTokenHash?: string;
}

export interface BridgePairingDoc {
  code: string;
  uid: string;
  expiresAt: string;
  used: boolean;
}

export const BRIDGE_ONLINE_THRESHOLD_MS = 90_000;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

export function hashBridgeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generatePairingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateBridgeToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isBridgeOnline(lastSeen: string | undefined | null): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < BRIDGE_ONLINE_THRESHOLD_MS;
}

export function bridgeAgentDocPath(uid: string): string {
  return `users/${uid}/bridgeAgent/current`;
}

export function bridgePairingCollection(uid: string): string {
  return `users/${uid}/bridgePairing`;
}
