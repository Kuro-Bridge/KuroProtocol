# KuroProtocol 决策记录（DECISIONS）

> 形态对齐主仓 `docs/DECISIONS.md`：每项记录背景 → 选项 → 结论 → 理由，编号按时间序，永不改写历史。
> 本台账只记**本仓**的决策；协议历史 ADR（ADR-001~030，如 ADR-008 zod SSOT、ADR-030 改名）见
> 主仓 KuroAdapter 的 `docs/DECISIONS.md`——changelog 等文档引用的 ADR 编号默认指那份。

---

## ADR-001 协议 SSOT 收口：主仓镜像冻结 + 发布线切换 0.4.0（2026-09-16）

> 本仓建立后第一次重大架构决策，也是 MC-Ecosystem 降熵行动 1/3（协议 SSOT 收口线）的决策档案。
> 执行实录与主仓侧对应改动见主仓 ADR-031。

### 背景：三线纠缠的事实全景（均经 2026-09-16 实证）

2026-09-15 本仓自主仓 `59d3be7` 平移拆分后，「协议 schema 只有一个可编辑来源」并未真正成立，
三线互相纠缠：

1. **声明双头**：本仓、根 README、KuroAdapter-Pure 均指认本仓 `src/` 为 SSOT；但主仓
   KuroAdapter 的全部文档（AGENTS.md 硬性约束 4、readme、architecture、history/README、
   包自述 description）仍自称 `bridge/protocol` 是「唯一来源」，且全仓 grep "KuroProtocol"
   **零命中**——主仓对拆仓零认知。
2. **物理双份**：主仓 `bridge/protocol/src` 8 个文件与本仓 `src/` 字节级一致（平移后主仓
   HEAD 未再动 src），但它是 pnpm workspace 活成员——主仓 `bridge/core`、`bridge/embedded`、
   `platforms/be/lse` 三个消费方全部以 `workspace:*` 绑定仓内副本，随时可以就地分叉。
3. **发布线倒挂**：npm 上唯一已发布版本 `@kuro-bridge/protocol@0.1.0`（2026-09-15 15:15 UTC，
   publisher oppenheimu）**不是从本仓发布的**——它来自主仓 `bridge/protocol`（主仓当时存在
   未提交的版本 bump 0.0.0 → 0.1.0，见 BOOTSTRAP-NOTES §0 与 koishi-dev 侧 KUROBRIDGE-NOTES
   KD-09）。该发布件内部两轴错位：包版本 0.1.0，内嵌 `PROTOCOL_VERSION` 却是 0.4.0；且
   `exports` 只有 `import` 条件、缺 `require`（CJS 消费方解析失败，官方对端 koishi 插件被迫
   `alwaysBundle` 内联绕行，KD-10）。对端依赖声明 `^0.1.0`（0.x 语义区间 `>=0.1.0 <0.2.0`），
   未来按「包版本 ≡ 协议版本」发布 0.4.0 时该范围**接不到**。
4. **文档版本口径漂移**：peer-guide 正文版本行停留 0.3.1（本仓以声明头 + changelog 勘误覆盖，
   主仓侧无任何覆盖）；版本速查表止于 0.3.1；主仓 STATUS/readme 把 0.3.1 的文档当作
   0.4.0 的实现依据引用。

### 选项

| 方案 | 内容 | 评估 |
|---|---|---|
| A. 立即删除主仓副本，改依赖 npm 包 | 主仓三消费方 `"@kuro-bridge/protocol": "^0.4.0"` | **被账号操作阻塞**：本仓 0.4.0 尚未发布（registry 只有旧线 0.1.0），立删 = 主仓工作区不可安装。这是终态，但不是当下 |
| B. 立即删除主仓副本，`link:` 指向本仓 | 消费方 `"link:../../KuroProtocol"` | 物理单份，但引入跨仓路径耦合：单克隆 KuroAdapter 无法安装、构建顺序新增「先 build KuroProtocol」硬依赖；pnpm workspace 语义被绕开；事故面反而扩大 |
| C. **冻结副本为只读镜像 + 一致性门禁** | 副本 src 保留（构建链零改动），身份从「SSOT」降级为「KuroProtocol 的只读镜像」；新增门禁脚本字节级校验镜像与本仓 `src/` 一致，挂进 pre-commit；包加 `private: true` 封死误发布 | 立即可执行、不依赖账号；「唯一可编辑来源」通过门禁强制（在主仓改协议 → 门禁红，唯一合法路径是改本仓再同步）；镜像的存在从隐性债变为显式登记的受控机制（对齐 Koishi-CE「不可避免时命名镜像并写明同步义务」纪律） |
| D. 只改文档不动代码 | 声明对齐但副本仍可自由编辑 | 违背收口目标：schema 实际仍有两个可编辑来源，方案无效 |

### 结论

**选 C 作为阶段 1（2026-09-16 执行），A 为阶段 2 终态（待发布条件就绪）**：

1. 主仓 `bridge/protocol/` 冻结为**只读镜像**：镜像范围 = `src/` 下 8 个 TS 文件
   （frame / index / index.test / meta / messages×4），须与本仓 `src/` 字节级一致；
   由主仓 `scripts/check-protocol-mirror.mjs`（`pnpm check:protocol`，挂 lefthook pre-commit）
   强制。协议演进的唯一合法路径 = 改本仓（四件套同改）→ 主仓同步镜像 → 门禁绿。
2. 主仓协议包 `bridge/protocol/package.json`：`version` 回滚 **0.0.0**（纯 workspace 内部占位，
   不参与任何版本轴）+ **`private: true`**（封死再次从主仓误发 npm 的路径——0.1.0 事故的
   根因通道）+ description 改为镜像声明。悬案处置依据见下节。
