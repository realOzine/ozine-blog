# ozine-blog

用 Astro + TypeScript + Tailwind CSS 搭建的个人博客。文章在 Obsidian 中写作，通过一条发布命令导出为公开副本并推送，由 Vercel 构建部署。

- 规划：[`docs/plan.md`](docs/plan.md)
- 项目结构与各文件职责：[`docs/architecture.md`](docs/architecture.md)
- 实现中的选择与取舍：[`docs/decisions.md`](docs/decisions.md)

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
| `npm run release` | 发布：校验 → 导出 → 构建检查 → 更新 `published/` → 提交 → 推送 → 等待 Vercel 部署结果 |
| `npm run release -- --dry-run` | 只做校验、导出和构建检查，不改动任何东西 |
| `npm run release -- --no-push` | 提交但不推送 |
| `npm run release -- --no-wait` | 推送后不等待部署结果 |
| `npm run dev` | 本地预览当前 `published/` 的内容 |
| `npm run export` | 只导出到 `published/`，不构建、不提交 |
| `npm test` | 导出规则与部署核实逻辑的测试；单个测试：`node --test --test-name-pattern='重复 slug' scripts/export.test.ts` |
| `npm run check` | Astro / TypeScript 类型检查 |
| `npm run build` | 构建到 `dist/` |

发布命令只提交 `published/`；站点代码的改动需要自己提交。推送后命令会等待 Vercel 构建，看到「上线完成」才算发布成功；核实部署需要本机已登录 `vercel` CLI 并执行过 `vercel link`，否则只会提示「部署状态未核实」。

## 提交信息

格式：`<type>(<scope>): <中文说明>`，scope 可省略。

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复问题 |
| `docs` | 只改文档 |
| `style` | 只改页面样式或代码格式，不影响行为 |
| `refactor` | 不改变行为的代码调整 |
| `test` | 测试 |
| `chore` | 依赖、配置等杂项 |
| `content` | 文章内容变更，由 `npm run release` 自动生成，不要手写 |

scope 取 `export`（导出规则）、`site`（页面与样式）、`publish`（发布流程）之一。例如：

```text
feat(export): 支持 PDF 附件导出
fix(site): 修正手机端目录折叠后的间距
docs: 新增 architecture.md
```
