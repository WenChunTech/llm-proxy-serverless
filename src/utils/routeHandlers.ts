import { Context } from 'hono';
import { streamSSE } from "hono/streaming";
import { TargetType } from 'converter-wasm';
import { getProvider } from '../providers/factory.ts';

function proxyResponse(response: Response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.delete('content-encoding');
  newHeaders.delete('content-length');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function handleModelRequest(
  c: Context,
  targetType: TargetType
) {
  let body = await c.req.json();
  let is_streaming = body.stream;
  let model = body.model;
  if (targetType === TargetType.Gemini) {
    model = c.req.param("modelName").split(":")[0];
    is_streaming = c.req.param("modelName").split(":")[1] === "streamGenerateContent";
    body.model = model;
  }
  const provider = getProvider(model);
  const req: any = await provider.convertRequestTo(body, targetType);
  if (targetType == TargetType.Gemini) {
    req.stream = is_streaming;
  }

  const resp = await provider.fetchResponse(is_streaming, req);
  if (targetType == provider.getProviderType()) {
    return proxyResponse(resp);
  }
  if (is_streaming) {
    return streamSSE(c, async (stream) => {
      return provider.convertStreamResponseTo(stream, resp, targetType);
    });
  }
  return provider.convertResponseTo(c, resp, targetType);
}