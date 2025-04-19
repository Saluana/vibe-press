import { Request, Response, NextFunction } from 'express';
import { verifyJwt, userCan } from '@vp/core/services/auth.services';
import { wpError } from '@vp/core/utils/wpError';
import { getUserRole } from '../../core/services/user/userMeta.services';
import { getUserCapabilities } from '@vp/core/roles/roles';

export interface AuthRequest extends Request {
  user?: { id: number, role?: string, capabilities?: string[] };
}

// Define the configuration options interface
interface RequireCapabilitiesOptions {
  capabilities: string[];
  allowOwner?: boolean; // Default: false
  ownerIdParam?: string; // e.g., 'id', 'userId'
}

/**
 * Middleware to verify user capabilities or resource ownership.
 * Access is granted if:
 * 1. The user has ALL the specified capabilities.
 * 2. OR, if allowOwner is true, the user's ID matches the ID specified by ownerIdParam in the request params.
 *
 * @param config - Either an array of required capabilities (string[])
 *                 or a configuration object (RequireCapabilitiesOptions).
 */
export function requireCapabilities(config: string[] | RequireCapabilitiesOptions) {
  // Normalize config to always use the options object structure
  const options: RequireCapabilitiesOptions = Array.isArray(config)
    ? { capabilities: config, allowOwner: false } // If array, default allowOwner to false
    : { allowOwner: false, ...config }; // If object, ensure allowOwner defaults to false if not provided

  const { capabilities, allowOwner, ownerIdParam } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(wpError('rest_unauthorized', 'Authentication required', 401));
      return;
    }

    let userId: number;
    try {
      const token = authHeader.split(' ')[1];
      const decoded = verifyJwt(token);
      userId = decoded.userId;

      // Attach userId early for potential ownership check
      req.user = { id: userId };

    } catch (e) {
      console.error('Error verifying JWT:', e);
      res.status(401).json(wpError('rest_invalid_token', 'Invalid or expired token', 401));
      return;
    }

    // --- Authorization Logic ---

    // 1. Check required capabilities
    const hasCapabilities = await userCan(userId, { capabilities });

    if (hasCapabilities) {
      // User has permissions, populate full user context and proceed
      const role = await getUserRole(userId);
      const userCaps = await getUserCapabilities(role || 'subscriber');
      req.user = { id: userId, role: role || 'subscriber', capabilities: userCaps };
      return next();
    }

    // 2. If capability check failed, check ownership (if configured)
    let isOwner = false;
    if (allowOwner && ownerIdParam && req.params[ownerIdParam]) {
      const resourceOwnerIdStr = req.params[ownerIdParam];
      const resourceOwnerId = parseInt(resourceOwnerIdStr, 10);
      if (!isNaN(resourceOwnerId) && userId === resourceOwnerId) {
        isOwner = true;
        // User is the owner, populate full user context and proceed
        const role = await getUserRole(userId);
        const userCaps = await getUserCapabilities(role || 'subscriber');
        req.user = { id: userId, role: role || 'subscriber', capabilities: userCaps };
        return next();
      }
    }

    // 3. If neither capability nor ownership check passed, deny access
    console.warn(`Access denied for user ${userId} to route requiring capabilities [${capabilities.join(', ')}]` + (allowOwner ? ` or ownership via param '${ownerIdParam}'` : ''));
    res.status(403).json(wpError('rest_forbidden', 'You do not have permission to perform this action', 403));
    return;
  };
}