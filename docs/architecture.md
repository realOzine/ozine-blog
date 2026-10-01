# 项目结构与职责

本文档说明仓库里每个目录和文件负责什么、不负责什么。

> **维护规则**：新增、删除、移动文件，或改变某个文件的职责范围时，必须在同一次修改中同步更新本文档。

相关文档：[`plan.md`](plan.md)（最初的规划）、[`decisions.md`](decisions.md)（实现中的选择与取舍）、[`design.md`](design.md)（视觉设计）。

## 1．总览

项目分成两半，中间只通过 `published/` 目录交接：

```text
┌─ 导出（只在本机运行）──────────────┐      ┌─ 站点（本机与 Vercel 都运行）────┐
│ content/ → scripts/ → published/ │ ───▶ │ published/ → src/ → dist/      │
└──────────────────────────────────┘      └────────────────────────────────┘
```

- **导出**负责「哪些内容可以公开、公开成什么样」：读 Obsidian 原稿、校验、筛选、转换语法。
- **站点**负责「公开内容怎么呈现」：只读 `published/`，不知道 Obsidian 的存在。

因此，涉及隐私与筛选的逻辑只应出现在 `scripts/`；涉及页面与样式的逻辑只应出现在 `src/`。

```text
ozine-blog/
├── content -> Obsidian「40 blog」   本地软链接，Git 忽略
├── published/                      公开副本，由程序维护
├── scripts/                        导出与发布
├── src/                            Astro 站点
├── docs/                           规划、结构与决策文档
├── pic/                            角色图与网站图标，及其原图和生成脚本
├── design/                         视觉设计的探索稿，不参与构建
├── astro.config.mjs 等             根目录配置
├── .publish-tmp/                   发布时的临时导出目录，Git 忽略
└── dist/                           构建产物，Git 忽略
```

## 2．内容目录

| 路径 | 作用 | 负责范围 |
| --- | --- | --- |
| `content` | 指向 Obsidian 博客目录的软链接 | 唯一的写作源。只在本机存在，不进入仓库；程序对它**只读**。附件在它之外（库内的 `90 system/attachments`），由导出脚本沿真实路径找到库根后读取。 |
| `published/posts/{slug}.md` | 已发布文章的公开副本 | 文件名即网址中的 `slug`。双链和图片路径已改写，frontmatter 只剩白名单字段。 |
| `published/assets/` | 公开文章实际引用的图片 | 只有被已发布文章引用的图片才会出现；没有附件时目录不存在。 |
| `published/redirects.json` | 旧地址 → 新地址 | 由文章的 `redirect_from` 生成，供 `astro.config.mjs` 读取。 |

`published/` 整个目录由导出脚本每次重建，**不要手工修改**，也不要在里面放其它文件。

## 3．`scripts/`：导出与发布

用 Node 直接运行 TypeScript，不经过构建。

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `scripts/lib/export.ts` | 导出的核心逻辑 | 读取原稿、解析并校验 frontmatter、按 `status` 筛选、检查 `slug` 与 `redirect_from` 唯一性、解析双链、用 Astro 的 Markdown 处理器取得标题锚点、查找并登记附件、删除 `%%注释%%`、输出公开副本。所有问题收集为带文件和行号的 `Issue`，有任何问题就不写文件。**不负责**：构建网站、Git 操作、Callout 渲染。 |
| `scripts/export.ts` | `npm run export` 的命令行入口 | 解析参数、调用核心逻辑、打印结果。不含业务规则，输出文字的格式也由核心逻辑提供。 |
| `scripts/publish.ts` | `npm run release` 的命令行入口 | 串联发布流程：检查 Git 状态 → 导出到 `.publish-tmp/`（与已提交的 `published/` 完全一致时到此结束）→ 用临时副本构建 → 替换 `published/` → 只提交 `published/`（提交信息为 `content: …`）→ 推送 → 等待并报告部署结果。负责失败时停止并说明原因，并把「推送成功」与「上线完成」分开报告。**不负责**：内容规则（委托给 `lib/export.ts`）、部署状态的查询（委托给 `lib/vercel.ts`）。 |
| `scripts/lib/vercel.ts` | 核实 Vercel 部署 | 通过本机的 `vercel` CLI 按提交哈希查找部署并轮询到终态，返回 ready / failed / timeout / unavailable 四种结果。只查询，不触发部署，也不决定退出码。 |
| `scripts/vercel.test.ts` | 部署核实逻辑的测试 | 用假的查询函数验证轮询、失败、超时和不可用几种情况，不访问网络。 |
| `scripts/export.test.ts` | 导出规则的测试 | 文件内的 `BASE` 定义了一个最小的模拟库（博客目录、库外附件目录、库外私密笔记），每个测试把它写到系统临时目录后验证正常路径和各类错误。仓库里不保存样本文章。只测导出，不测页面和发布命令。 |

