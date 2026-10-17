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
├── pic/                            网站图标与（目前不用的）角色图，及其原图和生成脚本
├── design/                         视觉设计的探索稿，不参与构建
├── astro.config.mjs 等             根目录配置
├── .publish-tmp/                   发布时的临时导出目录，Git 忽略
└── dist/                           构建产物，Git 忽略
```

## 2．内容目录

| 路径 | 作用 | 负责范围 |
| --- | --- | --- |
| `content` | 指向 Obsidian 博客目录的软链接 | 唯一的写作源。只在本机存在，不进入仓库；程序对它**只读**。其中 `published/` 文件夹（含子文件夹）里的笔记会发布，其余位置的不发布。附件在它之外（库内的 `90 system/attachments`），由导出脚本沿真实路径找到库根后读取。 |
| `published/posts/{slug}.md` | 已发布文章的公开副本 | 文件名即网址中的 `slug`。双链和图片路径已改写，frontmatter 只剩白名单字段（其中 `title` 是导出时按笔记名写入的）。 |
| `published/assets/` | 公开文章实际引用的图片 | 只有被已发布文章引用的图片才会出现；没有附件时目录不存在。 |
| `published/redirects.json` | 旧地址 → 新地址 | 由文章的 `redirect_from` 生成，供 `astro.config.mjs` 读取。 |

`published/` 整个目录由导出脚本每次重建，**不要手工修改**，也不要在里面放其它文件。

## 3．`scripts/`：导出与发布

用 Node 直接运行 TypeScript，不经过构建。

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `scripts/lib/export.ts` | 导出的核心逻辑 | 读取原稿、只取 `published/` 文件夹里的笔记、解析并校验它们的 frontmatter、以笔记名作标题、检查 `slug` 与 `redirect_from` 唯一性、解析双链、把 `==高亮==` 换成 `<mark>`、用 Astro 的 Markdown 处理器取得标题锚点、查找并登记附件、删除 `%%注释%%`、输出公开副本。所有问题收集为带文件和行号的 `Issue`，有任何问题就不写文件。**不负责**：构建网站、Git 操作、Callout 渲染。 |
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
| `src/site.config.ts` | 站点级文案 | 站点名、返回链接上的短名字、简介、首页文案（英文）、页头链接（book、design 两个子站，GitHub 与 Twitter）的地址、文章末尾回复用的邮箱。改文案只需改这里。 |
| `src/lib/published.ts` | 公开副本目录的位置 | 唯一定义 `PUBLISHED_DIR` 环境变量及其默认值 `./published` 的地方，供 `astro.config.mjs` 和 `src/content.config.ts` 共用。 |
| `src/lib/markdown.ts` | Markdown 的语法开关 | 目前只有一项：开启数学公式。`astro.config.mjs` 和 `scripts/lib/export.ts` 都从这里取，保证两边解析出的标题一致。这是 `scripts/` 唯一依赖 `src/` 的地方。 |
| `src/lib/posts.ts` | 文章的查询 | 所有页面都通过它取文章（按日期倒序），保证各处公开范围一致。还提供日期格式化和阅读时长的估算。 |

### 页面（文件路径即网址）

| 文件 | 网址 | 负责范围 |
| --- | --- | --- |
| `src/pages/index.astro` | `/` | 站名、简介和全部文章的列表。 |
| `src/pages/posts/[slug].astro` | `/posts/{slug}/` | 文章详情：标题、日期行、摘要、目录、正文，以及正文之后的回复链接（邮件、Twitter）和返回首页的链接。有目录的文章末尾带一段内联脚本：窗口宽度跨过 1300px、目录换位置时，保持读者的阅读位置不动。目录只渲染一份，摆在哪里由 `global.css` 按视口宽度决定。 |

### 布局、组件、插件、样式

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `src/layouts/Base.astro` | 所有页面共用的外壳 | `<head>`（含网站图标）、页头（右上角的主题切换、Twitter 与 GitHub 链接，文章页左上角的返回链接）。引入全局样式、两款等宽字体、KaTeX 的公式样式表和 Vercel 访问统计组件（`@vercel/analytics`），并在 `<body>` 末尾单独链接霞鹜文楷常规、粗体两份样式表（不挡首屏渲染）。含两段内联脚本：套用上次选的明暗主题、处理主题切换的点击。没有页脚。 |
| `src/components/PostList.astro` | 文章列表 | 首页使用。每篇三行：标题链接、日期行、摘要。 |
| `src/components/PostMeta.astro` | 日期行 | 「日期 / N min read」，首页列表和文章详情页共用；文章详情页多显示更新日期和标签。标签只是文字，不是链接（站点没有标签页）。 |
| `src/components/Toc.astro` | 文章目录 | 渲染二、三级标题的链接，每项带 `depth-2` / `depth-3` 类名；显示位置和样式由 `global.css` 决定。 |
| `src/plugins/callout.ts` | Callout 渲染插件 | 构建时把 `> [!type]` 引用块转成提示块的 HTML 结构。只管结构，不管颜色。 |
| `src/plugins/heading-anchor.ts` | 标题锚点插件 | 构建时在正文的二、三级标题后面加一个指向自己的链接。id 取自 Astro 内置的标题 id 插件，不自己算。只管结构，`#` 字符和样式在 `global.css`。 |
| `src/plugins/math.ts` | 公式渲染插件 | 构建时把处理器标出的行内和块级公式交给 KaTeX 渲染成 HTML。公式写错会让构建失败。样式和字体来自 `Base.astro` 引入的 KaTeX 样式表。 |
| `src/styles/global.css` | 全局样式 | 引入 Tailwind；定义全部设计 token（字体、字符格、颜色，见 `docs/design.md`）；所有元素的基础样式（标题、段落、链接、列表、引用、表格、代码、滚动条），对全站生效；明暗主题的切换；代码高亮的明暗切换；页头、目录、标题锚点、Callout 的外观；任务列表、高亮、按键、脚注、公式的样式。 |

