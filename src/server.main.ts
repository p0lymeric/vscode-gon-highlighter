// GON LSP implementation, server (desktop)
//
// polymeric 2026

import { startServer } from './server';
import { createConnection, ProposedFeatures, TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

startServer(createConnection(ProposedFeatures.all), new TextDocuments(TextDocument));
