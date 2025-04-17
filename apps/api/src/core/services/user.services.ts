// src/core/services/user.service.ts
import { db, schema } from '../db';
import { hashPassword } from './auth.services';
import { eq, or } from 'drizzle-orm';


export async function createUser({
  user_login,
  user_email,
  user_pass,
  display_name,
}: {
  user_login: string;
  user_email: string;
  user_pass: string;
  display_name: string;
}) {
  const hashed = await hashPassword(user_pass);

  const result = await db.insert(schema.wp_users).values({
    user_login,
    user_email,
    user_pass: hashed,
    display_name,
    user_nicename: user_login.toLowerCase(),
    user_registered: new Date().toISOString(),
    user_url: '',
    user_activation_key: '',
    user_status: 0,
  }).returning();

  return result[0];
}

export async function getUserByLoginOrEmail(identifier: string) {
  // Try to find user by login or email
  const result = await db.select().from(schema.wp_users)
    .where(
      or(
        eq(schema.wp_users.user_login, identifier),
        eq(schema.wp_users.user_email, identifier)
      )
    );
  return result[0] || null;
}


