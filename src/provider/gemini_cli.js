export const fetchGeminiCLiResponse = async (token, data) => fetch("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
})

export const fetchWithRetry = async (fetchFn, reqParam, retries = 5) => {
    let attempt = 0;
    let lastErrorText = '';
    while (attempt < retries) {
        try {
            const response = await fetchFn(reqParam);
            if (response.ok) {
                return response;
            }
            sleep(1000);
            lastErrorText = await response.text();
            attempt++
        } catch (error) {
            attempt++
            console.log(error);
        }
    }
    throw new Error(lastErrorText)
}