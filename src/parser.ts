// GON parser
//
// polymeric 2026

import { DiagSeverity, Diag } from './diag';
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
    | { kind: "meta_bad", token: Token }
;

export type CstNodeDocument = Extract<CstNode, { kind: "pp_include" | "pp_define" | "pp_macro" | "key_value" }>;
export type CstNodeValue = Extract<CstNode, { kind: "pp_include" | "pp_macro" | "quoted" | "unquoted" | "bool" | "null" | "number" | "array" | "object" | "meta_bad" }>;

export function parse(tokens: Token[], text: string): { cst: CstNode[], diags: Diag[] } {
    let nodes: CstNode[] = [];
    let diags: Diag[] = [];
    let i = 0;

    function error(token: Token, message: string): void {
        diags.push({ severity: DiagSeverity.Error, offset: token.offset, size: token.size, message });
    }

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
        if (!path) {
            error(word, "Expected file path after '#include'");
        }
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
                    // strtod decimals
                    /^[+-]?(?:[0-9]+\.?[0-9]*|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(slice) ||
                    // strtod heximals
                    /^[+-]?0[xX](?:[0-9a-fA-F]+\.?[0-9a-fA-F]*|[0-9a-fA-F]*\.[0-9a-fA-F]+)(?:[pP][+-]?[0-9]+)?$/.test(slice) ||
                    // strtod special words
                    // fun fact: MSVC's strtod accepts POSIX-style "NAN(" <alphanumeric> ")" sequences, so now we do too
                    /^[+-]?(?:infinity|inf|nan(?:\([0-9a-zA-Z_]*\))?)$/i.test(slice)
                ) {
                    return { kind: "number", token };
                }
                return { kind: "unquoted", token };
            }
            case TokenKind.PreprocWord: return parse_pp_macro();
            case TokenKind.PreprocLitWordInclude: return parse_pp_include();
            case TokenKind.LitLSquare: return parse_array();
            case TokenKind.LitLCurly: return parse_object();
            default: {
                const token = consume();
                error(token, "Expected a value");
                return { kind: "meta_bad", token };
            }
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
        if (!right) {
            error(left, "Unclosed '[': no matching ']'");
        }
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
        if (!right) {
            error(left, "Unclosed '{': no matching '}'");
        }
        return { kind: "object", left, elements, right };
    }

    function parse_define(): Extract<CstNode, { kind: "pp_define" }> {
        const word = consume(); // PreprocLitWordDefine
        skip_ignored();
        const name = at(TokenKind.Unquoted) ? consume() : null;
        if (!name) {
            error(word, "Expected macro name after '#define'");
        }
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
        if (!end_word) {
            error(word, "'#define' without matching '#end'");
        }
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
            const token = consume();
            error(token, "'#end' without matching '#define'");
            return { kind: "meta_bad", token };
        }
        if(at(TokenKind.Quoted, TokenKind.Unquoted)) {
            const key = consume();
            skip_ignored();
            let value: CstNode;
            if (at(TokenKind.Quoted, TokenKind.Unquoted, TokenKind.LitLSquare, TokenKind.LitLCurly, TokenKind.PreprocWord, TokenKind.PreprocLitWordInclude)) {
                value = parse_value();
            } else {
                error(key, "Key has no value");
                value = { kind: "meta_bad", token: key };
            }
            return { kind: "key_value", key, value };
        }
        if(at(TokenKind.LitLSquare, TokenKind.LitLCurly)) {
            const token = peek();
            const value = parse_value();
            error(token, "Expected key before value");
            return value;
        }
        if(at(TokenKind.LitRSquare)) {
            const token = consume();
            error(token, "Unexpected ']': no matching '['");
            return { kind: "meta_bad", token };
        }
        if(at(TokenKind.LitRCurly)) {
            const token = consume();
            error(token, "Unexpected '}': no matching '}'");
            return { kind: "meta_bad", token };
        }
        {
            const token = consume();
            error(token, "Unexpected token");
            return { kind: "meta_bad", token };
        }
    }

    while(!at(TokenKind.MetaEof)) {
        skip_ignored();
        if(at(TokenKind.MetaEof)) break;

        nodes.push(parse_document_node());
    }

    return { cst: nodes, diags };
}
