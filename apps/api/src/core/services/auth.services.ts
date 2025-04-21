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

// --- Helper function to get capabilities (can be reused or integrated) ---
export async function getUserCapabilities(userId: number, dbClient: DbOrTrx = db): Promise<Record<string, boolean>> {
  const cacheKey = `user:${userId}:capabilities`;
  let cachedCapabilities: Record<string, boolean> | null = await cache.get(cacheKey);

  if (cachedCapabilities !== null) {
     return cachedCapabilities; 
  }

  let userCapabilities: Record<string, boolean> = {}; 
  const userRolesMetaValue = await getUserMeta(userId, 'wp_capabilities', dbClient);

  if (userRolesMetaValue && typeof userRolesMetaValue === 'object') {
    const userRoles = userRolesMetaValue as Record<string, boolean>; 
    const allRoles = await getRoles(dbClient); 
    userCapabilities = Object.keys(userRoles).reduce((caps, roleName) => {
      if (userRoles[roleName] === true && allRoles[roleName]) {
        const roleCapabilities = allRoles[roleName].capabilities;
        for (const capName in roleCapabilities) {
          if (roleCapabilities[capName] === true) {
            caps[capName.toLowerCase()] = true;
          }
        }
      } else if (userRoles[roleName] === true && !allRoles[roleName]) {
      }
      return caps;
    }, {} as Record<string, boolean>);

  } else {
    userCapabilities = {}; 
  }

  await cache.set(cacheKey, userCapabilities, 3600 * 1000); 
  return userCapabilities;
}
// --- End Helper ---

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return await Bun.password.verify(password, hashed);
}

export async function signJwt(userId: number): Promise<string> { 
  serverHooks.doAction('svc.jwt.sign:action:before', { userId });

  const capabilities = await getUserCapabilities(userId);
  const scope = Object.entries(capabilities)
    .filter(([, value]) => value === true)
    .map(([key]) => key); 

  const estimatedSize = JSON.stringify({ userId, scope }).length;
  if (estimatedSize > 1500) { 
  }

  const payload = { userId, scope }; 
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '14d' });

  serverHooks.doAction('svc.jwt.sign:action:after', { userId, token, payload });
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
  const token = await signJwt(user.id);
  serverHooks.doAction('svc.user.login:action:after', { user, token });
  return { user, token };
}

export interface JwtPayload {
  userId: number;
  scope?: string[]; 
  iat?: number;
  exp?: number;
}

export function verifyJwt(token: string): JwtPayload { 
  serverHooks.doAction('svc.jwt.verify:action:before', { token });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    serverHooks.doAction('svc.jwt.verify:action:after', { token, decoded });
    return decoded; 
  } catch (error) {
      throw new Error('Invalid token'); 
  }
}

export interface CapabilityCheckArgs {
  capabilities: string[];
}

export async function userCan(userId: number, args: CapabilityCheckArgs, dbClient: DbOrTrx = db): Promise<boolean> {
  await serverHooks.doAction('svc.user.can:action:before', { userId, args });

  const requiredCapabilities = args.capabilities.map(cap => cap.toLowerCase());
  const userCapabilities = await getUserCapabilities(userId, dbClient); 

  const hasAllCaps = requiredCapabilities.every(cap => userCapabilities[cap] === true); 

  const filteredResult = await serverHooks.applyFilters('svc.user.can:filter:result', hasAllCaps, { userId, args: { capabilities: requiredCapabilities }, userCapabilities });
  await serverHooks.doAction('svc.user.can:action:after', { userId, args: { capabilities: requiredCapabilities }, result: filteredResult });
  return filteredResult;
}