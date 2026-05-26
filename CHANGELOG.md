# Changelog

## [2.0.3] - 2026-05-25
Version 2.0.3 fixes some small highlighting issues and adds some syntax checks.

- Add an `Unterminated '/*' comment` check.
- Extend diagnostics inside keyless objects and arrays.
- Fix the following highlight cases.
    - Colour lines consisting only of hashes (`#`) as comments.
    - Fix colouring of parentheses and separators in #define blocks.
    - Fix miscolouring of unquoted strings that contain constant literals, like `true/text`.
    - Classify `\\` and `\"` as "normal" escaped characters instead of "other" escaped characters.
    - Fix some key-value abutment cases (`"key"value` and `"key""value"`).

## [2.0.2] - 2026-05-20
Version 2.0.2 is a niche update that improves parsing for floating point numbers and parentheses.

- Add support for colouring the full set of strings that strtod accepts as numbers (hex floats, `nan`, `nan(...)`, `infinity`, `inf`).
- Align the language server lexer to treat parentheses as non-literals outside of a `#define` context (only `#define` treats parentheses specially).

## [2.0.1] - 2026-05-18
Version 2.0.1 adds support for installing GON Highlighter in VS Code for the Web.

- Add browser extension support for the LSP client and server, enabling use on VS Code for the Web hosts, like [vscode.dev](https://vscode.dev) and [github.dev](https://github.dev).

## [2.0.0] - 2026-05-18
Version 2.0.0 adds a Typescript-based language server to GON Highlighter.

- Basic syntax errors are reported in the Problems tab.
    - Unmatched `[`/`]`, `{`/`}`, `"`/`"`, `#define`/`#end`
    - Dangling keys/values in object contexts.
- The document tree is now populated in the Outline sidebar and the top breadcrumb bar.
- Language server features may be disabled by the following new settings.
    - `gonHighlighter.enable`: enables the overall language server.
    - `gonHighlighter.enableDiagnostics`: enables syntax error diagnostics in the Problem tab.
    - `gonHighlighter.enableOutline`: enables populating document outlines in the Outline sidebar.

## [1.0.3] - 2026-05-16
- Fix key colouring in some cases when there is no whitespace between key and value (e.g. `key{}`)

## [1.0.2] - 2026-05-15
- Fix `#define` whitespace acceptance between name and arg list
- Add VS Marketplace/Open VSX/GitHub Releases links to README

## [1.0.1] - 2026-05-13
- Add `.gon.append`, `.gon.merge`, and `.gon.patch` as registered file extensions
- Add `#define` parentheses autoclose handling
- Fix key-value pairing regex

## [1.0.0] - 2026-05-13
- Initial release
