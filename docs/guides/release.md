# 发布手册

> 适用范围：任何新版本发布（协议 bump 之后）。发布只能从本仓出（决策档案 ADR-001 原则，见
> [决策档案](../architecture/decisions.md)）；包版本 ≡ 协议版本。仓内不执行任何 npm 账号操作
> ——命令序列由持 npm org（`kuro-bridge`）发布权的用户执行。

## 前置检查清单（逐条绿才继续）

协议 bump 时先完成[版本模型](../protocol/versioning.md)的四件套同改与新增金样本版本目录
（fixtures 根由包 version 推导 `v<major>.<minor>`，见[金样本契约](../protocol/fixtures.md)），
`pnpm gate` 绿后再走本手册。

```bash
# 1) 全量门禁
pnpm gate

# 2) 工作树干净、无未提交变更
git status --porcelain        # 期望空输出

# 3) npm 身份与 org 权限
npm whoami
npm org ls kuro-bridge

# 4) registry 现状核对（确认目标版本未存在、历史版本符合预期）
npm view @kuro-bridge/protocol versions

# 5) 发布 registry 自查（本机 pnpm 默认 registry 为只读 npmmirror 镜像，
#    下方 publish 必须显式指定 npmjs，勿省略 --registry）
pnpm config get registry

# 6) 发布件终验（期望：dist 双格式 + fixtures 全目录 + bin 脚本 + LICENSE/README/package.json）
npm pack --dry-run
```

## 命令序列（publish → 核对 → tag）

```bash
# 1) 推送全部提交（发布件必须与 git 历史一致，发布后不可再改写）
git push origin master

# 2) 发布（--registry：本机 pnpm 默认 npmmirror 只读，须显式指 npmjs）
pnpm publish --access public --registry https://registry.npmjs.org

# 3) 核对上架结果
npm view @kuro-bridge/protocol versions
npm view @kuro-bridge/protocol@<version> dist.tarball

# 4) 打 tag（惯例：v + 包版本，annotated，只在发布成功后打，打在发布时的 master HEAD 上）
git tag -a v<version> -m "发布 @kuro-bridge/protocol@<version>（包版本 ≡ 协议版本）"
git push origin v<version>
```

## 回滚方式

| 动作 | 回滚 |
|---|---|
| publish 误发/有问题 | 72 小时内且几乎无下载时可 `npm unpublish @kuro-bridge/protocol@<version>`；已有下载则保持在线，用下一版本修复（0.x 区间下 `^0.x.0` 消费方可自动接收补丁） |
| 想清除 deprecate 标记 | `npm deprecate @kuro-bridge/protocol@<version> ""`（空消息即清除弃用标记） |
| tag 误打 | `git tag -d v<version> && git push origin :refs/tags/v<version>` |
| git 已推送想回退 | 常规 revert 流程（master 已公开，禁 force push） |

## 历史发布记录

- **0.4.0**（2026-09-18T11:17Z 上架 npmjs，`latest`，tag `v0.4.0`）：拆仓后首发。
- **0.1.0**（2026-09-15，拆仓前夜自主仓 `bridge/protocol` 误发：包版本与内嵌协议版本错位、
  exports 缺 require）：已 deprecate。事故记录见[决策档案](../architecture/decisions.md) ADR-001。
