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

---

## ADR-002 fixtures 契约校验导出面：validateFixture 纯函数（2026-09-17）

> 长程并行线 1/3（契约可分发化）决策之一；依据 = 2026-09-17 三路勘察实证。

### 背景

ADR-001 收口后，金样本的「物理半边」已冻结，但其格式契约校验逻辑全部内联在
`src/fixtures.test.ts`（fixtureSchema 元 schema、reject.stage 声明一致性、accept/reject ×
wire/dispatch 三分支、behavior.reply 引用格式），模块私有且与 vitest `expect` 耦合——包
消费方不可达。三个实现阵营对同一契约的验证深度不齐：主仓靠镜像门禁、KuroAdapter-Pure
手拷 JSON 后以 Java 重写同一套三分支逻辑（FixtureConformanceTest.java）、koishi 对端未接
金样本。「同一契约」的校验语义存在两份手写实现，漂移只是时间问题。

### 选项

| 方案 | 内容 | 评估 |
|---|---|---|
| A. 维持测试私有 | 不导出，第三方继续手抄 | 现状延续：Java/TS 双实现漂移风险不减，koishi 侧接入成本高 |
| B. 导出 assert 函数族 | 把测试断言原样搬出（抛错/expect 风格） | 断言风格绑测试框架心智；vitest 不可进运行时依赖；错误不可聚合 |
| C. **导出纯函数 validateFixture** | 元 schema + 全部一致性规则聚合为一个纯函数，数据进、结果出 | 消费方零新增依赖（zod 已是运行时依赖）；结果式返回让任何框架/语言对端自选断言方式；与 src 零 Node API 约束（tsconfig `types: []`）兼容 |

### 结论

**选 C**。`src/` 新增 `fixtures.ts`（零 Node API，仅依赖 zod 与本仓 schema），从
`src/fixtures.test.ts` 平移提炼，导出面三件：

- `fixtureSchema`：金样本元 schema（name/note/source/frames[].dir/expect 三段）；
- `type Fixture`：`z.infer<typeof fixtureSchema>`；
- `validateFixture(raw: unknown): { ok: true; fixture: Fixture } | { ok: false; issues: string[] }`
  ——聚合四层校验：元 schema parse → reject.stage 声明一致性 → 逐帧三分支（accept 必过
  方向 schema；reject.wire 必拒 wireFrameSchema 骨架；reject.dispatch 过骨架且必拒方向
  schema）→ behavior.reply 引用格式与索引界。issues 为人类可读字符串（含样本名与帧序号），
  不抛异常、不依赖任何测试框架。

**明确不导出的：行为语义执行器。** close code/reason 与 reply 帧的「实跑验证」依赖具体
实现的鉴权、handler 与连接设施（KuroAdapter-Pure 的 runBehaviorIfObservable 即此模式），
协议包只承载期望声明（`expect.behavior`），执行归各消费方——`docs/fixtures.md` 的
「behavior 仅校验形状」边界维持不变，但「形状校验」本身自此成为可分发 API。

`src/fixtures.test.ts` 同批降级为消费方（断言全部金样本 `validateFixture` ok + name 唯一），
16 条静态 import 注册表形态**保持不变**（`scripts/verify-fixtures.mjs` 依赖其 import 路径做
三方比对，见 ADR-003）；硬编码份数断言 `toBe(16)` 删除，份数真相移交脚本的三方一致校验
（本仓 `docs/fixtures.md` 与 BOOTSTRAP-NOTES/DECISIONS 附录中的其余「16」：活文档处改指针，
历史实录与对 Pure 机制的描述性引用保留原文）。

### 对构建链的影响与镜像联动

`src/fixtures.ts` 为 src 新文件、`src/index.ts` 有 re-export 与注释变更——两者均触发主仓
镜像门禁（`fixtures.test.ts` 在主仓脚本白名单内，无需同步）。同步规程见
`docs/MIRROR-RESYNC.md`（ADR-031 流程首次实战）。包产物新增 fixtures 校验导出，体积影响
可忽略。

