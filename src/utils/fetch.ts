export async function fetchWithRetry(
  fetchFn: (options: any) => Promise<Response>,
  options: any,
  maxRetries = 5,
  retryDelay = 5000,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchFn(options);
      if (response.ok) {
        return response;
      }
      const responseText = await response.clone().text().catch(() => "");
      console.error(
        `[Fetch] Attempt ${attempt + 1} failed with status: ${response.status}, response body: ${responseText}. Retrying in ${retryDelay}ms...`,
      );
    } catch (error) {
      console.error(
        `[Fetch] Attempt ${attempt + 1} failed with error: ${error}. Retrying in ${retryDelay}ms...`,
      );
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return fetchFn(options);
}
