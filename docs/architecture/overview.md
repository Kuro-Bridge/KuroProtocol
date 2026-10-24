# 架构总览（@kuro-bridge/protocol）

本包是 `kurobridge-ws` 线协议消息类型的 **zod schema SSOT**：全项目唯一的消息类型来源，
任何文件（含姊妹仓）禁止手写消息类型，必须 `import { ... } from "@kuro-bridge/protocol"`。

## 硬约束

- **零框架依赖**：运行时仅 zod，零 Node API（tsconfig `types: []` 强制），任意 JS 运行时
  （含 QuickJS/LSE）可跑。
- **schema 即产物**：类型全部 `z.infer` 推导，无代码生成步骤。
- **消费方运行时验证**：对端数据不可信，一律 `schema.safeParse()`。

## 模块地图

| 模块 | 职责 |
|---|---|
| `src/meta.ts` | 协议名 `kurobridge-ws`、`PROTOCOL_VERSION`、WS 子协议 `kurobridge-ws.v1`、主版本兼容判定 `isProtocolVersionCompatible` |
| `src/frame.ts` | 线格式骨架与帧工厂：`wireFrameSchema`、`eventFrameSchema` / `requestFrameSchema`、`encodeFrame`、通用结果体 |
| `src/messages/ws.ts` | WS 侧全部帧 schema：对端→服务端 5 帧、服务端→对端 10 帧、双向聚合 union、`WS_INBOUND_TYPES` 已知类型清单 |
| `src/messages/ipc.ts` | IPC 侧帧 schema（Java 薄壳 ↔ Node 子进程内部通道），语义见 [IPC 内部通道](../protocol/ipc.md) |
| `src/fixtures.ts` | 金样本契约校验纯函数 `validateFixture`（元 schema + 四层一致性规则） |
| `src/index.ts` | 聚合导出面（帧 schema 与类型、聚合 union、版本常量、fixtures 校验器） |

## 帧层设计

### 线格式

单条 WS 文本帧 / 一行 IPC JSON-lines 共用同一结构（决策 D-04）：

```json
{"header": {"type": "hello", "id": "<uuid>"}, "body": {}}
```

- `type` 全小写 snake_case（`^[a-z][a-z0-9_]*$`）。
- 请求/响应帧 `id` 必填（UUID，响应复用请求 id 关联）；事件帧无 id——携带 id 会被校验拒绝，
  尽早暴露方向用错。

### 两段式解析

收帧侧先以通用骨架 `wireFrameSchema`（`{header:{type,id?}, body:unknown}`）取 `type`，再分发
到具体方向 schema（ADR-026）。`type` 不在 `WS_INBOUND_TYPES` 清单内走未知帧容忍路径；在清单
内但具体校验失败则 warn 丢弃。容忍行为本身在服务端 core 实现，协议包只提供骨架 schema 与
已知类型清单。

### 扁平消息 transform

解析成功后 transform 为扁平消息 `{ type, id?, body }`（决策 D-11）：TS 无法对嵌套判别
（`obj.header.type`）收窄，扁平化后消费方可直接 switch/if 收窄。线格式不变，Java 侧不受影响。

### 帧工厂与聚合

- `eventFrameSchema(type, body)` / `requestFrameSchema(type, body)` 把 id 规则编码进 schema：
  事件帧严格拒绝 id，请求帧强制 UUID。
- 方向聚合 union（`wsInboundFrame` / `wsOutboundFrame` / `ipcNodeInboundFrame` /
  `ipcJavaInboundFrame`）采用平铺 `z.union([...])`（决策 D-09）：zod 4 不支持嵌套判别路径
  （`z.discriminatedUnion("header.type")` 抛错），每个消息的帧 schema 单独导出，消费方按方向选用。
- 出帧 `encodeFrame`：扁平消息 → 单行 JSON 文本，可直接走 WS 文本帧与 IPC JSON-lines。

### 通用结果体

- `resultBodySchema`：`{ok:true}` 或 `{ok:false, error}`（IPC `broadcast_result` 等）。
- `commandResultBodySchema`（v0.3.0）：ok 分支增可选 `output: string[]`（命令输出行，收集型
  CommandSender 回传；空输出不产生字段）。IPC `execute_command_result` 与 WS `command_result`
  共用此结果体。
