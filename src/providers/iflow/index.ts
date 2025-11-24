import { fetchWithRetry } from '../../utils/fetch.ts';
import { iflowPoller } from '../../config.ts';
import { convertToIFlowRequestTo, convertIFlowResponseTo, convertIFlowStreamResponseTo } from './adapter.ts';
import { TargetType } from '../../../pkg/converter_wasm.js';
import { getAccessToken } from './auth.ts';



export class IflowProvider {
    model: string;
    constructor(model: string) {
        this.model = model
    }

    async convertRequestTo(body: any, source: any) {
        return convertToIFlowRequestTo(body, source);
    }

    getProviderType() {
        return TargetType.OpenAI;
    }

    async fetchResponse(_is_streaming: boolean, reqData: any) {
        const iflowConfig = iflowPoller.getNext(this.model);
        const token = await getAccessToken(iflowConfig.auth);
        const endpoint = 'https://apis.iflow.cn/v1/chat/completions';
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
        return convertIFlowResponseTo(c, response, target);
    }

    async convertStreamResponseTo(stream: any, response: any, target: any) {
        return convertIFlowStreamResponseTo(stream, response, target);
    }
}
