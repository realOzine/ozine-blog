# 测试样本

`vault/` 模拟一个最小的 Obsidian 库，结构与真实库一致：

- `40 blog/`：博客目录（相当于 `content` 软链接指向的位置）
- `90 system/attachments/`：附件目录，位于博客目录之外
- `30 domain/`：博客目录之外的私密笔记

正常样本覆盖：三种双链写法、`![[图片]]`、标准 Markdown 相对路径图片、Callout、代码块、
`%%注释%%`、草稿、撤回、`redirect_from`。各类错误样本在 `scripts/export.test.ts` 中临时生成。
