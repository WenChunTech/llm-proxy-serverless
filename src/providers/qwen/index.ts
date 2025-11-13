import { fetchWithRetry } from '../../utils/fetch.ts';
import { qwenPoller } from '../../config.ts';
import { TargetType } from '../../../pkg/converter_wasm.js';
import { convertToQwenRequestTo, convertQwenResponseTo, convertQwenStreamResponseTo } from './adapter.ts';
import { getAccessToken } from './auth.ts';

export class QwenProvider {
    constructor() { }


    async convertRequestTo(body: any, source: any) {
        return convertToQwenRequestTo(body, source);
    }

    getProviderType() {
        return TargetType.OpenAI;
    }

    async fetchResponse(is_streaming: boolean, reqData: any) {
        const qwenConfig = qwenPoller.getNext();
        const token = await getAccessToken(qwenConfig.auth);
        const endpoint = `https://${qwenConfig.auth.resource_url}/v1/chat/completions`;
        const headers: any = {
            'Authorization': `Bearer ${qwenConfig.auth.access_token}`,
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
