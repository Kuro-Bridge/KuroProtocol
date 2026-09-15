# KuroProtocol 工程指南

> 本文件是项目级指令。开始任何工作前，先读本文件与 `docs/changelog.md`（版本演进与 bump 规则）
> → `docs/peer-guide.md`（跨仓规格契约）→ `docs/fixtures.md`（夹具格式）。

## 本仓是什么

kurobridge-ws 协议的家：zod schema SSOT + 对端接入规格书 + 金样本夹具，发布名 `@kuro-bridge/protocol`。
KuroBridge 生态的契约源——消费方包括主仓 KuroAdapter（全量线：Java 薄壳 + Node 业务核心）、
KuroAdapter-Pure（纯净线：纯 Java Paper 插件）与第三方对端（napukettoqq / koishi 插件 / 其它实现）。

2026-09-15 自主仓 KuroAdapter（commit `59d3be7`）`bridge/protocol/` 平移拆分而来。

## 硬性约束（违反 = 错误）

1. **SSOT 唯一**：`src/` 的 zod schema 是 kurobridge-ws 消息类型的唯一来源。任何消费方（含姊妹仓）
   禁止手写消息类型，必须 `import { ... } from "@kuro-bridge/protocol"`。
2. **四件套同改**：任何协议变更 = 一次提交同时改齐 ① `src/` schema ② `docs/peer-guide.md`
   ③ `fixtures/` 金样本（格式变更另改 `docs/fixtures.md`）④ `docs/changelog.md`。缺任何一件 = 工作未完成。
3. **包版本 ≡ 协议版本**：`package.json` 的 `version` ≡ `src/meta.ts` 的 `PROTOCOL_VERSION`。
   拆仓首发 0.4.0 即对齐协议 0.4.0；此后协议 bump 即包 bump，不存在「包版本独立演进」。
4. **`src/` 零 Node API**：禁止 `fs` / `process` / `ws` 等任何 Node 依赖（tsconfig `types: []` 强制），
   target ES2020，QuickJS（LSE）可直接跑。测试文件同样不引入 Node API（夹具用静态 JSON import）。
5. **fixtures 是跨仓库物理契约**：`fixtures/v0.4/*.json` 会被实现阵营（如 KuroAdapter-Pure）按 pin
   版本拷贝进各自测试资源消费。只随协议版本新增目录（`fixtures/v<version>/`），不修改已发布版本的夹具。
6. **peer-guide 是跨仓库规格契约**：文档与 schema 冲突时以 `src/` schema 为准，并回改 peer-guide。
7. **协议语义禁止自行发明**：语义变更需先在 changelog 立条目（含出处），再动 schema。

## 工作流

```bash
pnpm install            # 安装依赖（mise：node 26）
pnpm check              # biome check + tsc --noEmit（提交前必跑）
pnpm fix                # biome 自动修复 + tsc
pnpm test               # vitest run（协议单测 + 夹具一致性门禁）
pnpm build              # tsdown 单文件构建（dist/index.mjs）
```

发布（本阶段**不做**）：npm org（kuro-bridge）建立后 `pnpm publish`（`publishConfig.access=public` 已就位）。

## 代码风格（biome 已强制，手动也须遵守）

- 缩进 **space+4**，行尾 **LF**，双引号 + 分号 + 尾逗号，行宽 100（对齐主仓 KuroAdapter 的 biome.json）。
- TS `strict` 全家桶 + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` +
  `verbatimModuleSyntax` + `erasableSyntaxOnly` + `noUnusedLocals/Parameters` 均为 error。
- 类型导入一律 `import type`；禁止 `any`（例外必须注释说明原因）。
- 相对导入带 `.js` 扩展名（NodeNext + ESM）。

## 实现模式

- **协议演进**：先读 `docs/changelog.md` 的 bump 规则（主版本兼容区间协商、breaking = 握手子协议字符串），
  判定本次变更是 patch / minor / major，再按四件套同改落地。
- **新帧落地顺序**：schema（`src/messages/ws.ts`）→ 单测（对齐 `*.test.ts` 正反用例风格）→
  peer-guide 帧目录 → fixtures 金样本 → changelog 条目。
- **IPC 帧（`src/messages/ipc.ts`）**：属主仓 KuroAdapter 全量线（Java 薄壳 ↔ Node 子进程）专用命名空间，
  本仓只托管 schema；纯净线（KuroAdapter-Pure）不消费。
