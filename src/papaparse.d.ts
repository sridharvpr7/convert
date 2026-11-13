declare module 'papaparse' {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseResult<T = any> {
    data: T[];
    errors: ParseError[];
    meta: {
      delimiter: string;
      linebreak: string;
      aborted: boolean;
      truncated: boolean;
      cursor: number;
      fields?: string[];
    };
  }

  export interface ParseConfig {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    dynamicTyping?: boolean | Record<string, boolean>;
    preview?: number;
    encoding?: string;
    step?: (results: ParseResult, parser: any) => void;
    complete?: (results: ParseResult) => void;
    error?: (error: ParseError, file?: any) => void;
    skipEmptyLines?: boolean | 'greedy';
    comments?: boolean | string;
    fastMode?: boolean;
    transform?: (value: string, field: string | number) => any;
  }

  export interface UnparseConfig {
    quotes?: boolean | boolean[] | ((value: any) => boolean);
    quoteChar?: string;
    escapeChar?: string;
    delimiter?: string;
    header?: boolean;
    newline?: string;
    skipEmptyLines?: boolean | 'greedy';
    columns?: string[];
  }

  export function parse<T = any>(input: string | any, config?: ParseConfig): ParseResult<T>;
  export function unparse(data: any[] | { fields: string[]; data: any[] }, config?: UnparseConfig): string;

  const papa: {
    parse: typeof parse;
    unparse: typeof unparse;
  };

  export default papa;
}
