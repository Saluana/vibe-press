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
async function getUserCapabilities(userId: number, dbClient: DbOrTrx = db): Promise<Record<string, boolean>> {
  const cacheKey = `user:${userId}:capabilities`;
  let userCapabilities: Record<string, boolean> | null = await cache.get(cacheKey);

  if (userCapabilities === null) { // Check explicitly for null to differentiate from empty object {}
    const userRolesMetaValue = await getUserMeta(userId, 'wp_capabilities', dbClient);
    if (userRolesMetaValue && typeof userRolesMetaValue === 'object') {
      const userRoles = userRolesMetaValue as Record<string, boolean>;
      const allRoles = await getRoles(dbClient);
      userCapabilities = Object.keys(userRoles).reduce((caps, role) => {
        if (userRoles[role] === true && allRoles[role]) {
          return { ...caps, ...allRoles[role].capabilities };
        }
        return caps;
      }, {} as Record<string, boolean>);
    } else {
      userCapabilities = {}; // Default to empty if no meta or invalid format
    }
    await cache.set(cacheKey, userCapabilities, 3600 * 1000); // Cache for 1 hour
  }
  return userCapabilities;
}
// --- End Helper ---

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return await Bun.password.verify(password, hashed);
}

// Modified signJwt
export async function signJwt(userId: number): Promise<string> { // Make async
  serverHooks.doAction('svc.jwt.sign:action:before', { userId });

  // Fetch capabilities
  const capabilities = await getUserCapabilities(userId);
  // Extract only the capability names where the value is true
  const scope = Object.entries(capabilities)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  // Check size (simple example, might need refinement)
  const estimatedSize = JSON.stringify({ userId, scope }).length;
  if (estimatedSize > 1500) { // Example threshold ~1.5KB
      console.warn(`JWT payload size for user ${userId} might be large (${estimatedSize} bytes). Consider optimizing scope.`);
      // Potentially fall back to only userId or just roles here
  }

  const payload = { userId, scope }; // Include scope
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
  // Await the async signJwt
  const token = await signJwt(user.ID);
  serverHooks.doAction('svc.user.login:action:after', { user, token });
  return { user, token };
}

// Define the expected JWT payload structure
export interface JwtPayload {
  userId: number;
  scope?: string[]; // Optional scope containing capabilities
  iat?: number;
  exp?: number;
}

// Modified verifyJwt
export function verifyJwt(token: string): JwtPayload { // Update return type
  serverHooks.doAction('svc.jwt.verify:action:before', { token });
  // Decode and assert the type
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  serverHooks.doAction('svc.jwt.verify:action:after', { token, decoded });
  return decoded; // Return the full payload
}

export interface CapabilityCheckArgs {
  capabilities: string[];
}

export async function userCan(userId: number, args: CapabilityCheckArgs, dbClient: DbOrTrx = db): Promise<boolean> {
  await serverHooks.doAction('svc.user.can:action:before', { userId, args });

  const { capabilities: requiredCapabilities } = args; // Renamed for clarity
  // Use the helper function which includes caching
  const userCapabilities = await getUserCapabilities(userId, dbClient);

  console.log(`[userCan ${userId}] Determined userCapabilities from cache/DB:`, userCapabilities);
  console.log(`[userCan ${userId}] Required capabilities:`, requiredCapabilities);

  const hasAllCaps = requiredCapabilities.every(cap => userCapabilities[cap] === true); // Ensure capability is explicitly true

  const filteredResult = await serverHooks.applyFilters('svc.user.can:filter:result', hasAllCaps, { userId, args, userCapabilities });
  await serverHooks.doAction('svc.user.can:action:after', { userId, args, result: filteredResult });
  return filteredResult;
}