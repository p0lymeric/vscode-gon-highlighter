## GON Highlighter

[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=polymeric.vscode-gon-highlighter) | [Open VSX](https://open-vsx.org/extension/polymeric/vscode-gon-highlighter) | [GitHub Releases](https://github.com/p0lymeric/vscode-gon-highlighter/releases)

GON Highlighter is a VS Code extension that provides language support for GON (Glaiel Object Notation) files, a data format used by the Glaiel Game Engine.

### Features
- **Syntax highlighting**: Colours code to allow for easier reading.
- **Problem diagnostics**: Basic syntax error detection reported through the Problems tab (e.g. unbalanced braces or dangling keys/values).
- **Symbol outlines**: Populates the Outline panel with document symbols (did you know that `Ctrl + Shift + O` opens a symbol navigation popup in VS Code?)

![example](images/highlight_example.png)

### Known limitations
- Bracket and quote autocompletion may not trigger unless the file is largely correct up to the editing point.
- Many LSP features are not implemented. Currently the plan is to only support features that are useful for editing a simple document format, like syntax checking and document outlines.

Feedback is highly appreciated. Please file bug reports or suggestions to the project's [GitHub repository](https://github.com/p0lymeric/vscode-gon-highlighter/issues).

### Licensing
MIT License. See [LICENSE.md](LICENSE.md) for details.

`gon.tmLanguage.json` is based off VS Code's JSONC TextMate grammar. Copyright (c) 2015 - present Microsoft Corporation. MIT License.
