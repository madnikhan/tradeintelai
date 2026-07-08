/**
 * Client-side bridge presence from Firestore bridgeAgent doc.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/lib/firebase/config';
import {
  type BridgeAgentDoc,
  isBridgeOnline,
  bridgeAgentDocPath,
} from '@/lib/firebase/bridge-agent';

export type BridgePresenceState =
  | 'unknown'
  | 'not_paired'
  | 'online'
  | 'offline'
  | 'online_ea_disconnected';

export interface BridgePresence {
  state: BridgePresenceState;
  doc: BridgeAgentDoc | null;
  bridgeUrl: string | null;
}

export function subscribeBridgePresence(
  uid: string,
  callback: (presence: BridgePresence) => void
): () => void {
  if (!isFirebaseConfigured() || !uid || uid === 'anonymous') {
    callback({ state: 'not_paired', doc: null, bridgeUrl: null });
    return () => {};
  }

  const ref = doc(getDb(), 'users', uid, 'bridgeAgent', 'current');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback({ state: 'not_paired', doc: null, bridgeUrl: null });
        return;
      }
      const data = snap.data() as BridgeAgentDoc;
      const online = isBridgeOnline(data.lastSeen);
      let state: BridgePresenceState = online ? 'online' : 'offline';
      if (online && !data.mt5Connected) {
        state = 'online_ea_disconnected';
      }
      callback({
        state,
        doc: data,
        bridgeUrl: data.bridgeUrl ?? null,
      });
    },
    () => {
      callback({ state: 'unknown', doc: null, bridgeUrl: null });
    }
  );
}
