# KuroProtocol 双仓 bootstrap 实录（2026-09-15）

> 本文件是 KuroProtocol + KuroAdapter-Pure 双仓 bootstrap 的总实录（任务书：KuroProtocol +
> KuroAdapter-Pure 双仓 bootstrap）。KuroAdapter-Pure 仓内细节见其 `docs/STATUS.md` 与提交链。

## 0. 主仓来源与只读声明

- 来源主仓：`C:\Dev\MC-Ecosystem\KuroAdapter`，基准 commit **`59d3be7dc960cf87a2c033e2655ad1624c339a0b`**。
- 主仓全程只读：协议代码用 cp 平移（src + 文档），gradle wrapper 五件套与 gradle.properties
  同样 cp 自 `platforms/je/`（通用 Gradle 文件，非业务代码）；未对主仓执行任何写入 / git 写操作。
- 主仓当时存在一处**未提交改动**（`bridge/protocol/package.json` 版本 0.0.0 → 0.1.0），系主仓自身
  状态，本任务未触碰；平移内容以 HEAD（59d3be7）为准。

## 1. KuroProtocol（仓库 A）——做了什么

- 工程骨架：单包仓（非 monorepo），pnpm + Node 26（mise）+ ESM；tsconfig 对齐主仓
  bridge/protocol（strict 全家桶 + `types: []` 纯度约束）；biome.json 复制主仓根配置（扫描范围
  改为 `src/**`）；vitest + tsdown；MIT LICENSE（主仓无 LICENSE 文件，本仓新拟，版权人
  The Kuro-Bridge Authors）。
- src 平移：`bridge/protocol/src/` 8 个文件全量复制零改动（frame / meta / index / messages×4 /
  测试×2 实为 8 文件清单见提交 2），另平移 `bridge/protocol/docs/design.md`（加平移出处头）。
- **包版本 0.4.0 ≡ 协议版本**（主仓内部包 0.0.0/0.1.0 机制终止）；`publishConfig.access=public`
  已留，npm org（kuro-bridge）建立后首发（本阶段范围外）。
- docs：peer-guide.md 平移 + 跨仓契约声明头；changelog.md（0.1→0.4.0 简史 + bump 规则，ADR 编号
  均指主仓 DECISIONS）；fixtures.md（夹具格式契约）。
- fixtures/v0.4：16 份金样本（handshake 3 / frames 8 / tolerance 5），每份标注主仓出处
  （SHA + 文件 + 用例名）；`src/fixtures.test.ts` 一致性门禁 17 用例（正样本必过、拒绝样本必拒、
  behavior 引用校验）——静态 import JSON（`with { type: "json" }`），保 src 零 Node API。
- 门禁：`pnpm check` / `pnpm test`（55 用例）/ `pnpm build` 全绿。

## 2. KuroAdapter-Pure（仓库 B）——做了什么

由子代理无人值守完成（本实录作者验收 + 一处修正），细节以其 docs/design.md 与 STATUS.md 为准：

- 纯 Java 仓：Gradle Kotlin DSL 多模块（`:core` 零 Bukkit API + `:paper` compileOnly Paper API），
  工具链 25 / release 21 / `-Xlint:all -Werror` / Spotless(palantir 2.71.0)，wrapper 9.7.0（cp 自
  主仓 platforms/je，本机缓存发行版离线可建）。
- 协议层（:core）：帧编解码 + 两段式解析（wire 骨架 → 按 type 分发）、握手状态机（单程 hello、
  hello 10s 超时 1002、版本协商先于鉴权、token 失败 1008）、主版本兼容区间、ping/pong + 空闲
  30s close 1001、未知帧三分支容忍（永不断连）、Java-WebSocket 服务端（子协议 `kurobridge-ws.v1`
  协商、缺失 HTTP 400、动态端口 listen(0)）。
- 业务骨架：ConfigLoader（形状对齐主仓 config-schema，去 runtime/embedded 段）+ BindingStore /
  ForwardRules / WhitelistGateway 接口空实现；:paper 只留插件壳（无 Bukkit 接线，按任务范围）。
