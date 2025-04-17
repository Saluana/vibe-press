import { db, schema } from "../../db";

export async function createUserMetaDefaults(userId: number, overrides: {
  nickname?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  locale?: string;
  role?: string;
}) {
  const role = overrides.role || 'subscriber';

  const metaValues = [
    {
      meta_key: 'wp_capabilities',
      meta_value: { [role]: true }, // JSONB
    },
    {
      meta_key: 'wp_user_level',
      meta_value: 0,
    },
    {
      meta_key: 'nickname',
      meta_value: overrides.nickname ?? '',
    },
    {
      meta_key: 'first_name',
      meta_value: overrides.first_name ?? '',
    },
    {
      meta_key: 'last_name',
      meta_value: overrides.last_name ?? '',
    },
    {
      meta_key: 'description',
      meta_value: overrides.description ?? '',
    },
    {
      meta_key: 'locale',
      meta_value: overrides.locale ?? 'en_US',
    },
  ];

  await db.insert(schema.wp_usermeta).values(
    metaValues.map(meta => ({
      user_id: userId,
      meta_key: meta.meta_key,
      meta_value: meta.meta_value,
    }))
  );
}
