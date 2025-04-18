// src/core/services/auth.service.ts
import jwt from 'jsonwebtoken';
import { getUserByLoginOrEmail } from './user/user.services';
import { serverHooks } from '../../core/hooks/hookEngine.server';
import { getUserMeta } from './user/userMeta.services';
import { getRoles } from '../roles/roles';
import { db } from '../db';
import { cache } from '../utils/cacheManager';

// Correctly define Db/Transaction types
type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (client: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

const JWT_SECRET = process.env.JWT_SECRET!;

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return await Bun.password.verify(password, hashed);
}

export function signJwt(userId: number): string {
  serverHooks.doAction('jwt.sign:before', { userId });
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '14d' });
  serverHooks.doAction('jwt.sign:after', { userId, token });
  return token;
}

export async function authenticateUsernamePassword(identifier: string, password: string) {
  serverHooks.doAction('user.login:before', { identifier });
  const user = await getUserByLoginOrEmail(identifier);

  if (!user) {
    serverHooks.doAction('user.login:error', { error: new Error('User not found') });
    throw new Error('User not found');
  }
  const valid = await comparePassword(password, user.user_pass);

  if (!valid) {
    serverHooks.doAction('user.login:error', { error: new Error('Invalid password') });
    throw new Error('Invalid password');
  }
  const token = signJwt(user.ID);
  serverHooks.doAction('user.login:after', { user, token });
  return { user, token };
}

export function verifyJwt(token: string): { userId: number } {
  serverHooks.doAction('jwt.verify:before', { token });
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
  serverHooks.doAction('jwt.verify:after', { token, decoded });
  return decoded;
}
export interface CapabilityCheckArgs {
  capabilities: string[];
}

export async function userCan(userId: number, args: CapabilityCheckArgs, dbClient: DbOrTrx = db): Promise<boolean> {
  await serverHooks.doAction('user.can:before', { userId, args });

  const { capabilities } = args;
  const cacheKey = `user:${userId}:capabilities`;
  let userCapabilities: Record<string, boolean> | null = await cache.get(cacheKey);

  if (!userCapabilities) {
    const meta = await getUserMeta(userId, 'wp_capabilities', dbClient);
    if (meta.length === 0) return false;

    const userRoles = meta[0].meta_value as Record<string, boolean>;
    const allRoles = await getRoles(dbClient);
    userCapabilities = Object.keys(userRoles).reduce((caps, role) => {
      if (allRoles[role]) return { ...caps, ...allRoles[role].capabilities };
      return caps;
    }, {} as Record<string, boolean>);

    await cache.set(cacheKey, userCapabilities, 3600 * 1000); // Cache for 1 hour
  }

  console.log('userCapabilities', userCapabilities);
  console.log('capabilities', capabilities);

  const hasAllCaps = capabilities.every(cap => userCapabilities[cap]);

  const filteredResult = await serverHooks.applyFilters('user.can', hasAllCaps, { userId, args, userCapabilities });
  await serverHooks.doAction('user.can:after', { userId, args, result: filteredResult });
  return filteredResult;
}