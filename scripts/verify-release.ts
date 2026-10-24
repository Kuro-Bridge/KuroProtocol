/**
 * verify-release —— 发布前终验（pnpm verify:release；由 release.yml 的 prepare 环调用）
 *
 * 用途：在拿到 OIDC token 之前，把「这次要发的是什么」摊开并机器校验，供 environment
 * 审批时核对。四项：
 *   1. 版本锚：package.json 的 version ≡ src/meta.ts 的 PROTOCOL_VERSION（与 verify:version
 *      同口径，此处重述以防单跑本脚本时缺锚）；
 *   2. 金样本目录：fixtures/v<major>.<minor>/ 与其中的 SHA256SUMS 存在（包版本 ↔ 目录锚，
 *      口径同 verify-fixtures）；
 *   3. 版本史：docs/protocol/versioning.md 的表格里有该版本条目——四件套 ④ 的机器证据，
 *      gate 只查死链，查不到「简史漏加行」；
 *   4. 发布件清单：npm pack --dry-run 的产物必须含双格式 dist、bin 脚本、金样本与
 *      README/LICENSE/package.json，且不得混入 src/（files 清单纪律）。
 *
 * 为什么不在 gate 里：npm pack 需要 dist（gate 先 build 才有），且版本史与发布件检查只对
 * 「要发布的那一次提交」有意义；gate 保持提交前口径，本脚本是发布链专属终验。
 *
 * 零 npm 依赖（仅 node: 内建 + npm CLI）；仓根由 import.meta.url 推导，不依赖 cwd。
 * Windows 上 npm 是 .cmd，经 ComSpec 显式执行（对齐主仓 tooling/release 的做法）。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAG = "[verify:release]";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
// 只提取字面量（不 import TS）：匹配 src/meta.ts 的 PROTOCOL_VERSION = "x.y.z" 声明
const PROTOCOL_VERSION_DECL = /PROTOCOL_VERSION\s*=\s*"([^"]*)"/;
/** 发布件必须含的路径（fixtures 版本目录里的 SHA256SUMS 在运行时追加）。 */
const REQUIRED_PACK_FILES = [
    "package.json",
    "README.md",
    "LICENSE",
    "dist/index.mjs",
    "dist/index.cjs",
    "dist/index.d.mts",
    "dist/index.d.cts",
    "scripts/verify-fixtures.ts",
] as const;

interface PackageManifest {
    readonly version: string;
}

interface PackedFile {
    readonly path: string;
}

interface PackInfo {
    readonly entryCount?: number;
    readonly size?: number;
    readonly unpackedSize?: number;
    readonly files: readonly PackedFile[];
}

function fail(detail: string): never {
    console.log(`${TAG} 失败：${detail}`);
    process.exit(1);
}

/** 读取 package.json 的 version（缺失或非法直接红退）。 */
function readPackageManifest(): PackageManifest {
    let raw: string;
    try {
        raw = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`无法读取 package.json：${message}（脚本应位于 <root>/scripts/ 下）`);
    }
    const parsed: unknown = JSON.parse(raw);
    const versionField =
        typeof parsed === "object" && parsed !== null
            ? (parsed as { version?: unknown }).version
            : undefined;
    if (typeof versionField !== "string" || versionField === "") {
        fail("package.json 缺少 version");
    }
    return { version: versionField };
}

/** package.json version（x.y.z）→ fixtures 版本目录名（v<x>.<y>）；非法直接红退。 */
function deriveVersionDir(version: string): string {
    const match = SEMVER.exec(version);
    if (match === null) {
        fail(`package.json version 格式非法（期望 x.y.z，实际 "${version}"）`);
    }
    return `v${match[1] ?? ""}.${match[2] ?? ""}`;
}

/** 读取 src/meta.ts 的 PROTOCOL_VERSION 字面量。 */
function readMetaVersion(): string {
    let source: string;
    try {
        source = readFileSync(join(REPO_ROOT, "src", "meta.ts"), "utf8");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`无法读取 src/meta.ts：${message}`);
    }
    const declaration = PROTOCOL_VERSION_DECL.exec(source);
    if (declaration === null) {
        fail('src/meta.ts 中未找到 PROTOCOL_VERSION = "..." 字面量声明');
    }
    return declaration[1] ?? "";
}

/** 第 2 项：fixtures/v<major>.<minor>/ 与 SHA256SUMS 必须存在。 */
function checkFixtureDir(versionDir: string): void {
    const fixtureRoot = join(REPO_ROOT, "fixtures", versionDir);
    if (!existsSync(fixtureRoot) || !statSync(fixtureRoot).isDirectory()) {
        fail(
            `金样本目录不存在：fixtures/${versionDir}（版本与目录错位？发布新协议版本须新建该目录）`,
        );
    }
    if (!existsSync(join(fixtureRoot, "SHA256SUMS"))) {
        fail(`fixtures/${versionDir}/SHA256SUMS 缺失（金样本契约的校验锚点）`);
    }
    console.log(`${TAG} 金样本：fixtures/${versionDir}/ 与 SHA256SUMS 存在`);
}

