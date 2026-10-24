<div align="center">

<h1 id="kurobridge-protocol">
  <img src=".github/assets/wordmark.svg" alt="KuroBridge Protocol" width="560">
</h1>

**`kurobridge-ws` 线协议的唯一契约源 —— zod schema、对端规格书与金样本，都从这里出**

<p>
  <sub>发布物</sub> <code>@kuro-bridge/protocol</code>
  &emsp;<sub>协议版本</sub> <code>0.4.0</code>
  &emsp;<sub>握手子协议</sub> <code>kurobridge-ws.v1</code>
  &emsp;<sub>帧面</sub> <code>入站 5 · 出站 10</code>
  &emsp;<sub>许可</sub> <code>MIT</code>
</p>

<p>
  <a href="#契约构成">契约构成</a> •
  <a href="#帧目录">帧目录</a> •
  <a href="#金样本与三方校验">金样本与三方校验</a> •
  <a href="#工作流">工作流</a> •
  <a href="#english">English</a>
</p>

</div>

> [!NOTE]
> **包版本 ≡ 协议版本**：npm 包发到哪个版本，协议就是哪个版本（锚：`src/meta.ts` 的 `PROTOCOL_VERSION`）。\
> 「KuroBridge」是产品与生态统称；本仓是其协议层，仓名 KuroProtocol，发布名 `@kuro-bridge/protocol`。

---

## 生态定位

```text
KuroBridge 生态（协议视角）
│
├─ 协议契约 SSOT · KuroProtocol（← 本仓，独立仓）
│    kurobridge-ws v0.4.0：zod schema + 对端规格书 + 16 份金样本
│    全部实现经 npm 依赖 @kuro-bridge/protocol ^0.4.0 消费
│
├─ MC 侧 · WS 服务端（对端主动连入，服务端不回连）
│    ├─ KuroAdapter · 全量线：Paper JAR + 内嵌 Node 业务核心
│    └─ KuroAdapter-Pure · 纯净线：纯 Java Paper 插件
│
└─ 聊天侧 · WS 客户端（连入上述服务端）
     ├─ Adapter-koishi · 官方对端：koishi-plugin-kurobridge（Koishi v4 插件）
     └─ napukettoqq 等第三方对端
```

所有实现阵营——全量线、纯净线与第三方对端——以本仓为契约源：**帧名与字段以 `src/` 的 zod schema 为唯一可编辑来源**，规格书与金样本是它的投影，不是并列真相。

## 契约构成

| 构件 | 位置 | 角色 |
| :--- | :--- | :--- |
| **Schema** | `src/` | zod schema 全集（线格式骨架 + WS / IPC 帧定义），帧名与字段的 SSOT |
| **规格书** | [`docs/peer-guide.md`](docs/peer-guide.md) | 跨仓对端接入规格：连接语义、握手流程、关闭码、帧语义 |
| **金样本** | `fixtures/v0.4/` | 16 份行为样本 + `SHA256SUMS`，随 npm 包分发的物理契约（格式见 [`docs/fixtures.md`](docs/fixtures.md)） |
| **沿革** | [`docs/changelog.md`](docs/changelog.md) | 协议 0.1 → 0.4.0 简史与 bump 规则 |
| **决策** | [`docs/DECISIONS.md`](docs/DECISIONS.md) | ADR-001~003（SSOT 收口、发布线、镜像冻结） |

版本协商与兼容：`hello` 期对表 `protocolVersion`，主版本号相同即兼容（`isProtocolVersionCompatible`，如 0.2.0 对端可连 0.4.0 服务端）；旧名 `kurobot-ws` 自 0.4.0 起握手期拒绝，无双名兼容。

## 帧目录

对端 → 服务端（`wsInboundFrame`，5 种）：

| 帧 | 用途 | 要点 |
| :--- | :--- | :--- |
| `hello` | 握手 | peerId / platform / version / protocolVersion / token? / client? |
| `ping` | 心跳 | 应用层保活；服务端空闲阈值 30s |
| `chat` | 平台 → 游戏聊天 | 命中服务端绑定频道才广播 |
| `command` | 群指令 → 服务器命令 | 管理员判定在 MC 侧 |
| `query` | 查询 | `status` 或 `bindings` |

服务端 → 对端（`wsOutboundFrame`，10 种）：