3. 本仓为 0.4.0 首发做构建修复：tsdown 双格式产物（esm + cjs）+ `exports` 补 `require`
   条件（消除 KD-10 的 CJS 断裂在 0.4.0 重演的可能）。
4. 阶段 2（待办，见文末命令清单）：本仓发布 0.4.0 → deprecate npm 0.1.0 → 主仓删镜像、
   三消费方切 `^0.4.0` → 上游对端（koishi 插件）切依赖范围并移除 `alwaysBundle` 绕行。

### npm 0.1.0 事故记录（2026-09-15）

- **事故**：`@kuro-bridge/protocol@0.1.0` 从主仓 `bridge/protocol` 发布（非本仓），包版本轴
  0.1.0 与内嵌协议版本 0.4.0 错位；发布件 `exports` 缺 `require`，CJS 消费方（Koishi loader）
  解析失败。
- **根因**：①主仓副本当时自称 SSOT 且未设 `private`，发布通道无拦截；②「内部 0.0.0/0.1.0
  机制」与「包版本 ≡ 协议版本」两套心智并存，bump 0.0.0 → 0.1.0 的未提交改动即其产物；
  ③发布前未验证 CJS 入口。
- **处置**：本 ADR 阶段 1 封通道（主仓包 `private: true` + 版本轴归零）；阶段 2 deprecate。
- **根本原则**：**发布只能从 SSOT 仓出**——包版本 ≡ 协议版本的语义只在 SSOT 仓成立；
  任何「同名包的第二份 package.json」都必须 `private`。

### 悬案处置：主仓未提交的 0.0.0 → 0.1.0 bump

该改动是 2026-09-15 晚为发布 npm 0.1.0 而 bump、发布后滞留工作区（BOOTSTRAP-NOTES §0 声明
bootstrap 未触碰）。处置 = **回滚到 0.0.0 并吸收进本 ADR**：0.1.0 的存在意义（对外发布）已由
本仓接管，主仓副本回归纯内部镜像后版本号不再有任何对外语义；0.0.0 表达「内部占位、非发布线」，
配合 `private: true` 双保险。发布事实不掩盖——由本 ADR 事故记录 + changelog 勘误承载。

### 对构建链的影响

- 主仓：构建链**零改动**——`pnpm-workspace.yaml`、三消费方的 `workspace:*`、esbuild/tsdown
  构建顺序全部不变；新增的只有一条只读检查命令（`pnpm check:protocol`，进 pre-commit）。
- 本仓：构建产物从单 ESM（`dist/index.mjs`）扩展为 ESM + CJS（`dist/index.cjs`）+ 双格式
  dts；`exports` 增加 `require` 条件。`src/` 零 Node API 约束不受影响（tsdown 配置在 src 外）。
- KuroAdapter-Pure：零影响（消费的是 fixtures 拷贝 + 人工常量副本，机制不变；改进建议见文末）。

### 回滚方式

- 主仓文档与 ADR-031：git revert 对应 commit 即可。
- 镜像门禁：从 lefthook.yml 删 `check-protocol` 段 + revert 脚本 commit。
- 主仓包 `version`/`private`：revert `chore` commit（若已误发 0.0.0 需 npm deprecate——但
  `private: true` 本身即防此事故）。
- 本仓 CJS 产物：revert tsdown 配置 + package.json exports commit（发布 0.4.0 之前随时可退）。

### 阶段 2 待办（需账号 / 上游协作，非本 ADR 执行范围）

```bash
# 1) 本仓首发 0.4.0（在 KuroProtocol 仓，前提：npm org kuro-bridge 可发包）
pnpm build && pnpm check && pnpm test
pnpm publish --access public

# 2) deprecate 旧线发布（包版本轴错位的 0.1.0）
npm deprecate @kuro-bridge/protocol@0.1.0 \
  "published from the wrong repo (pre-SSOT); use 0.4.0+ from KuroProtocol — package version now equals protocol version"

# 3) 主仓切依赖（KuroAdapter 仓，删 bridge/protocol 镜像与门禁脚本）
#    bridge/core、bridge/embedded、platforms/be/lse 的
#    "@kuro-bridge/protocol": "workspace:*" → "^0.4.0"；pnpm-workspace.yaml 去掉 protocol

# 4) 上游对端（koishi-dev/external/kurobridge，独立仓，需上游协作）
#    "@kuro-bridge/protocol": "^0.1.0" → "^0.4.0"；移除 tsdown alwaysBundle 绕行（新包 exports 已含 require）
```

### 附：fixtures 同步机制改进建议（KuroAdapter-Pure 侧，本仓只记录不实施）

Pure 以「整目录拷贝 + PIN.md 登记（仓路径/协议版本/拷贝日期）+ 测试断言 16 份齐全」消费
`fixtures/v0.4/`，当前逐字节一致、无漂移。机制性弱点与建议（实施归 Pure 仓维护者）：

1. **PIN.md 不含 commit hash**——无法回答「pin 的是 KuroProtocol 的哪个提交」。建议补记
   `KuroProtocol commit` 字段。
2. **守卫只数份数、不校验内容**——建议消费方按本仓 `fixtures/v0.4/SHA256SUMS`（本 ADR 同批新增）
   校验拷贝件 hash，拷贝错版本目录时守卫能红。
3. `ProtocolVersions.java` 人工常量副本（D-08 已登记）三步同步流程维持，PIN 补 hash 后第 1、
   2 步之间增加「校验 SHA256SUMS」半步即可，不引入构建依赖。
