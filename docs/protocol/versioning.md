# 版本模型与 bump 规则

> 版本 SSOT：`src/meta.ts` 的 `PROTOCOL_VERSION`；**包版本 ≡ 协议版本**（`package.json` 的
> `version` 与之恒等，`pnpm verify:version` 机器锚定）。现行 0.4.0（npm latest）。

## 双层版本模型

- **WS 子协议字符串**（`WS_SUBPROTOCOL` = `kurobridge-ws.v1`）：大版本。不兼容变化在握手期
  直接拒绝对端；`.vN` 位才是真正的 major 门槛。
- **`hello.protocolVersion`**（语义化三元组）：小版本/能力协商，主版本兼容区间下浮动。

## 兼容判定

**主版本号相同即兼容**（minor/patch 自由浮动）：`0.2.0` 对端可连 `0.4.0` 服务端；`1.x` 对端连
`0.x` 服务端被拒。实现为本仓 `src/meta.ts` 纯函数 `isProtocolVersionCompatible`（解析
`^\d+\.\d+\.\d+$` 三元组比主版本；任一侧解析失败 = 不兼容——hello schema 已强制格式，此处
防御性兜底）。不兼容走既有拒绝路径（`hello_ack ok:false` + close 1002）。0.1~0.2.1 时代的
精确相等协商已废弃，仅作历史。

## bump 粒度先例

| 变更类型 | 粒度 | 先例 |
|---|---|---|
| 新增帧 / 行为变更 | minor | 0.2.0、0.3.0 |
| 可选字段追加且无行为分支 | patch | 0.2.1（ready.autoRestart）、0.3.1（hello.client） |
| 握手层 breaking（子协议字符串变更） | 0.x 语境下 minor 即对外信号 | 0.4.0（`kurobot-ws` → `kurobridge-ws`，唯一 breaking，帧形状零变化） |

**安全网**：未知帧两段式容忍（未知请求帧回 `<type>_result {ok:false, error:"unknown frame
type"}`、未知事件帧忽略、未知 `_result` 不回执防乒乓）+ body 未知键剥离——服务端可先于对端
携带新帧，旧对端双向兼容。

## 版本简史

| 协议版本 | 日期 | 阶段 | 内容 | 出处 |
|---|---|---|---|---|
| 0.1.0 | 2026-09-12~13 | 原型 | 首版定稿：双层版本（子协议 `kurobot-ws.v1` + `hello.protocolVersion`，当时协商为精确相等）；单程握手 hello/hello_ack（废除草案的双向 hello）；帧格式 `{header:{type,id?},body}` 与 transform 解析层；WS/IPC 统一 id 规则（事件帧无 id、请求/响应帧 UUID 必填）；ping/pong 心跳；chat 双向（同 type 不同 body） | PROTOTYPE-NOTES、draft-v0.1 |
| 0.2.0 | 2026-09-13 | MVP-1 | channel 体系：chat 双向 body 加 `channel`、游戏事件按绑定频道 fan-out；新增 join / leave / status / bindings_updated（**完整列表**推送）；hello_ack 携带 `channelBindings` 快照。服务端健壮性（行为非帧变更）：hello 10s 超时 close 1002、空闲 30s close 1001 | MVP1-NOTES |
| 0.2.1 | 2026-09-13 | DEBT-2 | **仅 IPC 侧**：ready 帧增可选 `autoRestart`；WS 侧无变化、对端无感 | DEBT2-NOTES |
| 0.3.0 | 2026-09-13 | DEBT-1 | `hello.token` 鉴权（失败 close 1008；校验顺序先版本 1002 后鉴权 1008）；**版本协商改主版本兼容区间**（ADR-026）；command / command_result 请求族（body 带 source，管理员判定在服务端）；query / query_result（kind=status/bindings）；death 事件；未知帧两段式容忍；IPC 侧 config_reload、execute_command_result.output | DEBT1-PROMPT、ADR-026/027 |
| 0.3.1 | 2026-09-13 | MVP-3 | `hello.client` 可选自报身份串（仅日志辨识，无行为分支）；配套 config `ws` 监听段（非帧变更） | ADR-028 |
| （无 bump） | 2026-09-14 | MVP-4 | napuketto CLI 嵌入（ADR-029）——协议 0.3.1 **一字不动**；QR 登录走文件交接，主动放弃 IPC 帧方案（即不做 0.3.2） | MVP4-NOTES |
| **0.4.0** | 2026-09-14 | 改名 | **Breaking（唯一）**：握手子协议 `kurobot-ws.v1` → `kurobridge-ws.v1`、`PROTOCOL_NAME` 同步改名（品牌迁移 KuroBot → KuroBridge，ADR-030）。`.v1` 大版本不变，**帧 schema 形状零变化**；one-name-only——旧名对端握手期直接拒绝，不做双名兼容、不做自动迁移。npm scope 同步 `@kurobot/*` → `@kuro-bridge/*` | ADR-030、RENAME-NOTES |
| （拆仓） | 2026-09-15 | KuroProtocol | 本仓建立：自主仓 `59d3be7` 平移（协议内容零改动），接管协议演进；包 `@kuro-bridge/protocol` 版本对齐 **0.4.0** | 本仓决策档案 ADR-001 |

0.1.0 → 0.4.0 的演进发生在主仓 KuroAdapter（出处列的 ADR 编号与阶段册均指主仓台账，见
`src/meta.ts` 版本史注释）；本仓自 0.4.0 起接管协议演进。

## 现行变更流程（四件套同改）

任何协议变更 = 一次提交同时改齐：① `src/` schema ② `docs/protocol/` 规格文档（lifecycle /
frames / ipc 按变更面）③ `fixtures/` 金样本（新版本开新目录，见[金样本契约](fixtures.md)）
④ 本篇（简史加行 + bump 依据）。缺任何一件 = 工作未完成（AGENTS.md 硬性约束）。

语义变更需先在本篇立条目（含出处），再动 schema；协议语义禁止自行发明。
