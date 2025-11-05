export async function fetchWithRetry(fetchFn: any, options: any, maxRetries = 5, retryDelay = 3000) {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fetchFn(options);
        } catch (error) {
            lastError = error;
            console.error(`[Fetch] Attempt ${i + 1} failed with error: ${error}. Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    throw new Error(`[Fetch] All retries failed. Last error: ${lastError}`);
}
