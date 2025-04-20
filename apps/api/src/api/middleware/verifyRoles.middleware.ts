// src/core/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyJwt, userCan, JwtPayload } from '@vp/core/services/auth.services';
import { wpError } from '@vp/core/utils/wpError';
import { getUserRole } from '@vp/core/services/user/userMeta.services';
import { getUserCapabilities } from '@vp/core/roles/roles';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role?: string;
    capabilities?: string[];
  };
}

// 1) OPTIONAL AUTH: attach user if token valid, but never 401
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded: JwtPayload = verifyJwt(token);
      req.user = {
        id: decoded.userId,
        capabilities: Array.isArray(decoded.scope)
          ? decoded.scope.map(c => c.toLowerCase())
          : []
      };
    } catch (e) {
      console.error('JWT verify failed:', e);
    }
  }
  return next();
}

// 2) REQUIRE AUTH: must have a valid token
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(wpError('rest_unauthorized', 'Authentication required.', 401));
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded: JwtPayload = verifyJwt(token);
    req.user = {
      id: decoded.userId,
      capabilities: Array.isArray(decoded.scope)
        ? decoded.scope.map(c => c.toLowerCase())
        : []
    };
    return next();
  } catch (e) {
    console.error('JWT verify failed:', e);
    res.status(401).json(wpError('rest_invalid_token', 'Invalid or expired token.', 401));
    return;
  }
}

// 3) REQUIRE CAPABILITIES: checks JWT scope first, then userCan, then optional ownership
interface RequireCapabilitiesOptions {
  capabilities: string[];
  allowOwner?: boolean;
  ownerIdParam?: string;
}

export function requireCapabilities(config: string[] | RequireCapabilitiesOptions) {
  // [runtime zod validation removed for brevity]
  const options = Array.isArray(config)
    ? { capabilities: config, allowOwner: false }
    : config;

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      res.status(500).json(wpError('internal_server_error', 'Authentication context missing.', 500));
      return;
    }
    const userId = req.user.id;
    const required = options.capabilities.map(c => c.toLowerCase());
    const jwtCaps = (req.user.capabilities || []).map(c => c.toLowerCase());

    // a) JWT scope check
    const hasInJwt = required.every(c => jwtCaps.includes(c));
    if (hasInJwt) {
      req.user.role = (await getUserRole(userId)) || 'subscriber';
      return next();
    }

    // b) Fallback to userCan()
    const viaDb = await userCan(userId, { capabilities: options.capabilities });
    if (viaDb) {
      req.user.role = (await getUserRole(userId)) || 'subscriber';
      return next();
    }

    // c) Ownership check
    if (
      options.allowOwner &&
      options.ownerIdParam &&
      req.params[options.ownerIdParam] &&
      String(userId) === String(req.params[options.ownerIdParam])
    ) {
      req.user.role = (await getUserRole(userId)) || 'subscriber';
      return next();
    }

    // Deny
    res.status(403).json(
      wpError('rest_forbidden', 'You do not have permission to perform this action.', 403)
    );
  };
}