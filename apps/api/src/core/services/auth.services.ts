// src/core/services/auth.service.ts
import jwt from 'jsonwebtoken';
import { getUserByLoginOrEmail } from '@vp/core/services/user/user.services';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';
import { getUserMeta } from '@vp/core/services/user/userMeta.services';
import { getRoles } from '@vp/core/roles/roles';
import { db } from '@vp/core/db';
import { cache } from '@vp/core/utils/cacheManager';

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
  serverHooks.doAction('svc.jwt.sign:action:before', { userId });
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '14d' });
  serverHooks.doAction('svc.jwt.sign:action:after', { userId, token });
  return token;
}

export async function authenticateUsernamePassword(identifier: string, password: string) {
  serverHooks.doAction('svc.user.login:action:before', { identifier });
  const user = await getUserByLoginOrEmail(identifier);

  if (!user) {
    serverHooks.doAction('svc.user.login:action:error', { error: new Error('User not found') });
    throw new Error('User not found');
  }
  const valid = await comparePassword(password, user.user_pass);

  if (!valid) {
    serverHooks.doAction('svc.user.login:action:error', { error: new Error('Invalid password') });
    throw new Error('Invalid password');
  }
  const token = signJwt(user.ID);
  serverHooks.doAction('svc.user.login:action:after', { user, token });
  return { user, token };
}

export function verifyJwt(token: string): { userId: number } {
  serverHooks.doAction('svc.jwt.verify:action:before', { token });
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
  serverHooks.doAction('svc.jwt.verify:action:after', { token, decoded });
  return decoded;
}
export interface CapabilityCheckArgs {
  capabilities: string[];
}

export async function userCan(userId: number, args: CapabilityCheckArgs, dbClient: DbOrTrx = db): Promise<boolean> {
  await serverHooks.doAction('svc.user.can:action:before', { userId, args });

  const { capabilities } = args;
  const cacheKey = `user:${userId}:capabilities`;
  let userCapabilities: Record<string, boolean> | null = await cache.get(cacheKey);

  if (!userCapabilities) {
    // getUserMeta returns the meta_value directly, or null
    const userRolesMetaValue = await getUserMeta(userId, 'wp_capabilities', dbClient);
    console.log(`[userCan ${userId}] getUserMeta result for 'wp_capabilities':`, userRolesMetaValue);

    // Check if the returned value is a non-null object
    if (userRolesMetaValue && typeof userRolesMetaValue === 'object') {
      const userRoles = userRolesMetaValue as Record<string, boolean>; // Safe cast
      const allRoles = await getRoles(dbClient);
      userCapabilities = Object.keys(userRoles).reduce((caps, role) => {
        // Check if the role is explicitly set to true in the meta and exists in allRoles
        if (userRoles[role] === true && allRoles[role]) {
          return { ...caps, ...allRoles[role].capabilities };
        }
        return caps;
      }, {} as Record<string, boolean>);
    } else {
      // If no valid meta_value object found (returned null or not an object)
      console.warn(`[userCan ${userId}] No valid 'wp_capabilities' meta object found. User might lack roles or meta is corrupt.`);
      userCapabilities = {}; // Initialize as empty
    }

    await cache.set(cacheKey, userCapabilities, 3600 * 1000); // Cache the determined capabilities
  }

  // Now userCapabilities should be correctly populated based on the roles object
  console.log(`[userCan ${userId}] Determined userCapabilities:`, userCapabilities);
  console.log(`[userCan ${userId}] Required capabilities:`, capabilities);

  const hasAllCaps = capabilities.every(cap => userCapabilities && userCapabilities[cap]); // Check userCapabilities exists

  const filteredResult = await serverHooks.applyFilters('svc.user.can:filter:result', hasAllCaps, { userId, args, userCapabilities });
  await serverHooks.doAction('svc.user.can:action:after', { userId, args, result: filteredResult });
  return filteredResult;
}