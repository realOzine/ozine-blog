# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal blog: Astro 7 + TypeScript + Tailwind CSS 4. Articles are written in Obsidian and exported into this repo by a publish command. Docs, comments and user-facing messages are in Chinese — keep that.

- `docs/plan.md` — the original plan (scope, acceptance criteria).
- `docs/architecture.md` — what every file and directory is for and what it is responsible for. **Standing rule from the user: every change that adds, removes, moves a file or changes a file's responsibility must update this document in the same change.**
- `docs/decisions.md` — every implementation choice and its trade-off. **When you make or change a decision, record it there** (what was chosen, what was given up, the cost).

## Commands

```sh
npm run dev                       # preview whatever is in published/
npm run sample                    # export fixtures/ to .publish-tmp and preview that (use this to see real content)
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
- Heading anchors in the export script are computed with `github-slugger` to match the ids Astro generates. Keep the two in sync.
- Attachments live outside the content folder (`90 system/attachments` in the real vault). The exporter finds the vault root by walking up from the symlink's real path to `.obsidian`. Only image extensions, only files referenced by published posts, only paths inside the vault — these limits are privacy guards, don't loosen them casually.
- `PUBLISHED_DIR` env var redirects both the content collection and the redirects lookup; `release` uses it to build against `.publish-tmp/` before replacing `published/`.
- All pages get posts through `src/lib/posts.ts` (`getPosts` / `getTags`) so the public set is identical everywhere. Tags are grouped case-insensitively.
- Adding a public frontmatter field means changing both `publicFrontmatter()` in the export script and the schema in `src/content.config.ts`.
- Deployment verification (`scripts/lib/vercel.ts`) shells out to the logged-in `vercel` CLI. `vercel ls --meta githubCommitSha=…` does not reliably filter, so results are re-filtered by SHA in code — keep that filter, or a previous deployment's READY gets reported as this release going live.
- `published/` is program-owned. Don't hand-edit it; `release` commits only that path and refuses to run with other staged changes.
- `fixtures/vault/` is a miniature vault mirroring the real layout; error cases are generated inside `scripts/export.test.ts`. Never write test content into the user's Obsidian vault.
