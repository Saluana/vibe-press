// packages/utils/restContext.ts

export enum Context {
  view = 'view',
  embed = 'embed',
  edit = 'edit',
}

interface FieldSets<T extends Record<string, any>> {
  view: (keyof T)[];
  embed?: (keyof T)[];
  edit?: (keyof T)[];
}

/** Simple TS‑friendly pick */
function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const res = {} as Pick<T, K>;
  for (const k of keys) {
    if (k in obj) {
      res[k] = obj[k];
    }
  }
  return res;
}

/**
 * Strip/shape an object for the requested REST context.
 */
export function sanitiseForContext<
  T extends Record<string, any>
>(item: T, context: Context, fields: FieldSets<T>): Partial<T> {
  switch (context) {
    case Context.embed:
      return pick(item, fields.embed ?? fields.view);
    case Context.edit:
      return item; // full object
    case Context.view:
    default:
      return pick(item, fields.view);
  }
}
