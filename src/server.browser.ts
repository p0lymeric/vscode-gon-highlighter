// GON LSP implementation, server (browser)
//
// polymeric 2026

import { startServer } from './server';
import { createConnection, BrowserMessageReader, BrowserMessageWriter, TextDocuments } from 'vscode-languageserver/browser';
import { TextDocument } from 'vscode-languageserver-textdocument';

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);
startServer(createConnection(messageReader, messageWriter), new TextDocuments(TextDocument));
