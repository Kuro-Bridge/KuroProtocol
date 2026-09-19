# 发布手册（RELEASE）——0.4.0 首发与 0.1.0 旧线收口

> **本文档是用户待办**：仓内不执行任何 `npm publish` / `npm deprecate` /
> `git push` / GitHub release——全部整理为带前置检查与回滚方式的确切命令序列，
> 由持 npm 账号（org `kuro-bridge` 发布权）的用户执行。
> 依据：ADR-001（发布线切换 0.4.0 与 0.1.0 事故记录）、ADR-002/ADR-003
> （2026-09-17 契约可分发化落地）。

> **终态（2026-09-18）：本手册主命令序列（publish → 核对 → tag → deprecate）已全部执行完毕——
> 0.4.0 已发布（npm `latest`）、0.1.0 已 deprecate、tag `v0.4.0` 已推。实况见文末
> [终态追记（2026-09-18）](#终态追记2026-09-18)；正文保留作执行实录（runbook）。**

## 当前状态（2026-09-17）

- `pnpm gate` 全绿（check + test 55 用例 + build 双格式 + 夹具三方一致 16/16/16 +
  sha256 实算全符 + 版本锚 0.4.0 ≡ 0.4.0 + 死链 0）。
- `npm pack --dry-run` 实证 28 文件：dist 双格式 7 + `fixtures/v0.4/` 17（金样本
  16 + SHA256SUMS）+ `scripts/verify-fixtures.mjs` + LICENSE/README/package.json，
  package size 48.1 kB。
- git：master 领先 origin（历史 6 笔 + 2026-09-17 新增 7 笔），**发布前须先推送**。
- npm registry 现存唯一版本 `0.1.0`（2026-09-15 误发旧线，事故记录见 ADR-001）。

## 前置检查清单（逐条绿才继续）

```bash
cd /c/Dev/MC-Ecosystem/KuroProtocol

# 1) 全量门禁
pnpm gate

# 2) 工作树干净、无未提交变更
git status --porcelain        # 期望空输出

# 3) npm 身份与 org 权限（ADR-001 前提：org kuro-bridge 可发包）
npm whoami                    # 期望 oppenheimu（或持发布权的账号）
npm org ls kuro-bridge        # 确认成员/权限；若无 org 则确认 scope 未被占用

# 4) registry 现状核对（期望只见到 0.1.0，无 0.4.0）
npm view @kuro-bridge/protocol versions

# 5) 发布 registry 自查（本机 pnpm 默认 registry 为只读 npmmirror 镜像，
#    因此下方 publish 命令显式指定 npmjs，勿省略 --registry）
pnpm config get registry

# 6) 发布件终验（期望 total files: 28，fixtures 17 份在列）
npm pack --dry-run
```

## 命令序列（publish → 核对 → tag → deprecate）

```bash
# 1) 推送全部提交（发布件必须与 git 历史一致，发布后不可再改写）
git push origin master

# 2) 发布 0.4.0（--registry：本机 pnpm 默认 npmmirror 只读，须显式指 npmjs）
pnpm publish --access public --registry https://registry.npmjs.org

# 3) 核对上架结果（期望 0.1.0, 0.4.0）
npm view @kuro-bridge/protocol versions
npm view @kuro-bridge/protocol@0.4.0 dist.tarball

# 4) 打 tag（惯例：vX.Y.Z annotated tag，发布成功后在发布提交上打）
git tag -a v0.4.0 -m "发布 @kuro-bridge/protocol@0.4.0（协议 0.4.0；包版本 ≡ 协议版本）"
git push origin v0.4.0

# 5) deprecate 旧线 0.1.0（ADR-001 阶段 2 第 2 步，措辞沿用 ADR 原文）
npm deprecate @kuro-bridge/protocol@0.1.0 \
  "published from the wrong repo (pre-SSOT); use 0.4.0+ from KuroProtocol — package version now equals protocol version"
```

**tag 惯例**（固化）：`v` + 包版本（`v0.4.0` 为本仓首 tag）；只在发布成功后打；
annotated（`git tag -a`）；打在发布时的 master HEAD 上。协议 bump 流程见
`docs/changelog.md` bump 规则——新版本 = 四件套同改 + `pnpm gate` 绿 + 本手册
流程重走。

## 回滚方式

| 动作 | 回滚 |
|---|---|
| publish 0.4.0 误发/有问题 | 72 小时内且几乎无下载时可 `npm unpublish @kuro-bridge/protocol@0.4.0`；已有下载则保持在线，用下一版本修复（0.x 区间下 `^0.4.0` 消费方可自动接收 0.4.x 补丁） |
| deprecate 0.1.0 想撤销 | `npm deprecate @kuro-bridge/protocol@0.1.0 ""`（空消息即清除弃用标记） |
| tag 误打 | `git tag -d v0.4.0 && git push origin :refs/tags/v0.4.0` |
| git 已推送想回退 | 常规 revert 流程（master 已公开，禁 force push） |

## 相邻线协同时间点（各自触发动作者）

| 相邻线 | 触发条件 | 动作 |
|---|---|---|
| KuroAdapter（线 2，主仓） | 本仓 0.4.0 上架成功（上方第 3 步核对通过） | ① 若在发布前继续开发：先按 `docs/MIRROR-RESYNC.md` 同步镜像（解 pre-commit 红，目标 commit `bb9f936`）；② 终态：ADR-001 阶段 2 第 3 步——三消费方 `workspace:*` → `^0.4.0`、删 `bridge/protocol` 镜像与 `scripts/check-protocol-mirror.mjs` 门禁、`pnpm-workspace.yaml` 去掉 protocol |
| KuroAdapter-Pure（线 3） | 0.4.0 上架后择机 | 依 ADR-003 建议：测试资源改从包内 `fixtures/v0.4/` 消费并以 SHA256SUMS 校验，淘汰手拷 + 只数份数的 pin 守卫（`FixtureConformanceTest.java` 的 `EXPECTED_FIXTURE_COUNT = 16` 随之消灭）；`PIN.md` 补来源 commit hash |
| koishi 对端（线 3 / 上游 koishi-dev） | 0.4.0 上架后 | ADR-001 阶段 2 第 4 步：依赖 `^0.1.0` → `^0.4.0`；移除 tsdown `alwaysBundle` 绕行（新包 exports 已含 require）；可直接以包内金样本 + `validateFixture` 驱动契约测试 |

## 发布后（用户可做的验证）

```bash
# 干净目录验证「装包即得金样本 + 一条命令校验」
npm install @kuro-bridge/protocol@0.4.0
npx kuro-bridge-verify-fixtures          # 期望：包内模式两方校验通过（16 份）
node -e "console.log(require('@kuro-bridge/protocol').PROTOCOL_VERSION)"   # 0.4.0（CJS 路径即 0.1.0 事故的断裂点）
```

## 终态追记（2026-09-18）

本节为 2026-09-18 实际执行结果的回写；上文各节保留原拟稿（2026-09-17）口径，作 runbook 与
执行实录存档，不再修改。与当时拟稿的差异如实记录如下：

- **0.4.0 发布成功**：`@kuro-bridge/protocol@0.4.0` 于 2026-09-18T11:17:08Z 上架 npmjs，
  `dist-tags.latest = 0.4.0`（registry 实况：`versions = ["0.1.0", "0.4.0"]`，2026-09-19 现场查证）。
- **0.1.0 已 deprecate**：registry 弃用消息与上方命令序列第 5 步措辞逐字一致（即 ADR-001 原文）。
- **tag `v0.4.0` 已推远端**，打在发布时 master HEAD `09a1131` 上。与拟稿差异：实际以
  **lightweight** tag 落地（`git for-each-ref` 报 `objecttype=commit`），非上文固化的 annotated
  惯例；已成事实不重打，后续发布仍按 annotated 惯例执行。
- **master 与 origin 同步**：发布前推送（命令序列第 1 步）已执行，正文「发布前须先推送」的
  前置条件随发布完成失效。
- **相邻线协同表三条均已执行完毕**：主仓删 `bridge/protocol` 镜像与 `check-protocol-mirror.mjs`
  门禁、三消费方切 `^0.4.0`（主仓 ADR-035）；Pure 侧改从 npm 包机械刷新 fixtures（含
  SHA256SUMS 校验，见其 `core/src/test/resources/fixtures/PIN.md`）；上游对端切 `^0.4.0` 并
  移除 `alwaysBundle` 绕行。逐项核对见 `docs/DECISIONS.md` ADR-001 终态追注。

「当前状态（2026-09-17）」节中「npm registry 现存唯一版本 `0.1.0`」等行文就此成为历史登记口径
（发布前快照），由本节覆盖。
