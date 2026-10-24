# 发布手册（OIDC 可信发布）

> **铁律：一切发布走 `.github/workflows/release.yml`，禁止手动 `npm publish`。** 推送到 main 的
> 提交若携带一个尚未上架的 `package.json` 版本，流水线会跑门禁、构建、发布件终验，停在
> `release` environment 审批；批准后由 npm 可信发布（OIDC）上架，并自动打 `v<version>` tag。
> 仓库不持有任何 npm 长期 token，也没有 npm secret。

本仓与 NapukettoQQ 的发布形态不同，因此发布链也刻意更薄：

| 维度 | NapukettoQQ | 本仓 |
|---|---|---|
| 版本来源 | changesets 自动 bump + 版本提交回推 main | **手写四件套**：`package.json` ≡ `src/meta.ts`，`verify:version` 机器锚定 |
| 发布触发 | 携带 changeset 的合并 | main 上出现「registry 里还没有的版本」 |
| 推送 main 的凭证 | GitHub App installation token（GITHUB_TOKEN 进不了 ruleset bypass） | **不需要**——版本提交就是触发本次运行的提交本身 |
| 补发通道 | `skip-version` 输入 | 直接 `workflow_dispatch`，registry 比对天然幂等 |
| environment 的作用 | 审批 + 隔离 prepare 的 App token | 审批 + **把 OIDC 签发钉死在 main** |

## 1. 流水线形态

| job | 职责 | 权限 |
|---|---|---|
| `prepare` | 检测版本是否已上架 → `pnpm gate` → `pnpm verify:release` → 打包 artifact | `contents: read`；**无** `id-token` |
| `publish` | 解包 artifact → `node scripts/verify-trust.ts` → `npm publish` | `id-token: write` + `environment: release` 审批；**无** contents 写权限 |
| `tag` | 建 `v<version>` 注释 tag 并推送 | `contents: write`；**无** `id-token` |

三条结构性约束：

- **构建期代码与 OIDC token 分处两个 job**：`package.json` 脚本、tsdown 配置、依赖 postinstall
  都是构建期执行的代码，不能和发布 token 同处。`publish` 不跑 `pnpm install`、不构建，只解包、
  预检、`npm publish --ignore-scripts`。
- **先门禁与终验、后审批**：`prepare` 失败则根本走不到审批；`verify:release` 的四项证据
  （版本锚 / 夹具目录 / 版本史行 / 发布件清单）直接留在运行日志里，供审批时核对。
- **tag 在发布成功之后**：tag 只在 npm 上确实上架后创建，且指向 `github.sha`（构建与发布用的
  同一棵树），不用「此刻的 main」。

## 2. 触发与幂等

```yaml
on:
    push:
        branches: [main]
    workflow_dispatch:
```

- 每次 push 到 main 都会跑 `prepare` 的**检测步**：`npm view <name>@<version>` 命中 → `needed=false`，
  安装 / 门禁 / 构建全部跳过，运行以绿色空转结束。**发布与否只看版本在不在 registry**，
  不看提交信息、不看 changeset。
- 同一版本只可能成功发布一次：哪怕重跑，检测步也会把 `needed` 判成 false；`publish` 里的
  `npm publish` 另有 registry 侧兜底（版本冲突直接拒绝）。
- `concurrency: group: release` 且不取消进行中的运行——两个运行同时走到 `publish` 会撞版本号。
- `workflow_dispatch` 用于补发与重跑。注意：**它是在被 dispatch 的那个 ref 上取工作流文件的**，
  「只许 main 发」由 environment 的 Deployment branches 策略保证（见 §3.1）。

## 3. 一次性配置（按顺序，均为仓库 / npm 侧设置）

### 3.1 Environment `release`（先建好，再合并本文件）

Settings → Environments → New environment，名字 **`release`**（必须与 npm 信任配置的
environment claim 严格同名）：

- 勾 **Required reviewers**（本人即可，可自审）。
- 关闭 **Allow administrators to bypass configured protection rules**——否则管理员可以跳过审批。
  自审仍然可用（`Prevent self-review` 保持关闭），单人维护不会因此锁死。
- **Deployment branches and tags** → Selected branches and tags → 只加 `main`。

> ⚠️ 顺序不能反：workflow 首次部署到不存在的 environment 时，GitHub 会**自动创建它且不带任何
> 审批人**。务必先手工建好；本文件合并时的那次运行因 0.4.0 已上架而 `needed=false`，不会
> 触发部署，这正是把配置窗口留出来的原因。

#### 本仓不接受外部 PR，为什么仍然要 environment？

外部 PR 不是发布链的威胁模型——能 push main 的人本来就能改协议。environment 管的不是
「代码写得对不对」，而是「要不要现在把这个版本永久推到公共 registry」：

1. **协议版本不可撤回**。72 小时后不能 unpublish，下游按版本 pin 并拷贝金样本；发错只能再发
   一版覆盖，版本史、消费方、文档都要跟着动。审批是不可逆动作前唯一的人工停顿。
