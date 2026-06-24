/* tslint:disable */
/* eslint-disable */

export enum ProviderType {
    Chat = 0,
    Responses = 1,
    GeminiCli = 2,
    Gemini = 3,
    Claude = 4,
}

export type TargetType = ProviderType;

export const TargetType: {
    readonly OpenAI: ProviderType.Chat;
    readonly Chat: ProviderType.Chat;
    readonly OpenAIChat: ProviderType.Chat;
    readonly OpenAIResponses: ProviderType.Responses;
    readonly Responses: ProviderType.Responses;
    readonly GeminiCli: ProviderType.GeminiCli;
    readonly Gemini: ProviderType.Gemini;
    readonly Claude: ProviderType.Claude;
};

export function claudeRequestConvertTo(req: any, target: ProviderType): any;

export function claudeResponseConvertTo(req: any, target: ProviderType): any;

export function claudeStreamWrapperConvertTo(resp: any, target: ProviderType): any;

export function geminiCliResponseConvertTo(req: any, target: ProviderType): any;

export function geminiCliResponseConvertToGeminiResponse(resp: any): any;

export function geminiCliStreamWrapperConvertTo(resp: any, target: ProviderType): any;

export function geminiRequestConvertTo(req: any, target: ProviderType): any;

export function geminiRequestConvertToGeminiCliRequest(req: any): any;

export function geminiResponseConvertTo(req: any, target: ProviderType): any;

export function geminiStreamWrapperConvertTo(resp: any, target: ProviderType): any;

export function newStreamState(source: ProviderType, target: ProviderType): any;

export function openAIResponsesRequestConvertTo(req: any, target: ProviderType): any;

export function openAIResponsesResponseConvertTo(resp: any, target: ProviderType): any;

export function openAIResponsesStreamWrapperConvertTo(resp: any, target: ProviderType): any;

export function openaiChatRequestConvertTo(req: any, target: ProviderType): any;

export function openaiChatResponseConvertTo(req: any, target: ProviderType): any;

export function openaiChatStreamWrapperConvertTo(resp: any, target: ProviderType): any;

export function openaiRequestConvertTo(req: any, target: ProviderType): any;

export function openaiResponseConvertTo(resp: any, target: ProviderType): any;

export function openaiStreamWrapperConvertTo(resp: any, target: ProviderType): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly claudeRequestConvertTo: (a: any, b: number) => [number, number, number];
    readonly claudeResponseConvertTo: (a: any, b: number) => [number, number, number];
    readonly claudeStreamWrapperConvertTo: (a: any, b: number) => [number, number, number];
    readonly geminiCliResponseConvertTo: (a: any, b: number) => [number, number, number];
    readonly geminiCliResponseConvertToGeminiResponse: (a: any) => [number, number, number];
    readonly geminiCliStreamWrapperConvertTo: (a: any, b: number) => [number, number, number];
    readonly geminiRequestConvertTo: (a: any, b: number) => [number, number, number];
    readonly geminiRequestConvertToGeminiCliRequest: (a: any) => [number, number, number];
    readonly geminiResponseConvertTo: (a: any, b: number) => [number, number, number];
    readonly geminiStreamWrapperConvertTo: (a: any, b: number) => [number, number, number];
    readonly newStreamState: (a: number, b: number) => [number, number, number];
    readonly openAIResponsesRequestConvertTo: (a: any, b: number) => [number, number, number];
    readonly openAIResponsesResponseConvertTo: (a: any, b: number) => [number, number, number];
    readonly openAIResponsesStreamWrapperConvertTo: (a: any, b: number) => [number, number, number];
    readonly openaiChatRequestConvertTo: (a: any, b: number) => [number, number, number];
    readonly openaiChatResponseConvertTo: (a: any, b: number) => [number, number, number];
    readonly openaiChatStreamWrapperConvertTo: (a: any, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
