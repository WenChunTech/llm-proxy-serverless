/* tslint:disable */
/* eslint-disable */
export function geminiStreamWrapperConvertTo(
  resp: any,
  target: TargetType,
): any;
export function geminiCliResponseConvertToGeminiResponse(resp: any): any;
export function geminiCliStreamWrapperConvertTo(
  resp: any,
  target: TargetType,
): any;
export function getDefaultStreamState(): any;
export function geminiRequestConvertTo(req: any, target: TargetType): any;
export function claudeResponseConvertTo(req: any, target: TargetType): any;
export function geminiCliResponseConvertTo(req: any, target: TargetType): any;
export function openaiResponseConvertTo(req: any, target: TargetType): any;
export function geminiRequestConvertToGeminiCliRequest(req: any): any;
export function openaiRequestConvertTo(req: any, target: TargetType): any;
export function openaiStreamWrapperConvertTo(
  resp: any,
  target: TargetType,
): any;
export function geminiResponseConvertTo(req: any, target: TargetType): any;
export function claudeStreamWrapperConvertTo(
  resp: any,
  target: TargetType,
): any;
export function claudeRequestConvertTo(req: any, target: TargetType): any;
export enum TargetType {
  OpenAI = 0,
  Gemini = 1,
  GeminiCli = 2,
  Claude = 3,
}

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly claudeRequestConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly claudeResponseConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly claudeStreamWrapperConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly geminiCliResponseConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly geminiCliResponseConvertToGeminiResponse: (
    a: any,
  ) => [number, number, number];
  readonly geminiCliStreamWrapperConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly geminiRequestConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly geminiRequestConvertToGeminiCliRequest: (
    a: any,
  ) => [number, number, number];
  readonly geminiResponseConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly geminiStreamWrapperConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly getDefaultStreamState: () => [number, number, number];
  readonly openaiRequestConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly openaiResponseConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly openaiStreamWrapperConvertTo: (
    a: any,
    b: number,
  ) => [number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
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
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
