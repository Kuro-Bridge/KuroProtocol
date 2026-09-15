# 金样本夹具（fixtures）

> **物理契约**：`fixtures/v<版本>/` 是 KuroBridge 生态实现阵营的跨仓一致性样本——消费方（如
> KuroAdapter-Pure 的 JUnit 测试）按 pin 版本整目录拷贝进自己的测试资源消费；TS 侧由
> `src/fixtures.test.ts` 做一致性门禁（正样本必须被 zod parse 通过、拒绝样本必须被拒）。
> 格式变更属协议仓结构性变更，须同步更新本文件与所有消费方。

## 目录结构

```
fixtures/
└── v0.4/
    ├── handshake/    握手链路：成功 / 版本协商拒绝 / token 鉴权拒绝
    ├── frames/       业务帧：chat 双向、command、query、心跳、bindings_updated
    └── tolerance/    两段式解析与未知帧容忍：wire 骨架拒绝 / dispatch 拒绝 / 未知帧三分支
```

每份 JSON = 一个场景。目录只随协议版本新增（`fixtures/v0.5/`…），已发布版本目录内的夹具不修改。

## 字段格式

```json
{
    "name": "handshake-hello-success",
    "note": "场景说明（人类阅读）",
    "source": "出处（主仓 SHA + 文件 + 用例名）",
    "frames": [
        {
            "dir": "peer->server",
            "frame": { "header": { "type": "hello", "id": "<uuid>" }, "body": {} }
        }
    ],
    "expect": {
        "schema": "accept",
        "reject": { "stage": "wire" },
        "behavior": { "reply": "frames[1]", "close": { "code": 1002, "reason": "..." } }
    }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | kebab-case 场景名，仓内唯一 |
| `note` | 是 | 场景语义说明 |
| `source` | 是 | 样本出处（主仓 commit SHA + 文件 + 用例名），保证可溯源 |
| `frames[].dir` | 是 | `"peer->server"`（对端→服务端，用 `wsInboundFrame` 校验）或 `"server->peer"`（服务端→对端，用 `wsOutboundFrame`） |
| `frames[].frame` | 是 | 线格式帧原样（`{header, body}`，未摊平） |
| `expect.schema` | 是 | `"accept"`：每帧按方向 schema 解析必须通过；`"reject"`：见 `reject.stage` |
| `expect.reject.stage` | reject 时必填 | `"wire"`：每帧连 `wireFrameSchema` 骨架都必须拒绝（type 违反 snake_case、id 非 UUID、缺 header 等）；`"dispatch"`：每帧过 wire 骨架、但方向 schema 拒绝（两段式解析第二段：未知 type、已知 type 但 body 非法、事件帧带 id 等） |
| `expect.behavior` | 是 | 行为契约**注记**（非 zod 可验，供消费方测试实现）：`reply` = 期望回执帧（`"frames[N]"` 引用本文件第 N 帧，或 `null`）；`close` = 期望关闭行为（`{code, reason}` 或 `null`）。TS 门禁只校验其形状 |

## 约定

- **reject 样本要求每一帧命中同一拒绝阶段**；混合场景（如先骨架合法帧、后骨架非法帧）拆成多份文件。
- `behavior.reply` 引用的回执帧本身也放在 `frames` 里（`dir` 按其方向），这样回执内容同样被
  schema 门禁覆盖。
- 事件帧不带 `id`、请求/响应帧必带 UUID `id`——这是被校验的契约本身，不是夹具的装饰。

## 维护（四件套同改的一环）

- 协议任何变更 = src schema + `docs/peer-guide.md` + fixtures + `docs/changelog.md` 同批落地。
- TS 门禁 `src/fixtures.test.ts` 以**静态 import** 逐份消费（保持 src 零 Node API）——新增夹具
  需在门禁文件登记 import 与期望。
- 消费方（如 KuroAdapter-Pure）拷贝时在测试资源旁留 pin 记录（来源仓 + 版本 + 日期）。
