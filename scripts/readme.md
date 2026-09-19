# scripts/ —— 门禁与校验脚本

> 协议仓单包形态的脚本入口（工作区约定：monorepo 用 `toolings/`，单包仓维持 `scripts/`，
> 见根 README「约定」节）。各脚本完整语义以脚本头注为准，此处只做盘点与入口索引；
> 三脚本均挂 `pnpm gate`（提交前唯一权威门禁）。

| 脚本 | 入口 | 作用 |
|---|---|---|
| `verify-fixtures.mjs` | `pnpm verify:fixtures`（npm bin `kuro-bridge-verify-fixtures`） | 金样本三方一致性：目录 ↔ SHA256SUMS ↔ 测试静态 import（发布包内自动降级两方） |
| `assert-version.mjs` | `pnpm verify:version` | 包版本 ≡ `src/meta.ts` 的 `PROTOCOL_VERSION` 字面断言 |
| `check-doc-links.mjs` | `pnpm verify:docs` | 全 `*.md` 路径类 token 死链检查（豁免在册、逐条带理由） |
