// src/core/services/auth.service.ts
import jwt from 'jsonwebtoken';
import { getUserByLoginOrEmail } from './user/user.services';
import { serverHooks } from '../../core/hooks/hookEngine.server';

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
