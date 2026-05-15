## Release checklist (for smart dummies)
### Preparation
1. Update version number in `package.json`, `gon.tmLanguage.json`, and `CHANGELOG.md`.
2. Update release date and changelog in `CHANGELOG.md`.
3. Commit the release changes onto `master`.
4. Create an annotated tag.
```
git tag -a vx.x.x -m "x.x.x release"
```
5. Generate the `vsix` archive.
```
vsce package
```
6. Review release candidate locally.

### Submission
1. Push to `origin/master`.
```
git push origin master --follow-tags
```
2. Release to [VS Marketplace](https://marketplace.visualstudio.com/manage).
```
vsce publish
```
3. Upload `vsix` to [Open VSX](https://open-vsx.org/user-settings/extensions).
4. Upload `vsix` to [GitHub Releases](https://github.com/p0lymeric/vscode-gon-highlighter/releases/new).
