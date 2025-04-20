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
        // General
        read: true,
        level_10: true,
  
        // Posts
        edit_posts: true,
        edit_others_posts: true,
        edit_published_posts: true,
        edit_private_posts: true,
        delete_posts: true,
        delete_others_posts: true,
        delete_published_posts: true,
        delete_private_posts: true,
        publish_posts: true,
        read_private_posts: true,
  
        // Pages
        edit_pages: true,
        edit_others_pages: true,
        edit_published_pages: true,
        edit_private_pages: true,
        delete_pages: true,
        delete_others_pages: true,
        delete_published_pages: true,
        delete_private_pages: true,
        publish_pages: true,
        read_private_pages: true,
  
        // Media
        upload_files: true,
  
        // Comments
        moderate_comments: true,
        edit_comment: true,
        delete_comment: true,
        approve_comments: true,
  
        // Taxonomies
        manage_categories: true,
        edit_terms: true,
        delete_terms: true,
        assign_terms: true,
  
        // Themes
        switch_themes: true,
        edit_themes: true,
        install_themes: true,
        update_themes: true,
        delete_themes: true,
  
        // Plugins
        activate_plugins: true,
        edit_plugins: true,
        install_plugins: true,
        update_plugins: true,
        delete_plugins: true,
  
        // Users
        list_users: true,
        create_users: true,
        edit_users: true,
        delete_users: true,
        promote_users: true,
  
        // Options, tools, admin
        manage_options: true,
        edit_dashboard: true,
        import: true,
        export: true,
        unfiltered_html: true,
        edit_files: true,
        edit_css: true,
        customize: true,
        edit_theme_options: true,
  
        // Core updates
        update_core: true,
      },
    },
  
    editor: {
      name: 'Editor',
      capabilities: {
        read: true,
  
        // Posts
        edit_posts: true,
        edit_others_posts: true,
        edit_published_posts: true,
        edit_private_posts: true,
        delete_posts: true,
        delete_others_posts: true,
        delete_published_posts: true,
        delete_private_posts: true,
        publish_posts: true,
        read_private_posts: true,
  
        // Pages
        edit_pages: true,
        edit_others_pages: true,
        edit_published_pages: true,
        edit_private_pages: true,
        delete_pages: true,
        delete_others_pages: true,
        delete_published_pages: true,
        delete_private_pages: true,
        publish_pages: true,
        read_private_pages: true,
  
        // Media
        upload_files: true,
  
        // Comments
        moderate_comments: true,
        edit_comment: true,
        delete_comment: true,
        approve_comments: true,
  
        // Taxonomies
        manage_categories: true,
        edit_terms: true,
        delete_terms: true,
        assign_terms: true,
  
        // Theme options
        edit_theme_options: true,
      },
    },
  
    author: {
      name: 'Author',
      capabilities: {
        read: true,
  
        // Posts (own only)
        edit_posts: true,
        edit_published_posts: true,
        delete_posts: true,
        delete_published_posts: true,
        publish_posts: true,
  
        // Media
        upload_files: true,
  
        // Taxonomies
        assign_terms: true,
      },
    },
  
    contributor: {
      name: 'Contributor',
      capabilities: {
        read: true,
        edit_posts: true,
        delete_posts: true,
  
        // Taxonomies
        assign_terms: true,
      },
    },
  
    subscriber: {
      name: 'Subscriber',
      capabilities: {
        read: true,
      },
    },
  };
  
  
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