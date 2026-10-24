# 帧格式与帧目录

> 帧名与字段以本仓 `src/` 的 zod schema 为 SSOT（`src/frame.ts` 骨架、`src/messages/ws.ts`
> 逐帧定义）；本文与 schema 冲突时以 schema 为准并回改本文。连接/握手语义见
> [连接生命周期](lifecycle.md)，IPC 内部通道见 [IPC 内部通道](ipc.md)。

## 线格式

单条 WS **文本帧** = 一行 JSON（UTF-8），与 IPC 共用（决策 D-04）：

```json
{"header": {"type": "<帧名>", "id": "<UUID>"}, "body": {}}
```

| 规则 | 说明 |
|---|---|
| 帧名 `type` | 全小写 snake_case（`^[a-z][a-z0-9_]*$`） |
| **请求/响应帧**（成对） | `id` **必填**，UUID；响应复用请求的 id 做关联 |
| **事件帧**（单向） | **无 id**；携带 id 会被校验拒绝（尽早暴露方向用错） |
| 未知字段 | 服务端非严格校验：body 里的多余字段会被剥离（不报错） |

id 规则总览：`hello`/`ping`/`command`/`query` 是请求（id 必填）；`hello_ack`/`pong`/
`command_result`/`query_result` 是响应（同 id 回）；其余为事件（无 id）。

## 帧目录：对端 → 服务端（`wsInboundFrame`，5 帧）

| 帧 | 类型 | body 字段 | 说明 |
|---|---|---|---|
| `hello` | 请求（id） | 见[lifecycle 字段表](lifecycle.md) | 握手（必须首帧） |
| `ping` | 请求（id） | `timestamp`: number（整数 ≥0） | 心跳；响应 `pong` |
| `chat` | 事件（无 id） | `channel`、`sender`、`content`（均非空 string） | 平台 → 游戏聊天。`channel` 未绑定进服务端绑定表时被服务端静默丢弃（debug 日志） |
| `command` | 请求（id） | `command`（非空 string）、`source`: `{channel, userId}`（均非空） | 执行服务器命令。`command` **不含前导斜杠**（`"whitelist list"` 而非 `"/whitelist list"`）；`source.userId` = 群成员 QQ 号。响应 `command_result` |
| `query` | 请求（id） | `kind`: `"status"` \| `"bindings"` | 状态/绑定查询。响应 `query_result` |

### command 语义细节

- 管理员判定在**服务端**：`source.channel` + `source.userId` 命中服务端配置 `admins`
  （`{channel, users[]}`，userId = QQ 号）才执行；否则 `command_result {ok:false,
  error:"forbidden"}`（不触发执行）。
- 执行者语义 = 服务器控制台（`say` 等命令以 CONSOLE 名义生效）。
- 长命令（如 `whitelist add`）可能数秒才回——请求-响应按 id 异步关联，不要同步阻塞假设立即
  返回；服务端 IPC 超时 10s，超时回 `{ok:false, error:"..."}`。
- 命令输出行（若有）在 ok 分支的 `output: string[]`（可能缺省 = 无输出）。

### query 响应细节

- `kind=status`：ok 分支 `data` = `{"tps": <number>, "onlinePlayers": <int>, "uptimeSeconds": <int>}`
  （StatusBody 同构）。服务端自最近一帧 `status` 事件后才有缓存——从未收到过时回
  `{ok:false, error:"no status yet"}`。
- `kind=bindings`：ok 分支 `data` = 当前绑定频道 `string[]`（实时快照）。

## 帧目录：服务端 → 对端（`wsOutboundFrame`，10 帧）

| 帧 | 类型 | body 字段 | 说明 |
|---|---|---|---|
| `hello_ack` | 响应（同 hello id） | 见[lifecycle](lifecycle.md) | 握手结果 |
| `pong` | 响应（同 ping id） | `timestamp`（原样回显） | 心跳应答 |
| `chat` | 事件 | `channel`、`playerName`、`content` | 游戏 → 平台聊天（玩家在游戏内发言） |
| `join` | 事件 | `channel`、`playerName` | 玩家进服 |
| `leave` | 事件 | `channel`、`playerName` | 玩家退服 |
| `death` | 事件 | `channel`、`player`、`message`（**允许空串**） | 玩家死亡；`message` = 原生死亡消息文本（deathMessage 为 null 时为空串）。注意字段名是 `player`（与 join/leave 的 `playerName` 不一致，历史原因） |
| `status` | 事件 | `tps`: number（≥0）、`onlinePlayers`: int（≥0）、`uptimeSeconds`: int（≥0） | 服务器状态。**无 channel**（全服状态而非频道消息）；推送时机为事件驱动（玩家进出服时），无周期推送 |
| `bindings_updated` | 事件 | `channelBindings`: string[] | 绑定表变更推送——**变更后完整列表**（非增量） |
| `command_result` | 响应（同 command id） | ok：`{ok:true, output?: string[]}`；error：`{ok:false, error}` | 命令执行结果；`output` 缺省 = 无输出 |
| `query_result` | 响应（同 query id） | ok：`{ok:true, data}`；error：`{ok:false, error}` | `data` 形状由请求 `kind` 决定（见上） |

