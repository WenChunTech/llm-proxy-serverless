import { gemini_cli_resp_to_gemini_resp, new_inner, TargetType, gemini_cli_stream_wrapper_convert } from "../pkg/converter_wasm.js";

const responseConvert = (wrapper, sourceType, targetType) => {
    if (sourceType === TargetType.GeminiCli) {
        return gemini_cli_stream_wrapper_convert(wrapper, targetType);
    }
}

export const StreamEvent = async (stream, response, sourceType, targetType) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let inner = new_inner();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            if (line.startsWith('data:')) {
                const data = line.substring(5).trim();
                if (data) {
                    let wrapper = {
                        chunk: JSON.parse(data),
                        inner: inner,
                    }
                    const streams_wrapper = responseConvert(wrapper, sourceType, targetType);
                    inner = streams_wrapper.inner;
                    let chunks = streams_wrapper.chunks;
                    for (const chunk of chunks) {
                        console.log(chunk);
                        stream.writeSSE({
                            event: chunk.type,
                            data: JSON.stringify(chunk),
                        })
                    }
                }
            }
        }
    }

    if (buffer.startsWith('data:')) {
        const data = buffer.substring(5).trim();
        if (data) {
            let wrapper = {
                chunk: JSON.parse(data),
                inner: inner,
            }
            const streams_wrapper = responseConvert(wrapper, sourceType, targetType);
            inner = streams_wrapper.inner;
            let chunks = streams_wrapper.chunks;
            for (const chunk of chunks) {
                console.log(chunk);
                stream.writeSSE({
                    event: chunk.type,
                    data: JSON.stringify(chunk),
                })
            }
        }
    }
}

export const geminiCliResponseConvert = async (stream, response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            if (line.startsWith('data:')) {
                const data = line.substring(5).trim();
                if (data) {
                    const responseData = gemini_cli_resp_to_gemini_resp(JSON.parse(data));
                    stream.writeSSE({
                        data: JSON.stringify(responseData),
                    })

                }
            }
        }
    }
    if (buffer.startsWith('data:')) {
        const data = buffer.substring(5).trim();
        if (data) {
            const responseData = gemini_cli_resp_to_gemini_resp(JSON.parse(data));
            stream.writeSSE({
                data: JSON.stringify(responseData),
            })
        }
    }
}