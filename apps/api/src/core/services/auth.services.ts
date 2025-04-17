// src/core/services/auth.service.ts
import jwt from 'jsonwebtoken';
import { getUserByLoginOrEmail } from './user.services';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return await Bun.password.verify(password, hashed);
}

export function signJwt(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '14d' });
}

export async function loginUser(identifier: string, password: string) {
  const user = await getUserByLoginOrEmail(identifier);
  if (!user) {
    throw new Error('User not found');
  }
  const valid = await comparePassword(password, user.user_pass);
  if (!valid) {
    throw new Error('Invalid password');
  }
  const token = signJwt(user.ID);
  return { user, token };
}

export function verifyJwt(token: string): { userId: number } {
  return jwt.verify(token, JWT_SECRET) as { userId: number };
}
