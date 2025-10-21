# VS Code Extension How‑To: Develop and Publish

This guide documents the exact, repeatable process we used to build and ship MarkItDown. Follow it to create and publish your next extension end‑to‑end.

Links you will use often:
- VS Code Publishing: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- vsce CLI: https://github.com/microsoft/vsce
- Azure DevOps PATs: https://dev.azure.com/ (User Settings → Personal access tokens)
- Python: https://www.python.org/downloads/
- markitdown library: https://github.com/microsoft/markitdown

## 0. Repo layout reference

We used this structure:
```
.
├─ src/ …
├─ out/ (compiled)
├─ docs/
├─ memory-bank/
├─ test-files/
├─ package.json
├─ tsconfig.json
├─ .vscodeignore
├─ README.md
├─ CHANGELOG.md
├─ LICENSE
└─ markitdown.png
```

Important source files you can open:
- [package.json](package.json)
- [tsconfig.json](tsconfig.json)
- [.vscodeignore](.vscodeignore)
- [README.md](README.md)
- [CHANGELOG.md](CHANGELOG.md)
- [LICENSE](LICENSE)
- [src/extension.ts](src/extension.ts)
- [src/python/environmentManager.ts](src/python/environmentManager.ts)
- [src/conversion/orchestrator.ts](src/conversion/orchestrator.ts)
- [docs/README.md](docs/README.md)
- [docs/prd.md](docs/prd.md)

## 1. Prerequisites

- Node.js 16+ and npm
- VS Code latest
- Python 3.7+ available on PATH
- vsce CLI: `npm i -g @vscode/vsce`
- GitHub CLI (optional): `gh auth login`

Verify:
```bash
node -v
npm -v
python3 --version || python --version
vsce --version
```

## 2. Initialize the extension project

- Create a new repo and add baseline files.
- Author the VS Code manifest in [package.json](package.json).

Required manifest fields we used:
- name, displayName, description, version, publisher (`bioinfo`)
- engines.vscode (e.g., `^1.74.0`)
- categories (Formatters, Other)
- icon (`markitdown.png`)
- activationEvents and main entry (`./out/extension.js`)
- contributes.commands, contributes.menus, contributes.configuration

Tip: keep SEO keywords in `keywords` for Marketplace discoverability.

## 3. TypeScript build

Configure [tsconfig.json](tsconfig.json) to compile to `out/` and include `"lib": ["ES2020","DOM"]`.

Build commands:
```bash
npm install
npm run compile
```

## 4. Core implementation

- Extension entry: [src/extension.ts](src/extension.ts)
- Conversion orchestration: [src/conversion/orchestrator.ts](src/conversion/orchestrator.ts)
- Python venv and subprocess: [src/python/environmentManager.ts](src/python/environmentManager.ts)
- Error handling/output channel: [src/utils/errorHandler.ts](src/utils/errorHandler.ts)
- Settings bridge: [src/config/configurationManager.ts](src/config/configurationManager.ts)

Key patterns:
- Create/check venv under `globalStorageUri`
- Detect python preferring `python3` then `python`
- Install `markitdown[all]` to enable PDF/DOCX/PPTX/XLSX/images/audio
- Run conversions asynchronously and report progress
- Handle filename collisions (overwrite or numeric suffix)

## 5. User‑visible docs

Provide:
- [README.md](README.md) (features, usage, troubleshooting)
- [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog / SemVer)
- Screenshots/GIFs (optional) in `docs/`

## 6. Licensing & metadata

- Include [LICENSE](LICENSE) (MIT in our case)
- Ensure `license` field in [package.json](package.json)
- Add repository, bugs, homepage URLs
- Add `"qna": "marketplace"`

## 7. Icons and branding

- Top‑level `markitdown.png` used as Marketplace icon
- Recommended: 128×128 or 256×256 PNG, < 1 MB
- Optional gallery banner (dark): set in `galleryBanner` of [package.json](package.json)

## 8. Packaging filters

Create [.vscodeignore](.vscodeignore) to exclude sources, node_modules, tests, etc., so your VSIX is small. Keep compiled `out/**` and top‑level docs only.

