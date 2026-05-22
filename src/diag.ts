// GON lexer/parser diagnostics
//
// polymeric 2026

export enum DiagSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

export interface Diag {
    severity: DiagSeverity;
    offset: number;
    size: number;
    message: string;
}
