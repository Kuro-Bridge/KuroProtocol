# IPC 内部通道（Java 薄壳 ↔ Node 子进程）

> 本文描述 `src/messages/ipc.ts` 定义的帧语义。该通道是主仓 KuroAdapter 全量线专用（Paper
> 插件 Java 薄壳 ↔ 内嵌 Node 业务核心），纯净线（KuroAdapter-Pure）与 WS 对端不消费。

## 通道定位

- 传输：stdin/stdout **JSON-lines**（每行一帧，复用 WS 线格式，决策 D-04）。
- 两端同仓同版发布（lockstep）：**不做未知帧容忍**——未知帧 = 版本错位 bug，保持 warn + 丢弃
  响亮暴露（与 WS 侧的容忍策略相反，后者是对端版本浮动的安全网）。
- 命名对齐：IPC 帧名描述 Bukkit 事件源（`game_chat` / `player_join` / `player_death`），WS 帧
  名是协议事件（`chat` / `join` / `death`）。`channel` 概念只在 Node 侧业务存在，IPC 帧一律不
  携带（Java 零业务）；channel fan-out 是 Node 侧职责。
- 事件帧无 id、请求/响应帧同 id 关联（与 WS 一致）。

## Node → Java

| 帧 | 类型 | body 字段 | 说明 |
|---|---|---|---|
| `ready` | 事件 | `wsPort`: int（正）、`autoRestart`: boolean（可选，缺省 true） | WS 服务端已就绪，携带动态端口；`autoRestart` 上报宿主自动重启开关（业务配置 `runtime.autoRestart`，Java 侧 null 按 true 处理） |
| `broadcast` | 请求（id） | `channel`、`message`（均非空） | 游戏内广播请求。Java 侧 MVP 只广播不区分频道，`channel` 字段保留给未来按频道渲染 |
| `execute_command` | 请求（id） | `command`（非空） | 执行服务器命令请求 |

## Java → Node

| 帧 | 类型 | body 字段 | 说明 |
|---|---|---|---|
| `game_chat` | 事件 | `playerName`、`content` | 游戏聊天（Bukkit 事件桥接产生） |
| `player_join` | 事件 | `playerName` | 玩家进服（PlayerJoinEvent 桥接） |
| `player_quit` | 事件 | `playerName` | 玩家退服（PlayerQuitEvent 桥接） |
| `player_death` | 事件 | `player`、`message`（**允许空串**） | 玩家死亡（PlayerDeathEvent 桥接）；`message` 为 deathMessage 的 plain 序列化，可为 null → Java 侧以空串兜底。字段名 `player` 与 WS `death` 帧一致（与 join/quit 的 `playerName` 不同，历史命名，已登记） |
| `status` | 事件 | `tps`、`onlinePlayers`、`uptimeSeconds` | 服务器状态（Java 在 join/quit 时机推送，与 WS status body 同构） |
| `shutdown` | 事件 | `reason`（非空） | 关机通知；随后 Java 会关 stdin，stdin EOF 为最终兜底（决策 D-08） |
| `config_reload` | 事件 | 空对象 `{}` | 配置重载通知（`/kurobridge reload` 触发，v0.3.0）；无参数——重载后 core 重读全部配置。未来若需携带来源等再以非必填字段扩展（zod 默认剥离未知键，旧 Node 收到带额外字段的帧不炸） |
| `broadcast_result` | 响应（同 id） | `{ok:true}` 或 `{ok:false, error}` | broadcast 的响应（通用结果体） |
| `execute_command_result` | 响应（同 id） | ok：`{ok:true, output?: string[]}`；error：`{ok:false, error}` | execute_command 的响应（命令结果体，v0.3.0 增可选 `output`——收集型 CommandSender 回传的命令输出行，空输出不产生字段；与 WS `command_result` 共用结果体） |

## 聚合 union（决策 D-09：平铺 union）

- `ipcNodeInboundFrame`（Node 收帧集）：`game_chat` / `player_join` / `player_quit` /
  `player_death` / `status` / `config_reload` / `broadcast_result` / `execute_command_result` /
  `shutdown`。
- `ipcJavaInboundFrame`（Java 收帧集）：`ready` / `broadcast` / `execute_command`。
