// GON LSP implementation, client (desktop)
//
// polymeric 2026

// Based off boilerplate from https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

import * as path from 'path';
import {
    workspace,
    ExtensionContext,
    window,
    commands
} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gonHighlighter.enable')) {
                window.showInformationMessage(
                    // TODO translation requires additional package
                    'Reload the window for the enable setting change to take effect.',
                    'Reload'
                ).then(selection => {
                    if (selection === 'Reload') {
                        commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            }
        })
    );

    if (!workspace.getConfiguration('gonHighlighter').get<boolean>('enable', true)) {
        return;
    }

    const serverModule = context.asAbsolutePath(
        path.join('dist', 'server.main.js')
    );

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };

    const clientOptions: LanguageClientOptions = {
        // Register the server for GON language documents
        documentSelector: [
            { scheme: 'file', language: 'gon' },
            { scheme: 'untitled', language: 'gon' }
        ],
        // possibly only needed if we later add macro expansion support
        // synchronize: {
        //     // Notify the server about file changes to GON files contained in the workspace
        //     fileEvents: workspace.createFileSystemWatcher('**/*.{gon,gon.append,gon.merge,gon.patch}')
        // }
    };

    client = new LanguageClient(
        'gonLanguageServer',
        'GON Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