## 4．`src/`：Astro 站点

### 配置与数据

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `src/content.config.ts` | 定义 `posts` 内容集合 | 指定从 `published/posts/` 读取文章，并声明公开 frontmatter 的类型。新增公开字段时要与 `scripts/lib/export.ts` 的白名单一起改。 |
| `src/site.config.ts` | 站点级文案 | 站点名、简介、首页文案、GitHub 主页地址。改文案只需改这里。 |
| `src/lib/published.ts` | 公开副本目录的位置 | 唯一定义 `PUBLISHED_DIR` 环境变量及其默认值 `./published` 的地方，供 `astro.config.mjs` 和 `src/content.config.ts` 共用。 |
| `src/lib/posts.ts` | 文章的查询 | 所有页面都通过它取文章（按日期倒序），保证各处公开范围一致。还提供日期格式化。 |

### 页面（文件路径即网址）

| 文件 | 网址 | 负责范围 |
| --- | --- | --- |
| `src/pages/index.astro` | `/` | 介绍区（头像与简介，向下滚动时淡出）和全部文章的列表。 |
| `src/pages/posts/[slug].astro` | `/posts/{slug}/` | 文章详情：标题、日期、标签、正文、目录（桌面端右侧固定，手机端折叠）。 |

### 布局、组件、插件、样式

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `src/layouts/Base.astro` | 所有页面共用的外壳 | `<head>`（含网站图标）、顶栏（站名与 GitHub 图标，没有导航菜单）、页脚、页面宽度、右下角的看板娘。引入全局样式和 Vercel 访问统计组件（`@vercel/analytics`），并在 `<body>` 末尾单独链接两款中文字体的样式表（不挡首屏渲染），因此它们对所有页面生效。 |
| `src/components/PostList.astro` | 文章列表 | 首页使用。含条目的悬停动效和滚动进入视口时的浮现。 |
| `src/components/Tags.astro` | 标签组 | 文章详情页用它显示这篇文章的标签。只是文字，不是链接（站点没有标签页）。 |
| `src/components/Toc.astro` | 文章目录 | 渲染二、三级标题的链接；显示位置由文章详情页决定。 |
| `src/plugins/callout.ts` | Callout 渲染插件 | 构建时把 `> [!type]` 引用块转成提示块的 HTML 结构。只管结构，不管颜色。 |
| `src/styles/global.css` | 全局样式 | 引入 Tailwind 与排版插件；定义全部设计 token（字体、颜色，见 `docs/design.md`）；页面进入、看板娘浮动、星点闪烁、跨页面过渡，以及跟随滚动的介绍区淡出和文章条目浮现这几种动效；角色图的暗色处理；正文排版；代码高亮的明暗切换；Callout 的外观。 |

