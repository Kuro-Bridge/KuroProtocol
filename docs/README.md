# KuroProtocol 文档索引

kurobridge-ws 协议的文档入口。帧名与字段的唯一事实来源是 `src/` 的 zod schema——任何文档与
schema 冲突时以 schema 为准并回改文档（AGENTS.md 硬性约束）。

## 按读者意图导航

| 你要做的事 | 读这些 |
|---|---|
| 实现 WS 对端客户端（协议端） | [连接生命周期](protocol/lifecycle.md) → [帧目录](protocol/frames.md) → [对端业务约定](guides/peer-conventions.md) |
| 主仓 IPC 接线（Java 薄壳 ↔ Node 子进程） | [IPC 内部通道](protocol/ipc.md) |
| 演进协议、判断版本 bump | [版本模型与 bump 规则](protocol/versioning.md) |
| 消费 / 维护金样本 | [金样本契约](protocol/fixtures.md) |
| 理解本包结构与设计 | [架构总览](architecture/overview.md)、[决策档案](architecture/decisions.md) |
| 发布新版本（OIDC 流水线） | [发布手册](guides/release.md) |

## 仓库地图

- `src/` —— zod schema SSOT（`meta` / `frame` / `messages/ws` / `messages/ipc` / `fixtures` / `index`）
- `fixtures/v0.4/` —— 16 份金样本 + `SHA256SUMS`，随 npm 包分发的物理契约
- `scripts/` —— 门禁脚本（金样本三方校验、版本锚、文档死链），盘点见 [scripts/readme.md](../scripts/readme.md)
- `.github/workflows/` —— CI 门禁（`ci.yml`）与发布流水线（`release.yml`：prepare → publish（OIDC + environment 审批）→ tag）
- 工作流与硬性约束见仓库根 [AGENTS.md](../AGENTS.md)

## 旧文档去向

原 `peer-guide.md` 已按职责拆分（2026-10），各节映射：

| 原章节 | 现位置 |
|---|---|
| §0 角色与拓扑 / §1 连接建立 / §3 握手·协商·鉴权 / §4 心跳 / §7 重连 / §8 安全基线 | [protocol/lifecycle.md](protocol/lifecycle.md) |
| §2 帧格式 / §5 帧目录 / §5.3 未知帧容忍 / §9 完整时序 | [protocol/frames.md](protocol/frames.md) |
| §6 业务约定（QQ 群服互通） | [guides/peer-conventions.md](guides/peer-conventions.md) |
| §10 版本演进速查 | [protocol/versioning.md](protocol/versioning.md) |

其余旧文档：`design.md` 重写为 [architecture/overview.md](architecture/overview.md)；
`DECISIONS.md`（ADR-001~003）压缩为 [architecture/decisions.md](architecture/decisions.md)；
`changelog.md` 并入 [protocol/versioning.md](protocol/versioning.md)；`RELEASE.md` 精简为
[guides/release.md](guides/release.md)；`BOOTSTRAP-NOTES.md` 与 `MIRROR-RESYNC.md` 为历史迁移
/已退役机制的实录，直接删除（来源仓事实已在根 README 与 AGENTS.md 登记）。
