// GON LSP implementation, client (browser)
//
// polymeric 2026

// Based off boilerplate from https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

import {
    workspace,
    ExtensionContext,
    window,
    commands,
    Uri
} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
} from 'vscode-languageclient/browser';

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

    const serverMain = Uri.joinPath(context.extensionUri, 'dist/server.browser.js');
    const worker = new Worker(serverMain.toString(true));

    const clientOptions: LanguageClientOptions = {
        // Register the server for GON language documents
        documentSelector: [
            { language: 'gon' }
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
        clientOptions,
        worker
    );

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
