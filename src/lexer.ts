// GON lexer
//
// polymeric 2026

export enum TokenKind {
    LitEqual, LitComma, LitColon,
    LitLSquare, LitRSquare,
    LitLCurly, LitRCurly,
    LitLParen, LitRParen,
    PreprocDoubleSlashComment, PreprocSlashStarComment,
    PreprocLitWordInclude, PreprocLitWordDefine, PreprocLitWordEnd,
    PreprocWord,
    GonHashComment,
    Quoted, Unquoted,
    MetaRestOfLine, MetaEof, MetaUnexpectedChar, MetaUnterminatedQuoted
}

export interface Token {
    kind: TokenKind;
    offset: number;
    size: number;
}

export function lex(doc: string): Token[] {
    let tokens: Token[] = [];
    let i = 0;

    while(i < doc.length) {
        // Single capture tokens
        switch(doc[i]) {
            // IsWhitespace
            case ' ': i++; continue;
            case '\n': i++; continue;
            case '\r': i++; continue;
            case '\t': i++; continue;
            // IsIgnored
            case '=': tokens.push({ kind: TokenKind.LitEqual, offset: i, size: 1 }); i++; continue;
            case ',': tokens.push({ kind: TokenKind.LitComma, offset: i, size: 1 }); i++; continue;
            case ':': tokens.push({ kind: TokenKind.LitColon, offset: i, size: 1 }); i++; continue;
            // Others
            case '[': tokens.push({ kind: TokenKind.LitLSquare, offset: i, size: 1 }); i++; continue;
            case ']': tokens.push({ kind: TokenKind.LitRSquare, offset: i, size: 1 }); i++; continue;
            case '{': tokens.push({ kind: TokenKind.LitLCurly, offset: i, size: 1 }); i++; continue;
            case '}': tokens.push({ kind: TokenKind.LitRCurly, offset: i, size: 1 }); i++; continue;
            case '(': tokens.push({ kind: TokenKind.LitLParen, offset: i, size: 1 }); i++; continue;
            case ')': tokens.push({ kind: TokenKind.LitRParen, offset: i, size: 1 }); i++; continue;
            default:
        }

        // Single line comment (preprocessor)
        if(doc.slice(i, i + 2) == "//") {
            const offset_start = i;
            while(i < doc.length && doc[i] != '\n') {
                i++;
            }
            tokens.push({ kind: TokenKind.PreprocDoubleSlashComment, offset: offset_start, size: i - offset_start });
            continue;
        }

        // Multiple line comment (preprocessor)
        if(doc.slice(i, i + 2) == "/*") {
            const offset_start = i;
            i += 2;
            while(i < doc.length) {
                if(doc.slice(i, i + 2) == "*/") {
                    i += 2;
                    break;
                }
                i++;
                // TODO detect unterminated comment?
            }
            tokens.push({ kind: TokenKind.PreprocSlashStarComment, offset: offset_start, size: i - offset_start });
            continue;
        }

        // Macros (preprocessor)/Hash comments (GON)
        if(doc[i] === '#') {
            const offset_start = i;
            // Count consecutive hashes to collapse into single comment
            while(i < doc.length && doc[i] === '#') {
                i++;
            }

            // Lex #+ followed by whitespace as a GonHashComment
            if(' \n\r\t'.includes(doc[i]) || i >= doc.length) {
                while(i < doc.length && doc[i] != '\n') {
                    i++;
                }
                tokens.push({ kind: TokenKind.GonHashComment, offset: offset_start, size: i - offset_start });
                continue;
            }

            // If there is no whitespace, treat the hash as a preprocessor sigil
            // Collect the next word (go directly to jail; do not pass go)
            // NB This disagrees with the reference parser, as GON comments and preprocessor directives
            // share the # sigil and anything that fails to parse as a macro becomes a GON comment.
            const word_start = i;
            while(i < doc.length) {
                if(' \n\r\t()[]{}=,:"#'.includes(doc[i])) {
                    break;
                }
                if(doc[i] == '/' && (doc[i + 1] == '/' || doc[i + 1] == '*')) {
                    break;
                }
                i++;
            }

            // Emit one of PreprocLitWordInclude, PreprocLitWordDefine, PreprocLitWordEnd, PreprocWord
            if(i > word_start) {
                const word = doc.slice(word_start, i);
                if(word === 'include') {
                    tokens.push({ kind: TokenKind.PreprocLitWordInclude, offset: offset_start, size: i - offset_start });
                } else if(word === 'define') {
                    tokens.push({ kind: TokenKind.PreprocLitWordDefine, offset: offset_start, size: i - offset_start });
                } else if(word === 'end') {
                    tokens.push({ kind: TokenKind.PreprocLitWordEnd, offset: offset_start, size: i - offset_start });
                } else {
                    tokens.push({ kind: TokenKind.PreprocWord, offset: offset_start, size: i - offset_start });
                    // If the token is a PreprocWord, consume the rest of the line as a MetaRestOfLine
                    // NB This disagrees with the reference parser, as we don't perform a pre-pass
                    // to actually count how many tokens to group with the macro invocation.
                    // We simply eat the rest of the line, which reduces complications when parsing TEIN GON documents,
                    // as they make heavy use of GON comments without a space after the sigil.
                    const rest_start = i;
                    while(i < doc.length && doc[i] != '\n') {
                        i++;
                    }
                    if(i > rest_start) {
                        tokens.push({ kind: TokenKind.MetaRestOfLine, offset: rest_start, size: i - rest_start });
                    }
                }
            }
            continue;
        }

        // Quoted strings (GON)
        if(doc[i] == '"') {
            const offset_start = i;
            i++;
            let terminated = false;
            while(i < doc.length) {
                if(doc[i] == '\\' && i + 1 < doc.length) {
                    // "\\\\" and "\\\"" sequence handling
                    i += 2;
                } else if(doc[i] == '"') {
                    i++;
                    terminated = true;
                    break;
                } else if(doc[i] == '\n') {
                    // NB GON parses quoted strings that span multiple lines, but it's almost certainly
                    // not useful because the preprocessor will insert extra line breaks per line break.
                    // To prevent unclosed strings from eating the rest of the document, we
                    // force the string closed at the newline (not consuming it) and emit
                    // MetaUnterminatedQuoted so the server can report a diagnostic.
                    break;
                } else {
                    i++;
                }
            }
            // If we encounter EOF, the string is also unterminated.
            tokens.push({ kind: terminated ? TokenKind.Quoted : TokenKind.MetaUnterminatedQuoted, offset: offset_start, size: i - offset_start });
            continue;
        }

        // Unquoted strings (GON)
        {
            const offset_start = i;
            while(i < doc.length) {
                if(' \n\r\t()[]{}=,:"#'.includes(doc[i])) {
                    break;
                }
                if(doc[i] == '/' && (doc[i + 1] == '/' || doc[i + 1] == '*')) {
                    break;
                }
                i++;
            }
            if(i > offset_start) {
                tokens.push({ kind: TokenKind.Unquoted, offset: offset_start, size: i - offset_start });
                continue;
            }
        }

        tokens.push({ kind: TokenKind.MetaUnexpectedChar, offset: i, size: 1 });
        i++;
    }

    tokens.push({ kind: TokenKind.MetaEof, offset: i, size: 0 });
    return tokens;
}
