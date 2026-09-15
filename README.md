# KuroProtocol

kurobridge-ws 协议的家：zod schema SSOT + 对端接入规格书（peer-guide）+ 金样本夹具（fixtures）。
发布名 `@kuro-bridge/protocol`，**包版本 ≡ 协议版本**（当前 0.4.0）。

KuroBridge 生态所有实现阵营——主仓 KuroAdapter（全量线）、KuroAdapter-Pure（纯净线，纯 Java）与
第三方对端——以本仓为契约源：

- **规格契约**：`docs/peer-guide.md`（跨仓库契约；帧名与字段以 `src/` 的 zod schema 为 SSOT）
- **物理契约**：`fixtures/v0.4/`（金样本 JSON；消费方按 pin 版本拷贝进测试资源，格式见 `docs/fixtures.md`）
- **版本演进**：`docs/changelog.md`（协议 0.1→0.4.0 简史 + bump 规则）

## 工作流

```bash
pnpm install        # 安装依赖（mise：node 26）
pnpm check          # biome check + tsc --noEmit（提交前必跑）
pnpm fix            # biome 自动修复 + tsc
pnpm test           # vitest run（含夹具一致性门禁）
pnpm build          # tsdown 构建（dist/index.mjs）
```

## 硬性规则

见 [AGENTS.md](AGENTS.md)：四件套同改（schema + peer-guide + fixtures + changelog）、包版本 ≡ 协议版本、
src 零 Node API。

## 来源

2026-09-15 自主仓 KuroAdapter（commit `59d3be7`）`bridge/protocol/` 平移拆分，协议内容零改动；
发布名待 npm org（kuro-bridge）建立后启用（`publishConfig` 已就位）。
