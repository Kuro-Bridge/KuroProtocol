# 决策档案

本仓决策按时间序编号，只保留结论与现行落点；协议历史 ADR（ADR-004 及以上，如 ADR-026 兼容
协商、ADR-030 品牌迁移）见主仓 KuroAdapter 的决策台账。

## ADR-001 协议 SSOT 收口与发布线唯一（2026-09-16）

拆仓后主仓 `bridge/protocol` 副本仍被主仓三消费方以 `workspace:*` 绑定，且 npm 上出现从主仓
误发的 `0.1.0`——包版本轴与内嵌协议版本错位、`exports` 缺 require（CJS 消费方解析失败）。

- **结论**：协议演进的唯一合法路径 = 改本仓 `src/`（四件套同改）。阶段 1 冻结主仓副本为只读
  镜像并加字节级门禁、主仓包 `private: true`；阶段 2（2026-09-18 已全部执行）本仓首发 0.4.0
  （npm latest）、0.1.0 deprecate、主仓删镜像、三消费方与上游对端切 `^0.4.0`。
- **原则**：**发布只能从 SSOT 仓出**——包版本 ≡ 协议版本的语义只在 SSOT 仓成立；任何同名包
  的第二份 package.json 必须 `private`。
- **现行落点**：版本锚 `pnpm verify:version`（包版本 ≡ `src/meta.ts` 的 `PROTOCOL_VERSION`）；
  发布流程见[发布手册](../guides/release.md)。

## ADR-002 fixtures 契约校验导出 validateFixture（2026-09-17）

金样本契约校验原本内联在 `src/fixtures.test.ts`（与 vitest 耦合，包消费方不可达），三个实现
阵营各自手写同一套校验逻辑，漂移只是时间问题。

- **结论**：校验逻辑提炼为 `src/fixtures.ts` 纯函数 `validateFixture`（零 Node API，数据进、
  结果出，不抛异常），聚合四层规则：元 schema parse → reject.stage 声明一致性 → 逐帧三分支
  （accept 必过方向 schema；reject.wire 必拒 wire 骨架；reject.dispatch 过骨架且必拒方向
  schema）→ behavior.reply 引用格式与索引界。
- **边界**：明确**不导出行为语义执行器**——close code/reason 与 reply 帧的实跑验证依赖各实现
  的鉴权、handler 与连接设施，协议包只承载期望声明（`expect.behavior`），执行归各消费方。

## ADR-003 金样本随主包分发 + bin 校验命令（2026-09-17）

金样本是协议的物理半边契约，此前只能跨仓手拷分发，消费方守卫只数份数不校内容。

- **结论**：`package.json` 的 `files` 增补 `fixtures` 全目录（含 `SHA256SUMS`）与
  `scripts/verify-fixtures.ts`，bin `kuro-bridge-verify-fixtures`——装包即得金样本，一条命令
  校验。金样本与 schema 同 tar，「包版本 ≡ 协议版本」一词覆盖两者。
- **不新增 exports 子路径**：JSON 金样本的消费方式是文件读取 + SHA256SUMS 比对，不经模块
  import——避开 exports 封闭与 JSON import 的 CJS/ESM 差异；模块化消费走 `validateFixture`。
- **脚本双模式自动降级**：仓内运行 = 三方一致（fixtures 目录 ↔ `SHA256SUMS` ↔ 测试注册表，
  另加逐文件 sha256 实算）；包内运行 = 两方（目录 ↔ `SHA256SUMS`）。版本目录由包 version 推导
  （`0.4.0` → `v0.4`），把「包版本 ↔ 目录」锚进机器。
