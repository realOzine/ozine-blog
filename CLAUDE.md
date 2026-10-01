# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal blog: Astro 7 + TypeScript + Tailwind CSS 4. Articles are written in Obsidian and exported into this repo by a publish command. Docs, comments and user-facing messages are in Chinese — keep that.

- `docs/plan.md` — the original plan (scope, acceptance criteria).
- `docs/architecture.md` — what every file and directory is for and what it is responsible for. **Standing rule from the user: every change that adds, removes, moves a file or changes a file's responsibility must update this document in the same change.**
- `docs/design.md` — the visual design. **Its first principle, set by the user: reading comfort comes before everything else** (colour, decoration, motion all yield to it). Covers colour tokens (with contrast figures), fonts, the character images in `pic/`, styling conventions. Update it when the design changes.
- `docs/decisions.md` — every implementation choice and its trade-off. **When you make or change a decision, record it there** (what was chosen, what was given up, the cost).

## Commands

```sh
npm run dev                       # preview whatever is in published/
npm test                          # export + deploy-verification tests (node:test)
node --test --test-name-pattern='重复 slug' scripts/export.test.ts   # single test
npm run check                     # astro check (types)
npm run build
npm run export                    # content/ → published/, no build, no git
npm run release -- --dry-run      # validate + export to temp + build; touches nothing
npm run release                   # full publish: also replaces published/, commits it, pushes, waits for the Vercel deployment
```

Scripts run as TypeScript directly on Node (type stripping, Node ≥ 22.18): use `.ts` import extensions and erasable syntax only (no enums / parameter properties). TypeScript is pinned to 6.x because `@astrojs/check` does not accept 7.

## Commit messages

Conventional Commits with a Chinese summary: `<type>(<scope>): <中文说明>`.

- type: `feat` `fix` `docs` `style` `refactor` `test` `chore` `content`
- scope (optional): `export` | `site` | `publish`
- `content` is reserved for commits that only change `published/`; `npm run release` generates these itself (`content: 新增 1、更新 0、移除 0 篇文章`). Don't write them by hand.

Examples: `feat(export): 支持 PDF 附件导出`, `fix(site): 修正手机端目录折叠后的间距`, `docs: 新增 architecture.md`.

## Architecture

Two halves joined by the `published/` directory:

1. **Export (local only)** — `scripts/lib/export.ts`. Reads `content/` (git-ignored symlink to the Obsidian vault's `40 blog` folder), validates frontmatter, keeps only `status: published`, and writes `published/posts/{slug}.md`, `published/assets/*`, `published/redirects.json`. It collects every problem as an `Issue` (file + line) and writes nothing if there is any. The whole output dir is rebuilt each run, so withdrawn/deleted posts and unreferenced assets disappear.
2. **Site (also runs on Vercel)** — Astro reads only `published/` via the `posts` content collection (`src/content.config.ts`); the filename is the slug. It never touches `content/` or the vault.

Obsidian syntax is handled in two places on purpose:

- Export time: `[[wikilinks]]` → `[title](/posts/slug/#anchor)`, `![[image]]` and relative Markdown images → `![](../assets/name)`, `%%comments%%` stripped, frontmatter reduced to a whitelist. These need the vault-wide filename→slug index, which only exists locally.
- Build time: callouts (`> [!note]`) are left as blockquotes in the published copy and rendered by `src/plugins/callout.ts`.

Things that are easy to get wrong:

- Markdown is processed by **Sätteri** (Astro 7's default), not remark/rehype. Plugins are Sätteri mdast/hast visitor objects passed to `satteri()` in `astro.config.mjs`; remark/rehype plugins will not work.
- Heading anchors are not parsed by hand: the exporter renders each published note with the same Sätteri processor Astro uses (`createSatteriMarkdownProcessor` in `scripts/lib/export.ts`) and takes its heading ids. If you pass `features` to `satteri()` in `astro.config.mjs`, pass the same ones there, or anchors and page ids drift apart. `exportContent` is async because of this.
- Code blocks use Shiki with `defaultColor: false`: tokens carry only `--shiki-light` / `--shiki-dark` variables and `global.css` picks one with `light-dark()`. Without that CSS rule code is uncoloured.
- Attachments live outside the content folder (`90 system/attachments` in the real vault). The exporter finds the vault root by walking up from the symlink's real path to `.obsidian`. Only image extensions, only files referenced by published posts, only paths inside the vault — these limits are privacy guards, don't loosen them casually.
- `PUBLISHED_DIR` env var (defined once in `src/lib/published.ts`) redirects both the content collection and the redirects lookup; `release` uses it to build against `.publish-tmp/` before replacing `published/`. `release` skips the build when the export is identical to the committed `published/`; `--dry-run` always builds.
- The site has only two kinds of page: the home page (lists every post) and `/posts/{slug}/`. All pages get posts through `src/lib/posts.ts` (`getPosts`) so the public set is identical everywhere. Tags are shown on the post page as plain text; there are no tag pages.
- Adding a public frontmatter field means changing both `publicFrontmatter()` in the export script and the schema in `src/content.config.ts`.
- Deployment verification (`scripts/lib/vercel.ts`) shells out to the logged-in `vercel` CLI. `vercel ls --meta githubCommitSha=…` does not reliably filter, so results are re-filtered by SHA in code — keep that filter, or a previous deployment's READY gets reported as this release going live.
- Colours are semantic tokens defined in `@theme` in `src/styles/global.css` as `light-dark(light, dark)` (`bg-page`, `bg-surface`, `border-line`, `text-muted`, `text-body`, `text-heading`, `text-accent`, `text-deco`). Use only these in pages and components — no raw palette colours (`stone-*`), no `dark:` variants, no `prose-invert`. `--color-deco` is decoration only; it does not have enough contrast for text.
- The site name in the header uses `font-script` (Great Vibes, latin subset only, imported in `Base.astro`): no letter-spacing, no `lowercase`, and don't use it anywhere else.
- Headings use `font-serif` with `font-semibold` only: the bundled Noto Serif SC is loaded at weight 600 alone, and the body font (LXGW WenKai Screen) ships only a regular weight.
- Site images live in `pic/` and are generated from `pic/original/character-sheet.jpg` by `node pic/cut-character.mjs`; don't hand-edit the generated files. `pic/original/` is the user's private source material: it is git-ignored and exists only on this machine — never commit it (the three generated images are tracked, because Vercel builds from GitHub and needs them). `design/preview.html` is a standalone exploration page that is not built and does not stay in sync with the site.
- The only client-side JavaScript is Vercel Web Analytics (`<Analytics />` in `src/layouts/Base.astro`). It only reports in production on Vercel.
- `published/` is program-owned. Don't hand-edit it; `release` commits only that path and refuses to run with other staged changes.
- The export tests build a miniature vault (the `BASE` map in `scripts/export.test.ts`, mirroring the real layout) in the OS temp dir for each test. There are no sample articles in the repo — don't add a fixtures directory back. Never write test content into the user's Obsidian vault.