2. **没有 changeset 那种「可审的版本 diff」**。版本号手写在四件套里，`prepare` 的
   `verify:release` 输出才是机器证据（版本锚、夹具目录、版本史行、发布件清单）；审批页 +
   这份输出构成完整核对面。
3. **分支钉死**。npm 的 claim 只绑 repo + workflow 文件名 + environment，**不绑分支**；
   `workflow_dispatch` 可以在任意 ref 上取工作流文件。Deployment branches 是把「只许 main 发」
   落到实处的机制。没有它，有写权限者可以在分支上改本文件后 dispatch，借 environment 拿 OIDC。
4. 单维护者可以自审，所以它**不是「第二双眼睛」，而是「停顿 + 告警」**：收到一条意料之外的
   deployment 审批请求，本身就是 token 可能被窃的信号。

**想减摩擦时**：删 Required reviewers、保留 environment 与 Deployment branches 即可——claim
绑定与分支门禁都还在，丢的是最后一道人工闸。**不要连 environment 一起删**：那样 claim 与
分支门禁会同时消失，只剩「谁能让这个 workflow 在某个 ref 上跑起来」。

### 3.2 npm 信任配置（逐包，且只有 2 天有效期）

npm 的信任配置是**逐包**的，registry 只认「repository + workflow 文件 + environment」三项
claim 与该包记录精确相符的那一条。新建的配置必须在 **2 天内完成首次成功发布**，逾期失效且
不可编辑——只能 revoke 后重建。**所以：配置与发版要排在同一天。**

本机（npm ≥ 11.15，先 `npm login`）。下面这段 PowerShell / bash 通用——PowerShell 里整条写
一行即可（`\` 续行是 bash 写法，PowerShell 要换成反引号）；`<...>` 占位符必须带引号（`<` 在
PowerShell 里是保留操作符）。

```powershell
npm login
npm trust github "@kuro-bridge/protocol" --file release.yml --repo Kuro-Bridge/KuroProtocol --environment release --allow-publish --yes

