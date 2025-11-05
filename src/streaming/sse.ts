import { gemini_cli_resp_to_gemini_resp, default_stream_state, TargetType, gemini_cli_stream_wrapper_convert, openai_stream_wrapper_convert, claude_stream_wrapper_convert } from "../../pkg/converter_wasm.js";

const responseConvert = (wrapper: any, sourceType: TargetType, targetType: TargetType) => {
    if (sourceType === TargetType.GeminiCli) {
        return gemini_cli_stream_wrapper_convert(wrapper, targetType);
    } else if (sourceType === TargetType.OpenAI) {
        return openai_stream_wrapper_convert(wrapper, targetType);
    } else if (sourceType === TargetType.Claude) {
        return claude_stream_wrapper_convert(wrapper, targetType);
    }
}

export const StreamEvent = async (stream: any, response: Response, sourceType: TargetType, targetType: TargetType) => {
    if (!response.body) {
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let state = default_stream_state();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        const lastLine = lines.pop();
        if (lastLine !== undefined) {
            buffer = lastLine;
        }
        for (const line of lines) {
            if (line.startsWith('data:')) {
                const data = line.substring(5).trim();
                if (data) {
                    let wrapper = {
                        chunk: JSON.parse(data),
                        state: state,
                    }
                    const streams_wrapper = responseConvert(wrapper, sourceType, targetType);
                    state = streams_wrapper.state;
                    let chunks = streams_wrapper.chunks;
                    for (const chunk of chunks) {
                        // console.log(JSON.stringify(chunk));
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
                inner: state,
            }
            const streams_wrapper = responseConvert(wrapper, sourceType, targetType);
            state = streams_wrapper.inner;
            let chunks = streams_wrapper.chunks;
            for (const chunk of chunks) {
                // console.log(JSON.stringify(chunk));
                stream.writeSSE({
                    event: chunk.type,
                    data: JSON.stringify(chunk),
                })
            }
        }
    }
}

export const geminiCliResponseConvert = async (stream: any, response: Response) => {
    if (!response.body) {
        return;
    }
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
        const lastLine = lines.pop();
        if (lastLine !== undefined) {
            buffer = lastLine;
        }
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