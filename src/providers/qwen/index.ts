import { fetchWithRetry } from '../../utils/fetch.js';
import { qwenPoller } from '../../config.js';
import { convertToQwenRequestTo, convertQwenResponseTo, convertQwenStreamResponseTo } from './adapter.js';
import { TargetType } from 'converter-wasm';
import { getAccessToken } from './auth.js';

export class QwenProvider {
    model: string;
    constructor(model: string) {
        this.model = model
    }

    async convertRequestTo(body: any, source: any) {
        return convertToQwenRequestTo(body, source);
    }

    getProviderType() {
        return TargetType.OpenAI;
    }

    async fetchResponse(_is_streaming: boolean, reqData: any) {
        const qwenConfig = qwenPoller.getNext(this.model);
        const token = await getAccessToken(qwenConfig.auth);
        const endpoint = `https://${qwenConfig.auth.resource_url}/v1/chat/completions`;
        const headers: any = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const fetcher = async () => fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(reqData)
        });

        return fetchWithRetry(fetcher, {});
    }

    async convertResponseTo(c: any, response: any, target: any) {
        return convertQwenResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: any, target: any) {
        return convertQwenStreamResponseTo(stream, response, target);
    }
}