| 帧 | 用途 | 要点 |
| :--- | :--- | :--- |
| `hello_ack` | 握手应答 | ok / error；版本不符 close 1002，token 不符 close 1008 |
| `pong` | 心跳应答 | 回应 `ping` |
| `chat` | 游戏 → 平台聊天 | 按绑定频道逐帧 fan-out |
| `join` | 玩家进服 | `channel` + `playerName` |
| `leave` | 玩家退服 | `channel` + `playerName` |
| `death` | 玩家死亡 | `channel` + `player`（字段名与 join / leave 不同，已登记）+ 可空 `message` |
| `status` | 状态快照 | `tps` / `onlinePlayers` / `uptimeSeconds`，无 channel |
| `bindings_updated` | 绑定变更 | 携带完整列表（非增量） |
| `command_result` | 指令结果 | 与请求同 `id`；`ok` 或 `error`（常见 `forbidden`） |
| `query_result` | 查询结果 | 与请求同 `id`；data 形状由请求 kind 决定 |

> IPC 帧（`src/messages/ipc.ts`）属主仓 Java 薄壳 ↔ Node 子进程专用通道，纯净线与 WS 对端不消费。

## 金样本与三方校验

`fixtures/v0.4/` 随 npm 包分发——**装包即得，消费方无需跨仓手拷**（份数以 `SHA256SUMS` 行数为准，勿硬编码）：

| 子目录 | 份数 | 覆盖 |
| :--- | :--- | :--- |
| `handshake/` | 3 | 握手成功；版本不符 close 1002；token 不符 close 1008 |
| `frames/` | 8 | chat 双向、command 往返、forbidden、query 往返、心跳、绑定更新、游戏事件 |
| `tolerance/` | 5 | wire 骨架拒绝、已知类型非法 body、未知 event / request / result 三分支 |

三条校验路径，层层独立：

| 路径 | 方式 | 场景 |
| :--- | :--- | :--- |
| 包内两方校验 | `npx kuro-bridge-verify-fixtures` | 任何消费方装包即验：目录 ↔ `SHA256SUMS` + sha256 实算（bin 以 TS 源码分发，需 Node ≥ 22.18） |
| 程序化消费 | `import { validateFixture } from "@kuro-bridge/protocol"` | 测试与工具内嵌校验（ADR-002 纯函数校验器） |
| 仓内门禁 | `pnpm gate` | 本仓提交前唯一权威门禁（含夹具三方一致 + 版本锚 + 文档死链） |

消费方：KuroProtocol 自身测试、KuroAdapter `golden.fixtures.test.ts`、KuroAdapter-Pure `FixtureConformanceTest`、kurobridge 插件 `golden.fixtures.test.ts`——**任何一方与金样本漂移，对应仓测试立即变红**。

## 工作流

```bash
pnpm install        # mise 提供 Node 26
pnpm check          # biome check + tsc --noEmit（含 scripts/ 独立 tsconfig）
pnpm fix            # biome 自动修复 + tsc
pnpm test           # vitest run（含夹具一致性门禁）
pnpm build          # tsdown 双格式构建（dist/index.mjs + dist/index.cjs，ADR-001）
pnpm gate           # 提交前唯一权威门禁：check + test + build + 夹具三方一致 + 版本锚 + 死链检查
```

## 硬性规则

> [!CAUTION]
> **四件套同改**：任何协议变更 = 一次提交同时改齐 ① `src/` schema ② `docs/peer-guide.md` ③ `fixtures/` 金样本 ④ `docs/changelog.md`。缺一即门禁红。

> [!CAUTION]
> **`src/` 零 Node API**：协议包必须在任意 JS 运行时可用；包版本 ≡ 协议版本，发布只能从本仓出（操作手册见 [`docs/RELEASE.md`](docs/RELEASE.md)）。完整约束见 [AGENTS.md](AGENTS.md)。

## 发布状态

- **现行**：`@kuro-bridge/protocol@0.4.0`（npm `latest`，2026-09-18 上架），tag `v0.4.0` 已推远端。
- **旧线**：`0.1.0`（2026-09-15 拆仓前夜自主仓 `bridge/protocol` 误发：包版本与内嵌协议版本错位、exports 缺 require）已 deprecate。
- 背景与事故记录见 [`docs/DECISIONS.md`](docs/DECISIONS.md) ADR-001。

## 来源

2026-09-15 自主仓 KuroAdapter（commit `59d3be7`）`bridge/protocol/` 平移拆分，协议内容零改动；canonical 远端 `Kuro-Bridge/KuroProtocol`。

---

## English

KuroProtocol is the single source of truth for the `kurobridge-ws` wire protocol: zod schemas (authoritative), the cross-repo peer guide, and 16 golden fixtures shipped inside the npm package `@kuro-bridge/protocol` (package version = protocol version). All KuroBridge implementations — the full-line KuroAdapter, the pure-Java KuroAdapter-Pure, and the Koishi peer — consume this package and fail their tests on any drift.

```bash
pnpm install && pnpm gate
```

*Released under the [MIT License](./LICENSE).*