- **夹具接线**：KuroProtocol `fixtures/v0.4/` 整目录拷入测试资源（PIN.md 记来源/版本/日期），
  16/16 逐份消费 + 7 份行为断言（握手三份 close code/reason 精确断言等）。
- 门禁：`gradlew build` 全绿，测试 78/78；产物 `kuroadapter-pure-0.1.0.jar`（shadow fat JAR）。
- 提交链 6 笔（docs 设计先行 → gradle 骨架 → 协议层 → 业务骨架 → 夹具接线 → 斜杠修正）。

## 3. 关键决策（含验收修正）

| # | 决策 | 理由 |
|---|---|---|
| D-01 | KuroProtocol 先行、Pure 后建（顺序而非并行） | 环境不支持后台子代理；顺序化消除夹具同步点，Pure 一次运行即接线 |
| D-02 | 包版本 ≡ 协议版本写进 AGENTS（0.4.0 首发） | 拆仓发包对外即协议本身；主仓内部 0.0.0 机制不适配独立发包 |
| D-03 | peer-guide 正文不改写，只加声明头 + 勘误注记 | 红线「正文不改写」；版本行漂移（自述 0.3.1 vs SSOT 0.4.0）记录于 changelog 勘误节 |
| D-04 | 夹具格式 `{name,note,source,frames:[{dir,frame}],expect:{schema,reject?,behavior}}`；reject 分 wire/dispatch 两阶段 | 把「两段式解析」本身编码进夹具语义，TS 门禁与消费方各司其职（zod 验帧、消费方验行为） |
| D-05 | 夹具一致性门禁用静态 import JSON（不用 node:fs） | 保 src 零 Node API（types: [] 硬约束）；代价 = 新增夹具须登记 import（fixtures.md 已写明） |
| D-06 | Pure 依赖白名单：Jackson 2.18.0 + Java-WebSocket 1.6.0（MIT） | 对齐主仓 Java 侧同款 Jackson；WS 库按任务书推荐 |
| D-07 | **验收修正**：Pure 的 command「前导斜杠拒绝」回退为 zod SSOT（仅 min(1)） | 斜杠是 peer-guide 记载的对端调用约定、非 schema 校验规则；TS 线放行 `/list` 而 Pure 拒则会形成跨实现可观察分叉，违背一致性门禁初衷（commit 94a579e） |
| D-08 | Pure 协议常量（0.4.0 / kurobridge-ws.v1）为人工同步副本 | SSOT 在本仓 src/meta.ts；bump 流程 = 同步常量 → 重新拷夹具 → 更新 PIN（三处文档已写明） |

## 4. 放弃项与遗留

- **未做（任务范围外）**：npm 发布与 org、GitHub 远端、真机 Paper 联调、Bukkit 事件接线、业务
  全量实现、主仓任何修改（含主仓 DECISIONS 补记 ADR）。
- KuroProtocol：纯函数门禁无法验证 behavior（close/回执）——已由 Pure 的 7 份行为断言补位，
  未来 TS 侧可考虑 server 层行为门禁（非本阶段）。
- KuroAdapter-Pure：`:paper` 空壳（`load: STARTUP` 待真机验证）；config 无热重载；协议常量
  人工同步副本机制（D-08）；`build` 不触发 shadowJar（shadow 9.0.0 行为，主仓一致，显式调
  `:paper:shadowJar`）。
- 主仓 peer-guide 版本行 0.3.1 漂移：本仓以声明头 + changelog 勘误覆盖；主仓侧修正属主仓后续
  工作（范围外）。

## 5. 两仓提交链快照（bootstrap 收官时）

- KuroProtocol（5 笔）：`0e9ebc0` 骨架 → `882dd60` src 平移 → `66145e5` docs → `8a5b328`
  fixtures+门禁 → `（本笔）` 实录。
- KuroAdapter-Pure（6 笔）：`dbbf6fc` 设计先行 → `d365199` gradle 骨架 → `1224b93` 协议层 →
  `334a489` 业务骨架 → `38be251` 夹具接线 → `94a579e` 斜杠回退 SSOT。
