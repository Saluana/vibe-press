// apps/api/src/core/utils/wpError.ts

import { ZodError } from 'zod';

interface WpRestError {
    code: string;
    message: string;
    data: {
        status: number;
        params?: { [key: string]: string };
        [key: string]: any; // Allow other data properties
    };
}

interface FormattedZodError {
    status: number;
    body: WpRestError;
}

/**
 * Formats a ZodError into the WordPress REST API error structure for invalid parameters.
 * @param error The ZodError instance.
 * @returns An object containing the HTTP status code and the formatted error body.
 */
export function formatZodErrorForWpRest(error: ZodError): FormattedZodError {
    const params: { [key: string]: string } = {};
    let message = 'Invalid parameter(s): ';
    const invalidParams: string[] = [];

    error.errors.forEach((validationError) => {
        // Use path items to construct the parameter name
        const paramName = validationError.path.join('.');
        // Add the specific message for this parameter
        params[paramName] = validationError.message;
        // Keep track of unique invalid parameter names for the main message
        if (!invalidParams.includes(paramName)) {
            invalidParams.push(paramName);
        }
    });

    // Append the list of invalid parameters to the main message
    message += invalidParams.join(', ');

    const wpError: WpRestError = {
        code: 'rest_invalid_param',
        message: message,
        data: {
            status: 400,
            params: params,
        },
    };

    return {
        status: 400,
        body: wpError,
    };
}


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