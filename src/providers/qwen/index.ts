import { qwenPoller } from '../../config';
import { convertToQwenRequestTo, convertQwenResponseTo, convertQwenStreamResponseTo } from './adapter';
import { ProviderType } from '../../../pkg/converter_wasm';
import { getAccessToken } from './auth';
import { RequestLogger } from '../../utils/logger';

export class QwenProvider {
    model: string;
    constructor(model: string) {
        this.model = model
    }

    async convertRequestTo(body: any, source: any) {
        return convertToQwenRequestTo(body, source);
    }

    getProviderType() {
        return ProviderType.Chat;
    }

    async fetchResponse(_is_streaming: boolean, reqData: any) {
        const qwenConfig = qwenPoller.getNext(this.model);
        const token = await getAccessToken(qwenConfig.auth);
        const endpoint = `https://${qwenConfig.auth.resource_url}/v1/chat/completions`;
        const headers: any = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        return fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(reqData)
        });
    }

    async convertResponseTo(c: any, response: any, target: any) {
        return convertQwenResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: any, target: any, requestLogger?: RequestLogger) {
        return convertQwenStreamResponseTo(stream, response, target, requestLogger);
    }
}
