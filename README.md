# ozine-blog

用 Astro + TypeScript + Tailwind CSS 搭建的个人博客。文章在 Obsidian 中写作，通过一条发布命令导出为公开副本并推送，由 Vercel 构建部署。

- 规划：[`plan.md`](plan.md)
- 实现中的选择与取舍：[`DECISIONS.md`](DECISIONS.md)

## 工作方式

```text
Obsidian「40 blog」 ──content 软链接──▶ 校验 metadata、转换双链与图片
                                              │
                          published/posts/{slug}.md + published/assets/
                                              │
                               Astro 构建 ──▶ GitHub ──▶ Vercel
```

`content` 是指向 Obsidian 博客目录的本地软链接，不进入仓库；`published/` 是程序维护的公开副本，不要手工修改。

## 首次设置

```sh
npm install
ln -s "/path/to/Obsidian/vault/40 blog" content
```

需要 Node ≥ 22.18。

## 写文章

在 Obsidian 博客目录的任意位置新建笔记，frontmatter：

```yaml
---
title: 理解 Go 的接口
slug: go-interfaces        # 决定网址 /posts/go-interfaces/，全站唯一
status: draft              # draft | published | withdrawn
date: 2026-09-29
tags: [Go]                 # 可选
description: 一句话摘要。    # 可选
updated: 2026-10-01        # 可选
redirect_from: old-slug    # 可选：改过 slug 时填旧值
---
```

博客目录下的每个 `.md` 都必须有合法的 `status`。支持 `[[文章]]`、`[[文章|别名]]`、`[[文章#标题]]`、`![[图片.png]]`、Markdown 相对路径图片、Callout（`> [!note]`）和 `%%注释%%`（导出时删除）。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run release` | 发布：校验 → 导出 → 构建检查 → 更新 `published/` → 提交 → 推送 |
| `npm run release -- --dry-run` | 只做校验、导出和构建检查，不改动任何东西 |
| `npm run release -- --no-push` | 提交但不推送 |
| `npm run dev` | 本地预览当前 `published/` 的内容 |
| `npm run sample` | 用 `fixtures/` 里的样本文章启动本地预览 |
| `npm run export` | 只导出到 `published/`，不构建、不提交 |
| `npm test` | 导出规则的测试；单个测试：`node --test --test-name-pattern='重复 slug' scripts/export.test.ts` |
| `npm run check` | Astro / TypeScript 类型检查 |
| `npm run build` | 构建到 `dist/` |

发布命令只提交 `published/`；站点代码的改动需要自己提交。推送成功不等于部署成功，需到 Vercel 确认。
