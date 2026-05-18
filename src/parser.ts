// GON parser
//
// polymeric 2026

import { Token, TokenKind } from './lexer';

export type CstNode =
    | { kind: "pp_include", word: Token, path: Token | null }
    | { kind: "pp_define", word: Token, name: Token | null, params: Token[], body: CstNode[], end_word: Token | null }
    | { kind: "pp_macro", name: Token, args: Token | null }
    | { kind: "key_value", key: Token, value: CstNode }
    | { kind: "quoted", token: Token }
    // unquoted, bool, null, and numbers are derived from lexer Unquoted tokens depending on context
    | { kind: "unquoted", token: Token }
    | { kind: "bool", token: Token }
    | { kind: "null", token: Token }
    | { kind: "number", token: Token }
    | { kind: "array", left: Token, elements: CstNode[], right: Token | null }
    | { kind: "object", left: Token, elements: CstNode[], right: Token | null }
    | { kind: "meta_error", token: Token, error_message: string }
;

export type CstNodeDocument = Extract<CstNode, { kind: "pp_include" | "pp_define" | "pp_macro" | "key_value" }>;
export type CstNodeValue = Extract<CstNode, { kind: "pp_include" | "pp_macro" | "quoted" | "unquoted" | "bool" | "null" | "number" | "array" | "object" | "meta_error" }>;

