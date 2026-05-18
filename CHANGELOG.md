# Changelog

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
