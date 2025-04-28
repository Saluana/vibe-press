import { schema } from "../../db";

export const basicUserColumns = {                
                id: schema.wp_users.ID,
                user_login: schema.wp_users.user_login,
                user_nicename: schema.wp_users.user_nicename,
                user_email: schema.wp_users.user_email,
                user_url: schema.wp_users.user_url,
                user_registered: schema.wp_users.user_registered,
                user_status: schema.wp_users.user_status,
                display_name: schema.wp_users.display_name
            } as const;

export type UserBasicInfo = { [K in keyof typeof basicUserColumns]: typeof basicUserColumns[K] };