export const fetchGeminiCLiStreamResponse = async ({ token, data }) => {
    return fetch("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    })
}

export const fetchGeminiCLiResponse = async ({ token, data }) => {
    return fetch("https://cloudcode-pa.googleapis.com/v1internal:generateContent", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    })
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchWithRetry = async (fetchFn, reqParam, retries = 5) => {
    let attempt = 0;
    let lastErrorResponse;
    while (attempt < retries) {
        try {
            const response = await fetchFn(reqParam);
            if (response.ok) {
                return response;
            }
            await sleep(3000);
            lastErrorResponse = await response.text();
            console.error(`Failed to fetch Gemini CLI response, attempt ${attempt}: ${lastErrorResponse}`);
            attempt++
        } catch (error) {
            attempt++
            console.log(error);
        }
    }
    throw new Error(lastErrorResponse)
}