## 5．根目录配置

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `astro.config.mjs` | Astro 配置 | 网址末尾斜杠、读取重定向表、Markdown 处理器与 Callout 插件、代码高亮主题、接入 Tailwind、禁止把字体分片内联进样式表。公开副本目录取自 `src/lib/published.ts`。 |
| `package.json` | 依赖与命令 | 所有 `npm run` 命令的定义。依赖里的 `lxgw-wenkai-screen-web` 和 `@fontsource/noto-serif-sc` 是随站点部署的中文字体；开发依赖里的 `sharp` 供 `pic/cut-character.mjs` 使用。 |
| `package-lock.json` | 依赖版本锁定 | 由 npm 维护。 |
| `tsconfig.json` | TypeScript 配置 | 继承 Astro 严格模式；允许脚本用 `.ts` 扩展名互相导入。 |
| `.vercel/` | Vercel CLI 的项目关联信息 | 由 `vercel link` 生成，Git 忽略。核实部署时 CLI 靠它知道查哪个项目。 |
| `.gitignore` | Git 忽略规则 | 忽略 `content` 软链接、`.publish-tmp/`、构建产物、依赖，以及 Vercel CLI 的本地文件（`.vercel/`、`.env*`）。 |

## 6．文档

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `README.md` | 使用说明 | 首次设置、文章 frontmatter 写法、常用命令、提交信息规范。 |
| `CLAUDE.md` | 给 Claude Code 的工作指引 | 命令、提交信息规范、架构要点、容易出错的地方、文档维护规则。 |
| `docs/plan.md` | 最初的项目规划 | 目标、范围、验收标准。作为历史记录保留，实现与它不一致之处记在 `docs/decisions.md`。 |
| `docs/decisions.md` | 决策与取舍记录 | 每个实现选择：选了什么、放弃了什么、代价是什么。做出或改变决定时更新。 |
| `docs/architecture.md` | 本文档 | 文件与目录的作用和职责范围。 |
| `docs/design.md` | 视觉设计文档 | 气质、颜色 token 及对比度、字体、角色图的用法、各处样式约定、改设计时该动哪里。改了设计就更新它。 |

## 7．`pic/` 与 `design/`：图片与设计探索稿

### `pic/`

站点用到的图片都在这里，由 `src/` 通过 Astro 的图片优化引入（构建时转成 WebP）。导出和发布流程不碰这个目录。

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `pic/original/character-sheet.jpg` | 角色设定图原图 | 下面三张图的唯一来源，站点不直接使用。 |
| `pic/cut-character.mjs` | 生成站点图片的脚本 | `node pic/cut-character.mjs`：按脚本里写定的位置从设定图裁出头像和全身像，抠掉白底和标注线，并生成网站图标。只在换图时手动运行，不属于构建或发布流程。依赖 `sharp`（已声明为开发依赖）。 |
| `pic/logo.png` | 头像（透明底） | 由脚本生成，不要手工修改。用于首页介绍区。 |
| `pic/character.png` | 全身立绘（透明底） | 由脚本生成，不要手工修改。用于所有页面右下角的看板娘。 |
| `pic/favicon.svg` | 网站图标 | 由脚本生成，不要手工修改。头像垫浅色圆角底。 |

### `design/`

不在 `src/` 里，Astro 不会构建或部署它；站点代码也不引用它。

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `design/preview.html` | 配色方案的独立预览页 | 直接用浏览器打开（字体从 jsDelivr 加载，需要联网；图片引用 `pic/`）。定稿前的探索稿，保留作以后试配色的地方：可切换明暗和三种正文字体，页内脚本实测各组合的 WCAG 对比度。它和正式站点不会自动同步，以 `src/styles/global.css` 和 `docs/design.md` 为准。 |

## 8．一次发布中各部分的参与顺序

1. `scripts/publish.ts` 检查 Git 状态。
2. `scripts/lib/export.ts` 读取 `content`，校验并导出到 `.publish-tmp/`。
3. `astro.config.mjs` 与 `src/content.config.ts` 在 `PUBLISHED_DIR=.publish-tmp` 下读取临时副本，`src/` 构建出 `dist/`。
4. 构建通过后，`scripts/publish.ts` 用临时副本替换 `published/`，提交并推送。
5. Vercel 拉取仓库，只用 `published/` 和 `src/` 重新构建，不需要 `content` 和 `scripts/`。
6. `scripts/lib/vercel.ts` 轮询这次提交的部署状态，`scripts/publish.ts` 据此报告「上线完成」或部署失败。
