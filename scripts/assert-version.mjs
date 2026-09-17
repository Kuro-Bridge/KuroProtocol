/**
 * assert-version —— 包版本 ≡ 协议版本 机器断言（pnpm verify:version）
 *
 * 用途：断言仓根 package.json 的 `version` 与 `src/meta.ts` 的 `PROTOCOL_VERSION`
 * 字面量字符串相等，且均满足 /^\d+\.\d+\.\d+$/；不相等即 exit 1。
 *
 * 出处：长程线 1/3 块 D（2026-09-17）——把 ADR-001 发布纪律「包版本 ≡ 协议版本」的
 * 版本锚从纯人工核对升级为机器断言。此前唯一相关测试只查格式正则
 * （src/index.test.ts L17-20），包版本与协议版本两轴错位（npm 0.1.0 事故形态，
 * 见 docs/DECISIONS.md ADR-001）检测不到。
 *
 * 零 npm 依赖（仅 Node 内建）；只经 npm scripts 调用，无需 shebang。仓根由
 * import.meta.url 推导（脚本位于 scripts/ 下），不依赖 cwd。
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+$/;
// 只提取字面量（不 import TS）：匹配 src/meta.ts 的 PROTOCOL_VERSION = "x.y.z" 声明
const PROTOCOL_VERSION_DECL = /PROTOCOL_VERSION\s*=\s*"([^"]*)"/;

function fail(detail) {
    console.log(`[verify:version] 失败：${detail}`);
    console.log("[verify:version] 硬性约束：包版本 ≡ 协议版本（AGENTS.md 硬性约束 3，ADR-001）。");
    process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
const pkgVersion = typeof pkg.version === "string" ? pkg.version : "";
const metaSource = readFileSync(join(REPO_ROOT, "src", "meta.ts"), "utf8");
const decl = PROTOCOL_VERSION_DECL.exec(metaSource);
if (decl === null) {
    fail('src/meta.ts 中未找到 PROTOCOL_VERSION = "..." 字面量声明');
}
const protocolVersion = decl[1] ?? "";

if (!SEMVER.test(pkgVersion)) {
    fail(`package.json version 格式非法（期望语义化三元组，实际 "${pkgVersion}"）`);
}
if (!SEMVER.test(protocolVersion)) {
    fail(`src/meta.ts PROTOCOL_VERSION 格式非法（期望语义化三元组，实际 "${protocolVersion}"）`);
}
if (pkgVersion !== protocolVersion) {
    fail(
        `package.json version = "${pkgVersion}" ≠ ` +
            `src/meta.ts PROTOCOL_VERSION = "${protocolVersion}"`,
    );
}

console.log(
    `[verify:version] 通过：package.json version ≡ src/meta.ts PROTOCOL_VERSION = ${pkgVersion}`,
);
