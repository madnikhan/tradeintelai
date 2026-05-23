/**
 * MT5 accounts in Firestore with shared access (owner + members).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '@/lib/firebase/config';
import { getUserId } from '@/lib/firebase/auth';

export type Mt5MemberRole = 'owner' | 'trader' | 'viewer';

export interface Mt5AccountRecord {
  id: string;
  login: number;
  server: string;
  name: string;
  ownerUid: string;
  bridgeUrl: string;
  bridgeType: 'colleague' | 'central';
  createdAt?: string;
  updatedAt?: string;
}

export interface Mt5MemberRecord {
  uid: string;
  role: Mt5MemberRole;
  grantedBy: string;
  grantedAt: string;
}

const COL = 'mt5Accounts';

export async function listVisibleMt5Accounts(): Promise<Mt5AccountRecord[]> {
  const uid = getUserId();
  if (!uid || uid === 'anonymous' || !isFirebaseConfigured()) return [];

  const owned = await getDocs(query(collection(getDb(), COL), where('ownerUid', '==', uid)));
  const ownedList = owned.docs.map((d) => ({ id: d.id, ...d.data() } as Mt5AccountRecord));

  const all = await getDocs(collection(getDb(), COL));
  const shared: Mt5AccountRecord[] = [];
  for (const d of all.docs) {
    if (d.data().ownerUid === uid) continue;
    const memberRef = doc(getDb(), COL, d.id, 'members', uid);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      shared.push({ id: d.id, ...d.data() } as Mt5AccountRecord);
    }
  }

  const byId = new Map<string, Mt5AccountRecord>();
  [...ownedList, ...shared].forEach((a) => byId.set(a.id, a));
  return Array.from(byId.values());
}

export async function createMt5Account(
  data: Omit<Mt5AccountRecord, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string | null> {
  const uid = getUserId();
  if (!uid || uid === 'anonymous' || !isFirebaseConfigured()) return null;

  const now = new Date().toISOString();
  const ref = await addDoc(collection(getDb(), COL), {
    ...data,
    ownerUid: uid,
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(getDb(), COL, ref.id, 'members', uid), {
    uid,
    role: 'owner',
    grantedBy: uid,
    grantedAt: now,
  });
  return ref.id;
}

export async function grantMt5AccountAccess(
  accountId: string,
  memberUid: string,
  role: Mt5MemberRole = 'trader'
): Promise<boolean> {
  const uid = getUserId();
  if (!uid || !isFirebaseConfigured()) return false;

  const accountRef = doc(getDb(), COL, accountId);
  const accountSnap = await getDoc(accountRef);
  if (!accountSnap.exists() || accountSnap.data().ownerUid !== uid) return false;

  await setDoc(doc(getDb(), COL, accountId, 'members', memberUid), {
    uid: memberUid,
    role,
    grantedBy: uid,
    grantedAt: new Date().toISOString(),
  });
  return true;
}

export async function revokeMt5AccountAccess(accountId: string, memberUid: string): Promise<boolean> {
  const uid = getUserId();
  if (!uid || !isFirebaseConfigured()) return false;

  const accountSnap = await getDoc(doc(getDb(), COL, accountId));
  if (!accountSnap.exists() || accountSnap.data().ownerUid !== uid) return false;

  await deleteDoc(doc(getDb(), COL, accountId, 'members', memberUid));
  return true;
}

export async function getMemberRole(
  accountId: string,
  memberUid?: string
): Promise<Mt5MemberRole | null> {
  const uid = memberUid || getUserId();
  if (!uid || !isFirebaseConfigured()) return null;

  const accountSnap = await getDoc(doc(getDb(), COL, accountId));
  if (!accountSnap.exists()) return null;
  if (accountSnap.data().ownerUid === uid) return 'owner';

  const memberSnap = await getDoc(doc(getDb(), COL, accountId, 'members', uid));
  if (!memberSnap.exists()) return null;
  return (memberSnap.data().role as Mt5MemberRole) || null;
}

export async function canTradeMt5Account(accountId: string): Promise<boolean> {
  const role = await getMemberRole(accountId);
  return role === 'owner' || role === 'trader';
}

export async function findAccountByLogin(login: number): Promise<Mt5AccountRecord | null> {
  const accounts = await listVisibleMt5Accounts();
  return accounts.find((a) => a.login === login) ?? null;
}

export function canTradeByRole(role: Mt5MemberRole | null): boolean {
  return role === 'owner' || role === 'trader';
}
