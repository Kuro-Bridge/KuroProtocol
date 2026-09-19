# 主仓镜像重同步规程（MIRROR-RESYNC）

> **终态（2026-09-18）：主仓镜像 `bridge/protocol/` 与 `scripts/check-protocol-mirror.mjs`
> 门禁已随 ADR-031 阶段 2 / ADR-035 退役删除，本规程自该日自然终止，保留作历史档案；
> 下文 `bridge/protocol/src/` 等路径均为已删除的历史镜像路径。**

> 配套主仓 KuroAdapter ADR-031（镜像冻结与字节级门禁）。本文件是 **KuroProtocol →
> KuroAdapter** 方向的同步义务登记处：本仓每次改动 `src/`，都会使主仓
> `scripts/check-protocol-mirror.mjs`（`pnpm check:protocol`，挂主仓 lefthook
> pre-commit）变红，主仓侧须按本文件登记的步骤同步镜像后门禁才回绿。
> 规程：**src 改动集中为尽量少的一笔提交，并在本文件追记一节（最新在上）**。

## 机制速览（为什么主仓会红）

- 主仓门禁对 `KuroAdapter/bridge/protocol/src/` 与本仓 `src/` 做**字节级**比对
  （逐文件 `Buffer.equals`），范围是全部 `*.ts`。
- 白名单豁免：`fixtures.test.ts` 只存在于本仓（`ssotOnlyFiles`），主仓无对应文件，
  改它**不**触发门禁。
- 因此：本仓 `src/` 任何被镜像文件的字节改动（含纯注释）、**新增** .ts 文件（主仓
  镜像缺失 → 红）、删除文件（主仓多出 → 红）都会使主仓 pre-commit 与 CI 变红。

---

## 2026-09-17 · ADR-002 校验导出（目标 commit `bb9f936`）

**变更清单**（该笔提交内全部 src 变更）：

| 文件 | 变更 | 主仓镜像需同步 |
|---|---|---|
| `src/fixtures.ts` | **新增**：fixtureSchema / Fixture / validateFixture（从 fixtures.test.ts 平移提炼，ADR-002） | **是**（不同步 → 门禁报「镜像缺失文件」） |
| `src/index.ts` | 修改：L8 注释死链修复（旧错路径 `protocol/peer-guide.md` → `docs/peer-guide.md`；history 草案引用补「主仓」限定）+ 新增 fixtures 导出段 | **是** |
| `src/fixtures.test.ts` | 修改：降级为 validateFixture 消费方，`toBe(16)` 删除 | **否**（白名单豁免） |

**主仓侧同步步骤**（在 KuroAdapter 仓，Git Bash；PowerShell 等价命令见括注）：

```bash
cd /c/Dev/MC-Ecosystem/KuroAdapter

# 1) 拷贝两个文件（PowerShell: Copy-Item ../KuroProtocol/src/fixtures.ts bridge/protocol/src/ 等）
cp ../KuroProtocol/src/fixtures.ts  bridge/protocol/src/fixtures.ts
cp ../KuroProtocol/src/index.ts     bridge/protocol/src/index.ts

# 2) 门禁自证（期望绿）
pnpm check:protocol

# 3) 提交（沿用 ADR-031 既有提交信息风格，例：a265fb2）
git add bridge/protocol/src
git commit -m "chore: 同步协议镜像（KuroProtocol bb9f936 fixtures 校验导出 ADR-002）"
```

**注意**：

- 无需同步 `fixtures.test.ts`（白名单）；若门禁仍红，先看报错指向哪一侧缺失/漂移。
- 主仓镜像包 `bridge/protocol/package.json` 为 `private: true` 占位（ADR-001），
  本仓 package.json 的 files/bin 等分发变更（commit `7333667`）**不涉及**镜像，
  主仓无需动作。
- 0.4.0 发布后主仓将整体删除镜像与门禁（ADR-001 阶段 2 第 3 步），届时本文件
  规程自然终止，保留作历史档案。
