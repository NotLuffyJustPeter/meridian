export async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload =
      (await response.json()) as {
        message?: unknown;
      };

    if (Array.isArray(payload.message)) {
      const messages =
        payload.message.filter(
          (message): message is string =>
            typeof message === 'string',
        );

      if (messages.length > 0) {
        return messages.join(' ');
      }
    }

    if (
      typeof payload.message ===
      'string'
    ) {
      return payload.message;
    }

    return fallback;
  } catch {
    return fallback;
  }
}