## 9. Local packaging

Build a VSIX:
```bash
npm run compile
vsce package
```
VSCE prints the path, e.g. `markitdown-vscode-0.1.1.vsix`.

## 10. Publisher account and authentication

- Create/confirm publisher id: `bioinfo`
- Create an Azure DevOps Personal Access Token with scope “Marketplace (Manage)”
- Login once with vsce:
```bash
vsce login bioinfo
```
You’ll paste the PAT in the prompt and see “verification succeeded”.

## 11. Publishing (first time and updates)

First publish for version already in [package.json](package.json):
```bash
vsce publish 0.1.1
```

Subsequent releases (automatic SemVer bump):
```bash
vsce publish patch   # bumps 0.1.1 -> 0.1.2
vsce publish minor   # 0.1.x -> 0.2.0
vsce publish major   # 0.x.x -> 1.0.0
```

Marketplace links after publish:
- Listing: https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode
- Manage hub: https://marketplace.visualstudio.com/manage/publishers/bioinfo/extensions/markitdown-vscode/hub

## 12. Common validation/upload issues

Error: “Value cannot be null. Parameter name: v1”
- Ensure `publisher` in [package.json](package.json) exactly matches your Publisher ID (`bioinfo`)
- Remove non‑standard fields (e.g., `pricing`)
- Keep `qna: "marketplace"` allowed
- Rebuild VSIX with `vsce package` and try again or use CLI `vsce publish`

Icon too large
- Keep PNG < 1 MB; optimize if necessary

Missing engine compatibility
- Set `"engines": {"vscode": "^1.xx.0"}` in [package.json](package.json)

Python or dependency errors at runtime
- We install `markitdown[all]` in venv inside [src/python/environmentManager.ts](src/python/environmentManager.ts)
- First run may take minutes; show progress notification

## 13. Quality checklist (pre‑publish)

- [ ] Lints and builds cleanly: `npm run compile`
- [ ] README includes features, usage, screenshots, troubleshooting
- [ ] CHANGELOG updated with new version
- [ ] LICENSE present and referenced in [package.json](package.json)
- [ ] `.vscodeignore` excludes dev artifacts; VSIX < 5 MB
- [ ] Commands appear in `contributes` and work from Command Palette and Explorer
- [ ] Settings documented in README and declared in manifest
- [ ] Cross‑platform smoke test (macOS/Windows/Linux)

## 14. Repeatability template (new extension)

1) Clone a fresh repo  
2) Copy these baseline files from this project:
   - [package.json](package.json)
   - [tsconfig.json](tsconfig.json)
   - [.vscodeignore](.vscodeignore)
   - [README.md](README.md)
   - [CHANGELOG.md](CHANGELOG.md)
   - [LICENSE](LICENSE)
   - Folder structure under `src/`
3) Search/replace names: package name, displayName, commands, icon  
4) Implement business logic in `src/**`  
5) `npm install && npm run compile`  
6) `vsce login <publisher>` (one time per machine)  
7) `vsce publish` (or `patch|minor|major`)  

## 15. Security, privacy, and notices

- No telemetry by default in this extension; add only with opt‑in and a clear policy
- Sanitize file paths; avoid shell interpolation when spawning processes
- Provide actionable error messages and link to docs/issues

## 16. Useful snippets

Publish a specific version:
```bash
vsce publish 0.1.1
```

Unpublish (rare):
```bash
vsce unpublish bioinfo.markitdown-vscode
```

List your publishers on this machine:
```bash
vsce ls-publishers
```

## 17. Appendix: Direct links

- Publishing guide (official): https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Manifest reference: https://code.visualstudio.com/api/references/extension-manifest
- Contribution points: https://code.visualstudio.com/api/references/contribution-points
- Testing extensions: https://code.visualstudio.com/api/working-with-extensions/testing-extension
- Icons guidance: https://code.visualstudio.com/api/references/extension-manifest#icon
- Changelog guidance: https://keepachangelog.com/en/1.0.0/
- Semantic Versioning: https://semver.org/

---

Last updated: 2025‑08‑22