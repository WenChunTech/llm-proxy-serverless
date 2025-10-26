export async function fetchQwenResponse({ apiKey, data }) {
    const endpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable'
    };

    return fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });
}