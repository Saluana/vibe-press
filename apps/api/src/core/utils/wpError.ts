// apps/api/src/core/utils/wpError.ts

/**
 * Returns a WordPress REST API compatible error object.
 * If extra.details.fieldErrors is present, maps to data.params and updates message accordingly.
 */
export function wpError(
  code: string,
  message: string,
  status = 400,
  extra: Record<string, any> = {}
) {
  // WP REST API expects data.params for field errors
  let params: Record<string, string> | undefined = undefined;
  let newMessage = message;

  if (extra.details && extra.details.fieldErrors) {
    params = {};
    for (const [field, errors] of Object.entries(extra.details.fieldErrors)) {
      if (Array.isArray(errors) && errors.length > 0) {
        params[field] = errors.join(' ');
      }
    }
    // WP typically uses: "Invalid parameter(s): field1, field2"
    const fields = Object.keys(params);
    if (fields.length > 0) {
      newMessage = `Invalid parameter(s): ${fields.join(', ')}`;
    }
  }

  const data: Record<string, any> = { status };
  if (params) data.params = params;

  return {
    code,
    message: newMessage,
    data,
  };
}