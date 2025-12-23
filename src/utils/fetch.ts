export async function fetchWithRetry(
  fetchFn: any,
  options: any,
  maxRetries = 5,
  retryDelay = 3000,
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn(options);
    } catch (error) {
      console.error(
        `[Fetch] Attempt ${
          i + 1
        } failed with error: ${error}. Retrying in ${retryDelay}ms...`,
      );
      if (i === maxRetries - 1) {
        return await fetchFn(options);
      }
    }
  }
}
