// GON LSP implementation, server
//
// polymeric 2026

// Based off boilerplate from https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

import { lex, Token } from './lexer';
import { parse, CstNode } from './parser';

import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    Range,
    TextDocumentSyncKind,
    InitializeResult,
    DocumentDiagnosticReportKind,
    DocumentDiagnosticReport,
    DocumentSymbol,
    SymbolKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;

// Init
connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            documentSymbolProvider: true,
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false,
            },
        },
    };

    return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

// Global settings structure synced from editor settings
// The global settings, used when the `workspace/configuration` request is not supported by the client.
let globalSettings = {
    diagnostics: true,
    outline: true
};

connection.onDidChangeConfiguration(async () => {
    const s = await connection.workspace.getConfiguration('gonHighlighter');
    globalSettings.diagnostics = s.enableDiagnostics ?? true;
    globalSettings.outline = s.enableOutline ?? true;

    connection.languages.diagnostics.refresh();
});

// Cache parses so different LSP specializations don't trigger redundant parses
interface ParseCache {
    version: number;
    cst: CstNode[];
    text: string;
}

let parseCache = new Map<string, ParseCache>();

function getParse(doc: TextDocument): ParseCache {
    const cached = parseCache.get(doc.uri);
    if (cached && cached.version === doc.version) {
        return cached;
    } else {
        const text = doc.getText();
        const cst = parse(lex(text), text);
        const result: ParseCache = { version: doc.version, cst, text };
        parseCache.set(doc.uri, result);
        return result;
    }
}

documents.onDidClose(e => parseCache.delete(e.document.uri));

// Diagnostics (error messages/problems)
connection.languages.diagnostics.on(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (document !== undefined && globalSettings.diagnostics) {
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: await validateDocument(getParse(document), document)
        } satisfies DocumentDiagnosticReport;
    } else {
		// We don't know the document. We can either try to read it from disk
		// or we don't report problems for it.
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: []
        } satisfies DocumentDiagnosticReport;
    }
});

function tokenRange(token: Token, doc: TextDocument): Range {
    return {
        start: doc.positionAt(token.offset),
        end:   doc.positionAt(token.offset + token.size),
    };
}

async function validateDocument({ cst }: ParseCache, doc: TextDocument): Promise<Diagnostic[]> {
    const out: Diagnostic[] = [];

    function error(token: Token, message: string): void {
        out.push({ severity: DiagnosticSeverity.Error, range: tokenRange(token, doc), message, source: 'gon' });
    }

    function walk(node: CstNode): void {
        switch (node.kind) {
            case 'meta_error':
                error(node.token, node.error_message);
                break;
            case 'key_value':
                walk(node.value);
                break;
            case 'array':
                if (!node.right) error(node.left, "Unclosed '[': no matching ']'");
                node.elements.forEach(walk);
                break;
            case 'object':
                if (!node.right) error(node.left, "Unclosed '{': no matching '}'");
                node.elements.forEach(walk);
                break;
            case 'pp_include':
                if (!node.path) error(node.word, "Expected file path after '#include'");
                break;
            case 'pp_define':
                if (!node.name) error(node.word, "Expected macro name after '#define'");
                if (!node.end_word) error(node.word, "'#define' without matching '#end'");
                node.body.forEach(walk);
                break;
            case 'pp_macro':
            case 'quoted':
            case 'unquoted':
            case 'bool':
            case 'null':
            case 'number':
                break;
        }
    }

    cst.forEach(walk);
    return out;
}

// Document symbols (Outline)
connection.onDocumentSymbol(params => {
    if (!globalSettings.outline) return [];
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    const { cst, text } = getParse(doc);
    return collectSymbols(cst, text, doc);
});

function tokenEnd(token: Token): number {
    return token.offset + token.size;
}