## 5．根目录配置

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `astro.config.mjs` | Astro 配置 | 站点网址 `site`（`https://ozine.me`）、网址末尾斜杠、读取重定向表、Markdown 处理器及其语法开关（取自 `src/lib/markdown.ts`）、Callout、标题锚点、公式三个插件、代码高亮主题、接入 Tailwind、禁止把字体分片内联进样式表。公开副本目录取自 `src/lib/published.ts`。 |
| `package.json` | 依赖与命令 | 所有 `npm run` 命令的定义。依赖里的 `@fontsource-variable/inconsolata` 和 `@fontsource-variable/source-code-pro` 是随站点部署的两款等宽字体，`lxgw-wenkai-webfont` 是随站点部署的中文字体（霞鹜文楷），`katex` 在构建时渲染公式并提供公式的样式表和字体；开发依赖里的 `sharp` 供 `pic/cut-character.mjs` 使用。 |
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
| `docs/design.md` | 视觉设计文档 | 气质、字符格、颜色 token 及对比度、字体、各处样式约定、禁忌、改设计时该动哪里。改了设计就更新它。 |

## 7．`pic/` 与 `design/`：图片与设计探索稿

### `pic/`

站点的图片都在这里。现在的设计不用插画，站点只引用 `favicon.png`；其余三张是上一版设计的角色图，保留备用。导出和发布流程不碰这个目录。

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `pic/original/character-sheet.jpg` | 角色设定图原图（**只在本机，不进仓库**） | 下面三张图的唯一来源，站点不直接使用。是站长的个人素材，已在 `.gitignore` 里排除；新克隆的仓库里没有这个文件。 |
| `pic/cut-character.mjs` | 生成站点图片的脚本 | `node pic/cut-character.mjs`：按脚本里写定的位置从设定图裁出头像和全身像，抠掉白底和标注线，并生成网站图标。只在换图时手动运行，不属于构建或发布流程。依赖 `sharp`（已声明为开发依赖）。 |
| `pic/logo.png` | 头像（透明底） | 由脚本生成，不要手工修改。目前站点不使用。 |
| `pic/character.png` | 全身立绘（透明底） | 由脚本生成，不要手工修改。目前站点不使用。 |
| `pic/favicon.svg` | 上一版的网站图标 | 由脚本生成，不要手工修改。旧角色头像垫浅色圆角底。目前站点不使用。 |
| `pic/favicon.png` | 网站图标 | 站长的头像（192×192，圆角、角外透明），从本机的原图手工裁出，不由 `cut-character.mjs` 生成。由 `src/layouts/Base.astro` 引用。 |

### `design/`

不在 `src/` 里，Astro 不会构建或部署它；站点代码也不引用它。

| 文件 | 作用 | 负责范围 |
| --- | --- | --- |
| `design/preview.html` | 配色方案的独立预览页 | 直接用浏览器打开（字体从 jsDelivr 加载，需要联网；图片引用 `pic/`）。上一版紫灰配色定稿前的探索稿：可切换明暗和三种正文字体，页内脚本实测各组合的 WCAG 对比度。和现在的站点没有关系，保留作历史记录；以 `src/styles/global.css` 和 `docs/design.md` 为准。 |

## 8．一次发布中各部分的参与顺序

1. `scripts/publish.ts` 检查 Git 状态。
2. `scripts/lib/export.ts` 读取 `content`，校验并导出到 `.publish-tmp/`。
3. `astro.config.mjs` 与 `src/content.config.ts` 在 `PUBLISHED_DIR=.publish-tmp` 下读取临时副本，`src/` 构建出 `dist/`。
4. 构建通过后，`scripts/publish.ts` 用临时副本替换 `published/`，提交并推送。
5. Vercel 拉取仓库，只用 `published/` 和 `src/` 重新构建，不需要 `content` 和 `scripts/`。
6. `scripts/lib/vercel.ts` 轮询这次提交的部署状态，`scripts/publish.ts` 据此报告「上线完成」或部署失败。
