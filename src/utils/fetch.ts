export async function fetchWithRetry(
  fetchFn: (options: RequestInit) => Promise<Response>,
  options: any,
  maxRetries = 5,
  retryDelay = 5000,
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetchFn(options);
      if (resp.ok) {
        return resp;
      }
      console.error(
        `[Fetch] Attempt ${
          i + 1
        } failed with status: ${resp.status}, and response body: ${await resp
          .text()}. Retrying in ${retryDelay}ms...`,
      );
    } catch (error) {
      console.error(
        `[Fetch] Attempt ${
          i + 1
        } failed with error: ${error}. Retrying in ${retryDelay}ms...`,
      );
    }
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  return await fetchFn(options);
}
