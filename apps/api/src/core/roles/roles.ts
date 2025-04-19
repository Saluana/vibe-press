import { db, schema } from "@vp/core/db";
import { eq } from "drizzle-orm";
import { cache } from '@vp/core/utils/cacheManager';

export interface Role {
    name: string;
    capabilities: Record<string, boolean>;
  }
  
  export interface Roles {
    [key: string]: Role;
  }

  // Correctly define Db/Transaction types
type DbClient = typeof db;
type TransactionClient = Parameters<DbClient['transaction']>[0] extends (client: infer C) => any ? C : never;
type DbOrTrx = DbClient | TransactionClient;

  
  // Default WordPress roles and capabilities
  export const defaultRoles: Roles = {
    administrator: {
      name: 'Administrator',
      capabilities: {
        manage_options: true,
        edit_posts: true,
        edit_others_posts: true,
        publish_posts: true,
        delete_posts: true,
        delete_others_posts: true,
        edit_pages: true,
        edit_others_pages: true,
        publish_pages: true,
        delete_pages: true,
        manage_categories: true,
        moderate_comments: true,
        activate_plugins: true,
        edit_users: true,
        list_users: true,
        read: true,
        // Add more as needed
      },
    },
    editor: {
      name: 'Editor',
      capabilities: {
        edit_posts: true,
        edit_others_posts: true,
        publish_posts: true,
        delete_posts: true,
        delete_others_posts: true,
        edit_pages: true,
        edit_others_pages: true,
        publish_pages: true,
        delete_pages: true,
        manage_categories: true,
        moderate_comments: true,
        read: true,
      },
    },
    author: {
      name: 'Author',
      capabilities: {
        edit_posts: true,
        publish_posts: true,
        delete_posts: true,
        read: true,
      },
    },
    contributor: {
      name: 'Contributor',
      capabilities: {
        edit_posts: true,
        read: true,
      },
    },
    subscriber: {
      name: 'Subscriber',
      capabilities: {
        read: true,
      },
    },
  } as const;
  
  // Initialize roles (load from DB or use defaults)
  export async function initializeRoles(dbClient: DbOrTrx = db) {
    // Optionally store in wp_options table as wp_user_roles
    const existingRolesArr = await dbClient
    .select()
    .from(schema.wp_options)
    .where(eq(schema.wp_options.option_name, 'wp_user_roles'));
  
  const existingRoles = existingRolesArr[0];
    if (!existingRoles) {
      await dbClient.insert(schema.wp_options).values({
        option_name: 'wp_user_roles',
        option_value: JSON.stringify(defaultRoles),
      });
    }
  }


export async function getRoles(dbClient: DbOrTrx = db): Promise<Roles> {
  const cached = await cache.get('wp_user_roles');
  if (cached) return cached as Roles;

  const roles = await dbClient.select().from(schema.wp_options).where(eq(schema.wp_options.option_name, 'wp_user_roles'));
  const roleData = roles[0] ? JSON.parse(roles[0].option_value) : defaultRoles;
  await cache.set('wp_user_roles', roleData, 3600 * 1000);
  return roleData;
}

/**
 * Gets an array of capabilities associated with a specific role name,
 * using the currently active roles (from DB/cache or defaults).
 *
 * @param roleName The name of the role (e.g., 'subscriber', 'editor').
 * @param dbClient Optional database client or transaction.
 * @returns A promise that resolves to an array of strings representing the
 *          capabilities for the role, or an empty array if the role is not found
 *          or has no capabilities.
 */
export async function getUserCapabilities(roleName: string, dbClient: DbOrTrx = db): Promise<string[]> {
  const activeRoles = await getRoles(dbClient); // Use the function that gets current roles
  const roleDefinition = activeRoles[roleName];

  if (!roleDefinition || !roleDefinition.capabilities) {
    // Role not found in active roles or has no capabilities defined
    console.warn(`Role '${roleName}' not found or has no capabilities defined.`);
    return [];
  }

  // Filter the keys of the capabilities object to include only those set to true
  const capabilities = Object.keys(roleDefinition.capabilities).filter(
    (capability) => roleDefinition.capabilities[capability as keyof typeof roleDefinition.capabilities] === true
  );

  return capabilities;
}