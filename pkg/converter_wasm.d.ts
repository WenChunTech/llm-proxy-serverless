/* tslint:disable */
/* eslint-disable */
export function openai_stream_response_convert(resp: any, model: string, target: TargetType): any;
export function gemini_request_convert(req: any, target: TargetType): any;
export function gemini_cli_resp_to_gemini_resp(resp: any): any;
export function openai_request_convert(req: any, target: TargetType): any;
export function claude_request_convert(req: any, target: TargetType): any;
export function gemini_req_convert_to_gemini_cli_req(req: any): any;
export function gemini_cli_stream_response_convert(resp: any, model: string, target: TargetType): any;
export enum TargetType {
  OpenAI = 0,
  Gemini = 1,
  GeminiCli = 2,
  Claude = 3,
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly claude_request_convert: (a: any, b: number) => [number, number, number];
  readonly gemini_cli_resp_to_gemini_resp: (a: any) => [number, number, number];
  readonly gemini_cli_stream_response_convert: (a: any, b: number, c: number, d: number) => [number, number, number];
  readonly gemini_req_convert_to_gemini_cli_req: (a: any) => [number, number, number];
  readonly gemini_request_convert: (a: any, b: number) => [number, number, number];
  readonly openai_request_convert: (a: any, b: number) => [number, number, number];
  readonly openai_stream_response_convert: (a: any, b: number, c: number, d: number) => [number, number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
