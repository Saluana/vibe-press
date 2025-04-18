// src/core/services/user.service.ts
import { db, schema } from '../../db';
import { hashPassword } from '../auth.services';
import { eq, or } from 'drizzle-orm';
import { createUserMetaDefaults } from './userMeta.services';
import { serverHooks } from '../../../core/hooks/hookEngine.server';


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
  serverHooks.doAction('user.register:before', { user_login, user_email, display_name });

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

  await createUserMetaDefaults(result[0].ID, {
    nickname: display_name,
  });

  serverHooks.doAction('user.register:after', { user: result[0] });
  return result[0];
}

export async function getUserByLoginOrEmail(identifier: string) {
  serverHooks.doAction('user.get:before', { identifier });
  // Try to find user by login or email
  const result = await db.select().from(schema.wp_users)
    .where(
      or(
        eq(schema.wp_users.user_login, identifier),
        eq(schema.wp_users.user_email, identifier)
      )
    );
  serverHooks.doAction('user.get:after', { user: result[0] });
  return result[0] || null;
}


