// apps/api/src/core/utils/wpTime.ts

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const WP_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * Convert a PostgreSQL Date or ISO string to WordPress datetime string
 * Example: "2024-06-21T18:22:00.000Z" -> "2024-06-21 18:22:00"
 */
export function toWpDatetime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const utc = toZonedTime(date, 'UTC');
  return format(utc, WP_TIME_FORMAT);
}

/**
 * Convert a WordPress datetime string into a JS Date object (assumes UTC)
 * Example: "2024-06-21 18:22:00" -> Date object in UTC
 */
export function fromWpDatetime(wpDateString: string): Date {
  return new Date(wpDateString.replace(' ', 'T') + 'Z');
}