**fan-out 语义**：`chat`/`join`/`leave`/`death` 服务端按绑定频道逐频道发**一帧一频道**
（`channel` 字段即本帧所属频道）——对端按 `channel`（群号）路由到对应群。全部绑定频道都未命中
你的平台时收不到对应帧；`status` 例外（无频道，全体对端都收）。

## 未知帧容忍（服务端行为，对端建议镜像）

主版本兼容区间（见[lifecycle](lifecycle.md)）意味着对端可能收到自己不认识的帧。服务端收帧侧
行为如下（建议对端实现同等容忍，至少**不因未知帧断连**）：

- 未知**请求帧**（带 id）→ 服务端回同 id 的 `<type>_result` 帧 `{ok:false,
  error:"unknown frame type"}`，不断连。
- 未知**事件帧**（无 id）→ 忽略 + debug 日志，不断连。
- 未知 `<type>_result` 响应帧（对端回了服务端不认识的响应）→ 忽略不回执（防乒乓循环）。

## 完整时序示例

以下为一次完整会话（`P→` 对端发出，`S→` 服务端发出；JSON 为便于阅读做了换行美化，
**实际线格式为单行文本**）：

```
# 1. WS 升级：GET ws://mc.example.com:25580，头带 Sec-WebSocket-Protocol: kurobridge-ws.v1
P→ {"header":{"type":"hello","id":"3f9d2c1e-8b4a-4c3e-9a2d-7f1e5b6c8d90"},
    "body":{"peerId":"napuketto-01","platform":"qq","version":"1.0.0",
            "protocolVersion":"0.4.0","token":"s3cret","client":"napukettoqq/1.0"}}
S→ {"header":{"type":"hello_ack","id":"3f9d2c1e-8b4a-4c3e-9a2d-7f1e5b6c8d90"},
    "body":{"ok":true,"serverId":"kurobridge-spike","version":"0.1.0",
            "protocolVersion":"0.4.0","channelBindings":["114514","1919810"]}}

# 2. 心跳（周期 5–15s）
P→ {"header":{"type":"ping","id":"a1b2c3d4-1111-4222-8333-444455556666"},
    "body":{"timestamp":1760000000000}}
S→ {"header":{"type":"pong","id":"a1b2c3d4-1111-4222-8333-444455556666"},
    "body":{"timestamp":1760000000000}}

# 3. 游戏 → 平台（每绑定频道一帧）
S→ {"header":{"type":"chat"},"body":{"channel":"114514","playerName":"Steve","content":"大家好"}}
S→ {"header":{"type":"join"},"body":{"channel":"114514","playerName":"Alex"}}
S→ {"header":{"type":"status"},"body":{"tps":20,"onlinePlayers":2,"uptimeSeconds":3600}}

# 4. 平台 → 游戏（命中绑定频道才进游戏广播）
P→ {"header":{"type":"chat"},"body":{"channel":"114514","sender":"群友A","content":"你好 MC"}}

# 5. 群指令往返（管理员判定在服务端）
P→ {"header":{"type":"command","id":"c0ffee00-0000-4000-8000-000000000001"},
    "body":{"command":"whitelist list","source":{"channel":"114514","userId":"10001"}}}
S→ {"header":{"type":"command_result","id":"c0ffee00-0000-4000-8000-000000000001"},
    "body":{"ok":true,"output":["There are 1 whitelisted player(s): Steve"]}}
# 非管理员同请求 → {"ok":false,"error":"forbidden"}

# 6. 查询往返
P→ {"header":{"type":"query","id":"c0ffee00-0000-4000-8000-000000000002"},"body":{"kind":"bindings"}}
S→ {"header":{"type":"query_result","id":"c0ffee00-0000-4000-8000-000000000002"},
    "body":{"ok":true,"data":["114514","1919810"]}}
P→ {"header":{"type":"query","id":"c0ffee00-0000-4000-8000-000000000003"},"body":{"kind":"status"}}
S→ {"header":{"type":"query_result","id":"c0ffee00-0000-4000-8000-000000000003"},
    "body":{"ok":true,"data":{"tps":20,"onlinePlayers":2,"uptimeSeconds":3600}}}

# 7. 服务端配置热重载 → 绑定变更推送（完整列表）
S→ {"header":{"type":"bindings_updated"},"body":{"channelBindings":["114514","1919810","233333"]}}

# 8. 玩家死亡（message 可为空串；注意字段名是 player）
S→ {"header":{"type":"death"},"body":{"channel":"114514","player":"Steve","message":"Steve fell from a high place"}}

# 9. 服务端关机
S→ close(1001, "server shutdown")   → 对端指数退避重连（重连策略见[连接生命周期](lifecycle.md)）
```