/** 表格行判定：去掉加粗星号后，第二格恰好等于版本号（版本简史表的第一列是版本）。 */
function hasHistoryRow(markdown: string, version: string): boolean {
    for (const rawLine of markdown.split("\n")) {
        const cells = rawLine
            .trim()
            .split("*")
            .join("")
            .split("|")
            .map((cell) => cell.trim());
        if (cells.length >= 3 && cells[1] === version) {
            return true;
        }
    }
    return false;
}

/** 第 3 项：docs/protocol/versioning.md 的版本简史表必须新增该版本行（四件套 ④）。 */
function checkVersionHistory(version: string): void {
    const file = join(REPO_ROOT, "docs", "protocol", "versioning.md");
    let markdown: string;
    try {
        markdown = readFileSync(file, "utf8");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`无法读取 docs/protocol/versioning.md：${message}`);
    }
    if (!hasHistoryRow(markdown, version)) {
        fail(
            `docs/protocol/versioning.md 的「版本简史」表缺少 ${version} 行` +
                "（四件套 ④：bump 依据与出处须与版本同批落地）",
        );
    }
    console.log(`${TAG} 版本史：docs/protocol/versioning.md 的版本简史含 ${version} 行`);
}

/** 运行 npm pack --dry-run --json（不发布、不执行仓库生命周期脚本，仅算发布件清单）。 */
function runNpmPack(): PackInfo {
    const isWindows = process.platform === "win32";
    const command = isWindows ? (process.env["ComSpec"] ?? "cmd.exe") : "npm";
    const args = isWindows
        ? ["/d", "/s", "/c", "npm", "pack", "--dry-run", "--json"]
        : ["pack", "--dry-run", "--json"];
    const result = spawnSync(command, args, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error !== undefined) {
        fail(`无法启动 npm：${result.error.message}`);
    }
    if (result.status !== 0) {
        const detail = (result.stderr ?? "").trim() || `退出码 ${result.status}`;
        fail(`npm pack --dry-run 失败：${detail}`);
    }
    const parsed: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        fail("npm pack --dry-run --json 输出为空");
    }
    const info: unknown = parsed[0];
    const files =
        typeof info === "object" && info !== null ? (info as { files?: unknown }).files : undefined;
    if (!Array.isArray(files)) {
        fail("npm pack --dry-run --json 输出缺少 files 清单");
    }
    return info as PackInfo;
}

/** 人类可读体积（kB / MB）。 */
function formatSize(bytes: number): string {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${(bytes / 1024).toFixed(1)} kB`;
}

/** 第 4 项：发布件清单必须含必需文件，且不得混入 src/。 */
function checkPack(versionDir: string): void {
    const info = runNpmPack();
    const paths = new Set(info.files.map((file) => file.path));
    const required = [...REQUIRED_PACK_FILES, `fixtures/${versionDir}/SHA256SUMS`];
    const missing = required.filter((path) => !paths.has(path));
    if (missing.length > 0) {
        fail(
            `发布件缺少必需文件：${missing.join("、")}` +
                "（检查 package.json 的 files 清单，以及构建是否在 verify:release 之前完成）",
        );
    }
    const fixtureCount = [...paths].filter(
        (path) => path.startsWith(`fixtures/${versionDir}/`) && path.endsWith(".json"),
    ).length;
    if (fixtureCount === 0) {
        fail(`发布件不含金样本：fixtures/${versionDir}/*.json`);
    }
    const leaked = [...paths].filter((path) => path.startsWith("src/"));
    if (leaked.length > 0) {
        fail(
            `发布件混入 src/：${leaked.join("、")}（files 清单应只含 dist / fixtures / 发布脚本）`,
        );
    }
    console.log(
        `${TAG} 发布件：${info.entryCount ?? paths.size} 个文件（含金样本 ${fixtureCount} 份），` +
            `打包 ${formatSize(info.size ?? 0)}，解包 ${formatSize(info.unpackedSize ?? 0)}`,
    );
}

function main(): void {
    const manifest = readPackageManifest();
    const versionDir = deriveVersionDir(manifest.version);
    const metaVersion = readMetaVersion();
    if (metaVersion !== manifest.version) {
        fail(
            `package.json version = "${manifest.version}" ≠ ` +
                `src/meta.ts PROTOCOL_VERSION = "${metaVersion}"`,
        );
    }
    console.log(`${TAG} 版本锚：${manifest.version}（package.json ≡ src/meta.ts）`);
    checkFixtureDir(versionDir);
    checkVersionHistory(manifest.version);
    checkPack(versionDir);
    console.log(`${TAG} 通过：@kuro-bridge/protocol@${manifest.version} 的发布件与四件套锚点一致`);
}

main();
