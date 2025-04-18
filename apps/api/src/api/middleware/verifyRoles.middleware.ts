import { Request, Response, NextFunction } from 'express';
import { verifyJwt, userCan } from '../../core/services/auth.services';
import { wpError } from '../../core/utils/wpError';

export interface AuthRequest extends Request {
  user?: { id: number };
}

export function requireCapabilities(capabilities: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    console.log('authHeader', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(wpError('rest_unauthorized', 'Authentication required', 401));
      return;
    }

    try {
      const token = authHeader.split(' ')[1];
      console.log('token', token);
      const { userId } = verifyJwt(token);
      console.log('userId', userId);
      const hasCapabilities = await userCan(userId, { capabilities });
      console.log('hasCapabilities', hasCapabilities);
      if (!hasCapabilities) {
        res.status(403).json(wpError('rest_forbidden', 'You do not have permission to perform this action', 403));
        return;
      }

      req.user = { id: userId };
      next();
    } catch (e) {
      console.error('Error verifying capabilities:', e);
      res.status(401).json(wpError('rest_invalid_token', 'Invalid or expired token', 401));
      return;
    }
  };
}