function nodeEndOffset(node: CstNode): number {
    switch (node.kind) {
        case 'quoted': return tokenEnd(node.token);
        case 'unquoted': return tokenEnd(node.token);
        case 'bool': return tokenEnd(node.token);
        case 'null': return tokenEnd(node.token);
        case 'number': return tokenEnd(node.token);
        case 'meta_error': return tokenEnd(node.token);
        case 'pp_macro': return tokenEnd(node.args ?? node.name);
        case 'pp_include': return tokenEnd(node.path ?? node.word);
        case 'key_value': return nodeEndOffset(node.value);
        case 'array': return node.right ? tokenEnd(node.right) :
                          node.elements.length ? nodeEndOffset(node.elements[node.elements.length - 1]) :
                          tokenEnd(node.left);
        case 'object': return node.right ? tokenEnd(node.right) :
                           node.elements.length ? nodeEndOffset(node.elements[node.elements.length - 1]) :
                           tokenEnd(node.left);
        case 'pp_define': return node.end_word ? tokenEnd(node.end_word) :
                              node.body.length ? nodeEndOffset(node.body[node.body.length - 1]) :
                              tokenEnd(node.word);
    }
}

function tokenText(token: Token, text: string): string {
    return text.slice(token.offset, token.offset + token.size);
}

function keyName(token: Token, text: string): string {
    const t = tokenText(token, text);
    if (t.startsWith('"') && t.endsWith('"')) {
        return t.slice(1, -1).replace(/\r?\n/g, '\\n') || '""';
    }
    return t;
}

function valueSymbolKind(node: CstNode): SymbolKind {
    switch (node.kind) {
        case 'array': return SymbolKind.Array;
        case 'object': return SymbolKind.Object;
        case 'pp_include': return SymbolKind.Module;
        case 'pp_macro': return SymbolKind.Function;
        case 'quoted': return SymbolKind.String;
        case 'unquoted': return SymbolKind.String;
        case 'bool': return SymbolKind.Boolean;
        case 'null': return SymbolKind.Null;
        case 'number': return SymbolKind.Number;
        default: return SymbolKind.Variable;
    }
}

function collectSymbols(nodes: CstNode[], text: string, doc: TextDocument): DocumentSymbol[] {
    function nodeRange(node: CstNode): Range {
        let start;
        switch (node.kind) {
            case 'quoted': start = node.token.offset; break;
            case 'unquoted': start = node.token.offset; break;
            case 'bool': start = node.token.offset; break;
            case 'null': start = node.token.offset; break;
            case 'number': start = node.token.offset; break;
            case 'meta_error': start = node.token.offset; break;
            case 'pp_macro': start = node.name.offset; break;
            case 'pp_include': start = node.word.offset; break;
            case 'pp_define': start = node.word.offset; break;
            case 'key_value': start = node.key.offset; break;
            case 'array': start = node.left.offset; break;
            case 'object': start = node.left.offset; break;
        }
        return { start: doc.positionAt(start), end: doc.positionAt(nodeEndOffset(node)) };
    }

    function valueChildren(node: CstNode): DocumentSymbol[] {
        if (node.kind === 'object') return walkNodes(node.elements);
        if (node.kind === 'array') {
            return node.elements.map((el, idx) => ({
                name: `[${idx}]`,
                kind: valueSymbolKind(el),
                range: nodeRange(el),
                selectionRange: nodeRange(el),
                children: valueChildren(el),
            }));
        }
        return [];
    }

    function walkNodes(nodes: CstNode[]): DocumentSymbol[] {
        const out: DocumentSymbol[] = [];
        for (const node of nodes) {
            switch (node.kind) {
                case 'key_value':
                    out.push({
                        name: keyName(node.key, text),
                        kind: valueSymbolKind(node.value),
                        range: nodeRange(node),
                        selectionRange: tokenRange(node.key, doc),
                        children: valueChildren(node.value),
                    });
                    break;
                case 'pp_include':
                    out.push({
                        name: node.path ? tokenText(node.path, text) : '#include',
                        kind: SymbolKind.Module,
                        range: nodeRange(node),
                        selectionRange: tokenRange(node.word, doc),
                    });
                    break;
                case 'pp_define':
                    out.push({
                        name: node.name ? tokenText(node.name, text) : '#define',
                        kind: SymbolKind.Function,
                        range: nodeRange(node),
                        selectionRange: node.name ? tokenRange(node.name, doc) : tokenRange(node.word, doc),
                        children: walkNodes(node.body),
                    });
                    break;
                case 'pp_macro':
                    out.push({
                        name: tokenText(node.name, text),
                        kind: SymbolKind.Function,
                        range: nodeRange(node),
                        selectionRange: tokenRange(node.name, doc),
                    });
                    break;
                case 'meta_error':
                case 'quoted':
                case 'unquoted':
                case 'array':
                case 'object':
                    break;
            }
        }
        return out;
    }

    return walkNodes(nodes);
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
