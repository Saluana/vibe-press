import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyJwt, userCan, JwtPayload } from '@vp/core/services/auth.services';
import { wpError } from '@vp/core/utils/wpError';
import { getUserRole } from '../../core/services/user/userMeta.services';
import { getUserCapabilities } from '@vp/core/roles/roles';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role?: string;
    capabilities?: string[];
  };
}

interface RequireCapabilitiesOptions {
  capabilities: string[];
  allowOwner?: boolean;
  ownerIdParam?: string;
}

const RequireCapabilitiesOptionsSchema = z.object({
  capabilities: z.array(z.string()).min(0),
  allowOwner: z.boolean().optional().default(false),
  ownerIdParam: z.string().optional(),
}).refine(data => !data.allowOwner || (data.allowOwner && typeof data.ownerIdParam === 'string' && data.ownerIdParam.length > 0), {
  message: "ownerIdParam is required when allowOwner is true",
  path: ["ownerIdParam"],
});

const CapabilitiesArraySchema = z.array(z.string()).min(0);

const RequireCapabilitiesConfigSchema = z.union([
  CapabilitiesArraySchema,
  RequireCapabilitiesOptionsSchema
]);

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
      capabilities: Array.isArray(decoded.scope) ? decoded.scope : []
    };
    next();
  } catch (e) {
    console.error('Error verifying JWT:', e);
    res.status(401).json(wpError('rest_invalid_token', 'Invalid or expired token.', 401));
    return;
  }
}

export function requireCapabilities(config: string[] | RequireCapabilitiesOptions) {
  const parseResult = RequireCapabilitiesConfigSchema.safeParse(config);
  if (!parseResult.success) {
    console.error("Invalid requireCapabilities configuration:", parseResult.error.flatten());
    throw new Error(`Invalid requireCapabilities configuration: ${parseResult.error.message}`);
  }

  const options: RequireCapabilitiesOptions = Array.isArray(parseResult.data)
    ? { capabilities: parseResult.data, allowOwner: false }
    : RequireCapabilitiesOptionsSchema.parse(parseResult.data);

  const { capabilities: requiredCapabilities, allowOwner, ownerIdParam } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      console.error('requireCapabilities called without prior requireAuth or req.user not set properly.');
      res.status(500).json(wpError('internal_server_error', 'Authentication context missing.', 500));
      return;
    }

    const userId = req.user.id;
    const jwtCapabilities = req.user.capabilities || [];

    let hasCapabilitiesInJwt = false;
    if (jwtCapabilities.length > 0 && requiredCapabilities.length > 0) {
      hasCapabilitiesInJwt = requiredCapabilities.every(cap => jwtCapabilities.includes(cap));
    } else if (requiredCapabilities.length === 0) {
      hasCapabilitiesInJwt = true;
    }

    if (hasCapabilitiesInJwt) {
      const role = await getUserRole(userId);
      req.user.role = role || 'subscriber';
      return next();
    }

    console.log(`[requireCapabilities] JWT scope check failed or insufficient for user ${userId}. Falling back to userCan check.`);
    const hasCapabilitiesViaUserCan = await userCan(userId, { capabilities: requiredCapabilities });

    if (hasCapabilitiesViaUserCan) {
      const role = await getUserRole(userId);
      req.user.role = role || 'subscriber';
      return next();
    }

    let isOwner = false;
    if (allowOwner && ownerIdParam && req.params[ownerIdParam]) {
      const resourceOwnerIdStr = req.params[ownerIdParam];
      if (String(userId) === String(resourceOwnerIdStr)) {
        isOwner = true;
      }
    }

    if (isOwner) {
      const role = await getUserRole(userId);
      req.user.role = role || 'subscriber';
      return next();
    }

    console.warn(`Access denied for user ${userId} to route requiring capabilities [${requiredCapabilities.join(', ')}]` + (allowOwner ? ` or ownership via param '${ownerIdParam}'` : ''));
    res.status(403).json(wpError('rest_forbidden', 'You do not have permission to perform this action.', 403));
    return;
  };
}