### 回滚方式

revert 本 ADR 对应 commit（src/fixtures.ts、index.ts、fixtures.test.ts），主仓按
MIRROR-RESYNC 反向同步即可。

---

## ADR-003 金样本分发形态：随主包分发 + bin 校验命令（2026-09-17）

> 长程并行线 1/3（契约可分发化）决策之二；依据 = 2026-09-17 `npm pack --dry-run` 实证。

### 背景

`npm pack --dry-run` 实证（2026-09-17）：当前 tar 包 10 个文件仅 dist 双格式 + LICENSE +
README + package.json，`fixtures/`（16 份 JSON + SHA256SUMS）与 docs 均不在包内。金样本是
协议「物理半边」契约，却只能靠跨仓手拷分发（KuroAdapter-Pure 现行机制，且其 pin 守卫只数
份数不校内容、SHA256SUMS 未随拷）。目标：第三方「装包即得金样本 + 一条命令校验」。

### 选项

| 方案 | 内容 | 评估 |
|---|---|---|
| A. **随主包分发** | `files` 增补 `fixtures` + 校验脚本 | 版本联动天然成立：金样本与 schema 同 tar，「包版本 ≡ 协议版本」一词覆盖两者；零新增安装摩擦；体积 +22.3 kB 内容（17 文件纯文本，实测 `find fixtures -type f -exec cat {} + \| wc -c` = 22829） |
| B. 拆子包 `@kuro-bridge/protocol-fixtures` | 独立版本轴 | 版本联动退化为双包 bump 纪律；本生态有版本轴事故前科（npm 0.1.0，ADR-001）；koishi 对端多一个依赖与 peer 表达；首发流程翻倍。体积收益微小——金样本本就是契约本体，装契约包得样本语义自洽 |

### 结论

**选 A**。实施：

1. `package.json` `files`: `["dist", "fixtures", "scripts/verify-fixtures.mjs"]`——金样本
   全目录（含 SHA256SUMS）与校验脚本入包。
2. `bin`: `"kuro-bridge-verify-fixtures"` → `scripts/verify-fixtures.mjs`（零依赖 Node
   脚本），装包后 `npx kuro-bridge-verify-fixtures` 一条命令校验。
3. **不**新增 `exports` 子路径：JSON 金样本是物理契约，消费方式 = 文件读取 + SHA256SUMS
   比对（JVM、shell `sha256sum -c`、任意语言 fs 均可），不经模块 import——避开 exports
   封闭与 JSON import 的 CJS/ESM 差异坑；模块化消费走 ADR-002 的 `validateFixture`。
4. 脚本双模式自动降级：仓内运行 = 三方一致（fixtures 目录 ↔ SHA256SUMS ↔
   fixtures.test.ts 注册表 import，外加逐文件 sha256 实算）；在 node_modules 包内运行
   （无 src/）= 两方（目录 ↔ SHA256SUMS + 实算），打印模式说明。版本目录名由包
   `version` 推导（`0.4.0` → `v0.4`），把「版本 ↔ 目录」锚进机器。

### 对消费方的建议（记录不实施，实施归各仓）

- KuroAdapter-Pure：升依赖 `@kuro-bridge/protocol@^0.4.0` 后，测试资源可改从包内
  `fixtures/v0.4/` 消费并以 SHA256SUMS 校验，淘汰手拷 + 只数份数的 pin 守卫
  （FixtureConformanceTest.java 的 `EXPECTED_FIXTURE_COUNT = 16` 常量随之消灭）；PIN.md
  补记来源 commit hash（ADR-001 附录建议 1）。
- koishi 对端：升依赖后可直接以包内金样本驱动契约测试（validateFixture + fixtures 目录），
  对齐 ADR-001 阶段 2 第 4 步。

### 回滚方式

revert package.json files/bin 与脚本 commit（发布 0.4.0 前随时可退）；已发布则下一版本
移除。