# 核对：应看到 file / repo / env / 仅 publish 权限
npm trust list "@kuro-bridge/protocol"
```

- `--file` 只写文件名（相对 `.github/workflows/`），不要带目录。
- 不要加 `--allow-stage-publish`：本仓不走 staged publish。
- 已有失效记录：`npm trust revoke "@kuro-bridge/protocol" --id "<id>"` 后重建。
- 也可在 npmjs.com 的包设置页（Trusted Publisher）手工填同样的三项。

### 3.3 分支与 tag 保护

本仓维护者直推 main、不接受外部 PR，所以**不需要** PR / CODEOWNERS 规则；但发布链依赖
「git 历史不可改写」：

- main：`保护主分支`（Restrict deletions + Block force pushes + 线性历史 + 签名）。注意它给
  管理员开了 bypass——管理员仍可 force-push；要硬保护就关掉 bypass（代价是自己以后必须
  签名提交）。
- `v*` tag：`protect-release-tags`（Restrict deletions + Restrict updates）。**不要**加
  Restrict creations——`tag` job 用 `GITHUB_TOKEN` 创建新 tag 时会被挡。

理由：npm provenance 把发布件绑定到具体 commit；main 被 force-push 或删除后，「发布件与 git
历史一致」就失效了。tag 是发布记录，同样不能移动。

### 3.4 本机 npm 身份

`npm login` 只在**配置信任关系**时用；发布本身不需要本机登录态。账号应开 2FA，并确认自己
在 `kuro-bridge` org 里对 `@kuro-bridge/protocol` 有发布权。

## 4. 日常发布

1. **判定 bump 粒度**并按四件套同改（详见[版本模型](../protocol/versioning.md)）：`src/` schema、
   `docs/protocol/` 规格、`fixtures/`（新协议版本开新目录 + `SHA256SUMS`）、`docs/protocol/versioning.md`
   简史加行；同时改 `package.json` 与 `src/meta.ts` 的版本（两者必须相等）。
2. 本地门禁与终验：

   ```bash
   pnpm gate              # check+test+build+夹具三方一致+版本锚+死链
   pnpm verify:release    # 版本锚 / 夹具目录 / 版本史行 / npm pack 发布件清单
   ```

   `verify:release` 依赖 `dist/`，必须在 `pnpm gate`（含 build）之后跑。
3. 提交并推送 main（简体中文提交信息；本仓不接受外部 PR，维护者直推）。
4. `Release` 自动触发。`prepare` 日志里会出现四项证据，例如：

   ```text
   [verify:release] 版本锚：0.4.0（package.json ≡ src/meta.ts）
   [verify:release] 金样本：fixtures/v0.4/ 与 SHA256SUMS 存在
   [verify:release] 版本史：docs/protocol/versioning.md 的版本简史含 0.4.0 行
   [verify:release] 发布件：28 个文件（含金样本 16 份），打包 49.4 kB，解包 228.2 kB
   ```
5. **审批前核对**（GitHub → Actions → 该次 Release 运行 → Review deployments）：
   - 版本号与 bump 级别（breaking 是否按规则标了 minor / 主版本门槛是否动）；
   - 四件套是否齐（日志四项之外，再看 diff 里的 `docs/` 与 `fixtures/`）；
   - **`.github/workflows/release.yml` 本身是否被改**——改它等于改发布权。
6. 批准后 `publish` 先跑 `verify-trust.ts` 换一次包级 token（404 会直接报配置缺失），再
   `npm publish`。随后 `tag` 创建 `v<version>`。
7. 核对：

   ```powershell
   npm view "@kuro-bridge/protocol" version dist.attestations --json
   git ls-remote --tags origin "refs/tags/v<version>"
   ```

   `dist.attestations` 存在即该版本经 OIDC 发布并带 provenance（来源 commit 与 workflow 可在
   npmjs.com 包页面核验）。
8. 人工收尾：更新 README 的「发布状态」、通知下游仓升级 pin。流水线**不做**跨仓同步。

## 5. 补发与排障

| 现象 | 原因 | 处置 |
|---|---|---|
| `prepare` 显示 `needed=false` | 该版本已在 registry | 正常空转；要发新内容先 bump 版本 |
| `publish` 报 404 / 最终 `ENEEDAUTH` | 信任配置缺失 / claim 不符 / 超过 2 天失效 | 按 §3.2 重建，**当天**重跑 dispatch |
| `E422 Failed to validate repository information` | `package.json` 的 `repository` 缺失或与 OIDC 来源不符（改名 / 转移 owner 后） | 同步 `repository.url` 与仓库实际地址 |
| `E409` 暂存版本冲突 | 走了 stage publish（本仓不会） | npmjs 的 Staged Packages 批准 / 拒绝，或 `npm stage list` |
| 审批拖过 30 天，artifact 被清理 | 保留期到期 | `workflow_dispatch` 重跑（版本未上架会重新构建） |
| 上架成功但 tag 缺失 | `tag` job 被规则集或权限挡住 | 按下面的命令手工补 tag |
| `npm view` 刚发完 404 | registry 202 异步处理 | 等几分钟，用版本端点复核；不要立刻重发（会被比对跳过） |
| tag 已存在但指向别的 commit | 历史 tag 冲突 | `tag` job 会红退；核对后删除旧 tag 再重跑（仅在该版本未上架时） |

手工补 tag（发布成功、tag 缺失时）：

```powershell
git fetch origin main
git tag -a "v<version>" -m "发布 @kuro-bridge/protocol@<version>（包版本 ≡ 协议版本）" "<发布时的 commit>"
git push origin "v<version>"
```

## 6. 回滚

| 动作 | 做法 |
|---|---|
| 刚上架、几乎无下载（72 小时内） | `npm unpublish "@kuro-bridge/protocol@<version>"`；会打断已装该版本的消费方，慎用 |
| 已有下载 | 保持在线，发下一版本修复。注意 0.x 的 `^0.4.0` 只接 `0.4.x` 补丁：minor 及以上需要下游改 pin，不能指望自动到达 |
| 版本内容错误但语义只是标记问题 | `npm deprecate "@kuro-bridge/protocol@<version>" "<原因>"` |
| tag 误打 | `git tag -d "v<version>"`，再 `git push origin --delete "v<version>"`（仅在该版本确认未发布时） |
| git 已推送想回退 | 常规 revert；main 受 ruleset 保护，禁 force push |

## 7. 安全边界

- **发布权 = 能让 `release.yml` 在 main 上跑起来 + 能过 `release` environment 审批。** 改
  `.github/workflows/**`、`scripts/verify-release.ts` 与 `scripts/verify-trust.ts`、`package.json`
  的 `files` / `scripts` / `publishConfig` 都等于改发布面，应随协议变更一起审。
- 无长期 npm token、无 npm secret、无 GitHub App：OIDC 每次换**包级**短时 token，发布产物
  自动带 provenance。
- `publish` 环不 install、不 build、`--ignore-scripts`：构建期代码不进入持 token 的 job。
  `verify-trust.ts` 只做一次 fetch，换到的 token 不打印、不落盘。
- 单维护者场景下，environment 审批是唯一能防「token 被窃后静默发布」的环节；npm 账号务必
  开 2FA，并按 §3.3 保护 main 与 tag。
- 信任配置的 2 天规则既是操作约束也是安全约束：配置长期挂而不发版会自动失效，不存在
  「配一次永久可用」的懒人路径。

## 8. 与 NapukettoQQ 的差异（为什么不能照抄）

NapukettoQQ 是 7 包 monorepo、changesets 驱动、发布链自己写版本提交并推 main，所以它需要
GitHub App token、bypass 规则集、`skip-version` 与拓扑逐包发布。本仓是单包协议仓，版本 ≡
协议版本且手写，发布链相应退化为：检测（registry 比对）→ 门禁 + 终验 → 审批 → 单次
`npm publish` → tag。**共享的只有三件事**：构建与 token 分 job、environment 审批、发布前
预检信任配置。其余差异不是简化，是本仓发布语义的直接结果。