export function parse(tokens: Token[], text: string): CstNode[] {
    let nodes: CstNode[] = [];
    let i = 0;

    function peek(): Token {
        return tokens[i];
    }
    function consume(): Token {
        let result = tokens[i];
        i++;
        return result;
    }
    function at(...kinds: TokenKind[]): boolean {
        return kinds.includes(tokens[i].kind);
    }
    function eat(kind: TokenKind): Token | null {
        return at(kind) ? consume() : null;
    }
    function skip_ignored(): void {
        while(at(
            TokenKind.PreprocDoubleSlashComment, TokenKind.PreprocSlashStarComment,
            TokenKind.GonHashComment,
            TokenKind.LitEqual, TokenKind.LitComma, TokenKind.LitColon,
        )) {
            consume();
        }
    }

    function parse_pp_include(): Extract<CstNode, { kind: "pp_include" }> {
        const word = consume(); // PreprocLitWordInclude
        skip_ignored();
        const path = at(TokenKind.Quoted, TokenKind.Unquoted) ? consume() : null;
        return { kind: "pp_include", word, path };
    }

    function parse_pp_macro(): Extract<CstNode, { kind: "pp_macro" }> {
        const name = consume(); // PreprocWord
        const args = eat(TokenKind.MetaRestOfLine);
        return { kind: "pp_macro", name, args };
    }

    function parse_value(): CstNodeValue {
        skip_ignored();
        switch(peek().kind) {
            case TokenKind.Quoted: return { kind: "quoted", token: consume() };
            case TokenKind.MetaUnterminatedQuoted: return { kind: "meta_error", token: consume(), error_message: "Unterminated string" };
            case TokenKind.Unquoted: {
                const token = consume();
                const slice = text.slice(token.offset, token.offset + token.size);
                if (slice == 'true' || slice == 'false') {
                    return { kind: "bool", token };
                }
                if (slice === 'null') {
                    return { kind: "null", token };
                }
                if (
                    // strtol base 0
                    /^[+-]?(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/.test(slice) ||
                    // strtod
                    /^[+-]?(?:[0-9]+\.?[0-9]*|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(slice)
                ) {
                    return { kind: "number", token };
                }
                return { kind: "unquoted", token };
            }
            case TokenKind.PreprocWord: return parse_pp_macro();
            case TokenKind.PreprocLitWordInclude: return parse_pp_include();
            case TokenKind.LitLSquare: return parse_array();
            case TokenKind.LitLCurly: return parse_object();
            default: return { kind: "meta_error", token: consume(), error_message: "Expected a value" };
        }
    }

    function parse_array(): Extract<CstNode, { kind: "array" }> {
        // Technically, the GON reference parser can treat literal "["s and "]"s as unquoted strings,
        // but that is probably more of an oversight than actual desired behaviour.
        // We report missing key instead.
        // E.g.: "forgot underscore [1.0 1.1]"
        // Programmer intent: KeyValue("forgot underscore" Array(1.0 1.1))
        // Reference parser: KeyValue("forgot" "underscore") KeyValue("[" .9) KeyValue("1.1" "]")
        // Our parser: KeyValue("forgot" "underscore") Error("Expected key before value")
        const left = consume(); // [
        const elements: CstNode[] = [];
        while(!at(TokenKind.MetaEof, TokenKind.LitRSquare, TokenKind.LitRCurly)) {
            skip_ignored();
            if(at(TokenKind.MetaEof, TokenKind.LitRSquare, TokenKind.LitRCurly)) {
                break;
            }
            elements.push(parse_value());
        }
        const right = eat(TokenKind.LitRSquare);
        return { kind: "array", left, elements, right };
    }

    function parse_object(): Extract<CstNode, { kind: "object" }> {
        // Similar deviation in handling as the array bracket case.
        const left = consume(); // {
        const elements: CstNode[] = [];
        while(!at(TokenKind.MetaEof, TokenKind.LitRCurly, TokenKind.LitRSquare)) {
            skip_ignored();
            if(at(TokenKind.MetaEof, TokenKind.LitRCurly, TokenKind.LitRSquare)) {
                break;
            }

            elements.push(parse_document_node());
        }
        const right = eat(TokenKind.LitRCurly);
        return { kind: "object", left, elements, right };
    }

    function parse_define(): Extract<CstNode, { kind: "pp_define" }> {
        const word = consume(); // PreprocLitWordDefine
        skip_ignored();
        const name = at(TokenKind.Unquoted) ? consume() : null;
        const params: Token[] = [];
        if(eat(TokenKind.LitLParen)) {
            while(at(TokenKind.Unquoted)) {
                params.push(consume());
            }
            eat(TokenKind.LitRParen);
        }
        const body: CstNode[] = [];
        while(!at(TokenKind.MetaEof, TokenKind.PreprocLitWordEnd)) {
            skip_ignored();
            if(at(TokenKind.MetaEof, TokenKind.PreprocLitWordEnd)) {
                break;
            }

            body.push(parse_value());
        }
        const end_word = eat(TokenKind.PreprocLitWordEnd);
        return { kind: "pp_define", word, name, params, body, end_word };
    }

    function parse_document_node(): CstNode {
        skip_ignored();
        if(at(TokenKind.PreprocLitWordInclude)) {
            return parse_pp_include();
        }
        if(at(TokenKind.PreprocLitWordDefine)) {
            return parse_define();
        }
        if(at(TokenKind.PreprocWord)) {
            return parse_pp_macro();
        }
        if(at(TokenKind.PreprocLitWordEnd)) {
            return { kind: "meta_error", token: consume(), error_message: "'#end' without matching '#define'" };
        }
        if(at(TokenKind.MetaUnterminatedQuoted)) {
            return { kind: "meta_error", token: consume(), error_message: "Unterminated string" };
        }
        if(at(TokenKind.Quoted, TokenKind.Unquoted)) {
            const key = consume();
            skip_ignored();
            const value: CstNode = at(TokenKind.Quoted, TokenKind.Unquoted, TokenKind.LitLSquare, TokenKind.LitLCurly, TokenKind.PreprocWord, TokenKind.PreprocLitWordInclude)
                ? parse_value()
                : { kind: "meta_error", token: key, error_message: "Key has no value" };
            return { kind: "key_value", key, value };
        }
        if(at(TokenKind.LitLSquare, TokenKind.LitLCurly)) {
            const token = peek();
            // eat the value but don't graft it onto the CST
            parse_value();
            return { kind: "meta_error", token: token, error_message: "Expected key before value" };
        }
        if(at(TokenKind.LitRSquare)) {
            return { kind: "meta_error", token: consume(), error_message: "Unexpected ']': no matching '['" };
        }
        if(at(TokenKind.LitRCurly)) {
            return { kind: "meta_error", token: consume(), error_message: "Unexpected '}': no matching '{'" };
        }
        return { kind: "meta_error", token: consume(), error_message: "Unexpected token" };
    }

    while(!at(TokenKind.MetaEof)) {
        skip_ignored();
        if(at(TokenKind.MetaEof)) break;

        nodes.push(parse_document_node());
    }

    return nodes;
}
