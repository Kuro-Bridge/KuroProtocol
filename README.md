# KuroProtocol

kurobridge-ws 协议的家：zod schema SSOT + 对端接入规格书（peer-guide）+ 金样本夹具（fixtures）。
发布名 `@kuro-bridge/protocol`，**包版本 ≡ 协议版本**（版本 SSOT：`src/meta.ts` 的 `PROTOCOL_VERSION`）。

KuroBridge 生态所有实现阵营——主仓 KuroAdapter（全量线）、KuroAdapter-Pure（纯净线，纯 Java）与
第三方对端——以本仓为契约源：

- **规格契约**：`docs/peer-guide.md`（跨仓库契约；帧名与字段以 `src/` 的 zod schema 为 SSOT）
- **物理契约**：`fixtures/v0.4/`（金样本 JSON + `SHA256SUMS`；随包分发，装包即得，校验方式见下文「金样本与校验」，格式见 `docs/fixtures.md`）
- **版本演进**：`docs/changelog.md`（协议 0.1→0.4.0 简史 + bump 规则）
- **决策记录**：`docs/DECISIONS.md`（ADR-001：SSOT 收口、发布线与主仓镜像冻结）

## 工作流

```bash
pnpm install        # 安装依赖（mise：node 26）
pnpm check          # biome check + tsc --noEmit
pnpm fix            # biome 自动修复 + tsc
pnpm test           # vitest run（含夹具一致性门禁）
pnpm build          # tsdown 双格式构建（dist/index.mjs + dist/index.cjs，ADR-001）
pnpm gate           # 提交前唯一权威门禁：check + test + build + 夹具三方一致 + 版本锚 + 死链检查
```

## 金样本与校验

装包即得 `fixtures/v0.4/`（全部金样本 + `SHA256SUMS`，份数 = SHA256SUMS 行数，ADR-003）——金样本随主包分发，消费方
无需跨仓手拷：

- **包内两方校验**：`npx kuro-bridge-verify-fixtures`（bin 命令；fixtures 目录 ↔ SHA256SUMS +
  sha256 实算）。
- **仓内门禁**：`pnpm gate`（check + test + build + 夹具三方一致 + 版本锚 + 死链检查）。
- **程序化消费**：`import { validateFixture } from "@kuro-bridge/protocol"`（ADR-002 导出的
  纯函数校验器，格式契约见 `docs/fixtures.md`）。

## 硬性规则

见 [AGENTS.md](AGENTS.md)：四件套同改（schema + peer-guide + fixtures + changelog）、包版本 ≡ 协议版本、
src 零 Node API。

## 发布状态

本仓**尚未发布**。npm 上现存 `@kuro-bridge/protocol@0.1.0`（2026-09-15）系拆仓前夜从主仓
`bridge/protocol` 误发的旧线产物（包版本与内嵌协议版本错位、exports 缺 require），处置与
0.4.0 首发 / deprecate 计划见 `docs/DECISIONS.md` ADR-001。**发布只能从本仓出。**

## 来源

2026-09-15 自主仓 KuroAdapter（commit `59d3be7`）`bridge/protocol/` 平移拆分，协议内容零改动。
