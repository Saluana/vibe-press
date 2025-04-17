// apps/api/src/core/utils/wpError.ts

export function wpError(
    code: string,
    message: string,
    status = 400,
    extra: Record<string, any> = {}
  ) {
    return {
      code,
      message,
      data: {
        status,
        ...extra
      }
    };
  }
  