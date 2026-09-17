#!/usr/bin/env node
/**
 * verify-fixtures —— 金样本三方一致校验 + 双模式自动降级（ADR-003 结论 4）
 *
 * 用途：把「包版本 ↔ fixtures 版本目录」与金样本三方一致锚进机器。金样本根 =
 * <root>/fixtures/v<major>.<minor>/，版本目录由 <root>/package.json 的 version 推导
 * （如 0.4.0 → v0.4；版本与目录错位即红）。三方各为一个有序路径集合（相对金样本根、
 * POSIX 正斜杠），两两相等（排序后逐项比）：
 *   1. 目录实况：递归枚举金样本根下全部 .json 文件（含子目录；SHA256SUMS 无 .json
 *      后缀，天然排除）；
 *   2. SHA256SUMS 登记：逐行 `<64 位小写 hex><空白><相对路径>`（实际为两个空格，兼容
 *      多空格/制表符），并逐行实算文件 sha256（node:crypto）与登记值比对——hash 不符
 *      或文件缺失即违规；
 *   3. 测试注册表：<root>/src/fixtures.test.ts 的静态 import
 *      `from "../fixtures/<版本目录>/....json"`（该文件保持静态 import 形态）。
 * 附加校验（与三方比对同级违规）：SHA256SUMS 文件存在；每个枚举到的 JSON 可解析。
 *
 * 双模式自动降级：src/fixtures.test.ts 存在（仓内形态）= 三方校验；不存在
 * （node_modules/@kuro-bridge/protocol 包内形态）= 两方（目录 ↔ SHA256SUMS）并打印
 * 模式说明。全部违规聚齐后统一输出再 exit 1（不首错即退，方便一次看清）；无违规
 * exit 0。
 *
 * 出处：docs/DECISIONS.md ADR-003（2026-09-17）；bin 名 kuro-bridge-verify-fixtures
 * （装包后 npx 即用）；仓内入口 pnpm verify:fixtures。根目录由 import.meta.url 推导
 * （脚本位于 <root>/scripts/ 下：仓内 = 仓根，包内 = 包根，两者结构推导一致），不依赖
 * cwd。零 npm 依赖（仅 node: 内建）；首行 shebang 供 bin 消费。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TAG = "[verify:fixtures]";
const SUMS_NAME = "SHA256SUMS";
const SEMVER = /^(\d+)\.(\d+)\.\d+(?:[-+].*)?$/;
const SUMS_LINE = /^([0-9a-f]{64})\s+(.+)$/;
const TEST_IMPORT = /from\s+"\.\.\/fixtures\/([^"]+\.json)"/g;

/** 结构性前提失败（package.json / 版本目录推导不出），无从比对，直接红退。 */
function failStructural(detail) {
    console.log(`${TAG} 失败（结构性前提，跳过一致比对）：${detail}`);
    process.exit(1);
}

/** 平台路径分隔符 → POSIX 正斜杠（三方集合统一以 POSIX 相对路径比对）。 */
function toPosix(p) {
    return p.split(sep).join("/");
}

/** package.json version（x.y.z）→ fixtures 版本目录名（v<x>.<y>）；非法返回 null。 */
function deriveVersionDir(version) {
    const m = SEMVER.exec(version);
    return m === null ? null : `v${m[1]}.${m[2]}`;
}

/** 递归枚举 dir 下全部文件（含子目录）的绝对路径，不筛后缀。 */
function listFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(full));
        } else if (entry.isFile()) {
            files.push(full);
        }
    }
    return files;
}

/** 实算文件 sha256（小写 hex）。 */
function sha256Of(absPath) {
    return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

/** 解析 SHA256SUMS 文本：合法行 → { lineNo, hash, path }；非法行 → bad 违规（带行号）。 */
function parseSums(text) {
    const entries = [];
    const bad = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "") {
            continue;
        }
        const m = SUMS_LINE.exec(line);
        if (m === null) {
            bad.push(
                `${SUMS_NAME} 第 ${i + 1} 行格式非法` +
                    `（期望 <64 位小写 hex><空白><相对路径>）：${line}`,
            );
        } else {
            entries.push({ lineNo: i + 1, hash: m[1], path: m[2].trim() });
        }
    }
    return { entries, bad };
}

/** 第 2 方核心：逐条实算 sha256 与登记值比对；登记指向的文件缺失即违规。 */
function verifyHashes(entries, fixtureRoot, violations) {
    for (const e of entries) {
        const abs = join(fixtureRoot, e.path);
        if (!existsSync(abs)) {
            violations.push(`${SUMS_NAME} 登记 ${e.path}（第 ${e.lineNo} 行）：文件缺失`);
            continue;
        }
        const actual = sha256Of(abs);
        if (actual !== e.hash) {
            violations.push(
                `${SUMS_NAME} 登记 ${e.path}（第 ${e.lineNo} 行）：hash 不符` +
                    `（登记 ${e.hash}，实算 ${actual}）`,
            );
        }
    }
}

/** 第 3 方：正则提取 fixtures.test.ts 的金样本 import，剥去 ../fixtures/<版本目录>/ 前缀。 */
function collectTestRegistry(source, versionDir, violations) {
    const prefix = `${versionDir}/`;
    const paths = new Set();
    for (const m of source.matchAll(TEST_IMPORT)) {
        const ref = m[1];
        if (!ref.startsWith(prefix)) {
            violations.push(
                `测试注册表引用了非当前版本目录：../fixtures/${ref}（当前应为 ${versionDir}）`,
            );
            continue;
        }
        const rel = ref.slice(prefix.length);
        if (paths.has(rel)) {
            violations.push(`测试注册表重复登记：${rel}`);
        } else {
            paths.add(rel);
        }
    }
    return paths;
}

/** 两两比对：A 有 B 无 → 「B 缺失」；B 有 A 无 → 「A 缺失」（排序输出）。 */
function diffParties(labelA, setA, labelB, setB, violations) {
    for (const p of [...setA].filter((x) => !setB.has(x)).sort()) {
        violations.push(`${labelA} 有而 ${labelB} 缺失：${p}`);
    }
    for (const p of [...setB].filter((x) => !setA.has(x)).sort()) {
        violations.push(`${labelB} 有而 ${labelA} 缺失：${p}`);
    }
}

function main() {
    const violations = [];

    // —— 前提：包版本 → 版本目录 → 金样本根 ——
    let pkg;
    try {
        pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    } catch {
        failStructural(
            `无法读取或解析 ${toPosix(join(ROOT, "package.json"))}（脚本应位于 <root>/scripts/ 下）`,
        );
    }
    const pkgVersion = typeof pkg.version === "string" ? pkg.version : "";
    const versionDir = deriveVersionDir(pkgVersion);
    if (versionDir === null) {
        failStructural(
            `package.json version 格式非法（期望 x.y.z，实际 "${pkgVersion}"），无法推导版本目录`,
        );
    }
    const fixtureRoot = join(ROOT, "fixtures", versionDir);
    if (!existsSync(fixtureRoot) || !statSync(fixtureRoot).isDirectory()) {
        failStructural(
            `金样本根不存在：fixtures/${versionDir}` +
                `（package.json version "${pkgVersion}" 推导 → fixtures/${versionDir}，请核对版本与目录是否错位）`,
        );
    }

    // —— 模式判定：src/fixtures.test.ts 在则三方，不在（包内形态）则两方降级 ——
    const testFile = join(ROOT, "src", "fixtures.test.ts");
    const repoMode = existsSync(testFile);

    // —— 第 1 方：目录实况（递归全部 .json）+ JSON 可解析校验 ——
    const allFiles = listFiles(fixtureRoot)
        .map((abs) => toPosix(relative(fixtureRoot, abs)))
        .sort();
    const dirFiles = allFiles.filter((p) => p.endsWith(".json"));
    const dirSet = new Set(dirFiles);
    for (const rel of dirFiles) {
        try {
            JSON.parse(readFileSync(join(fixtureRoot, ...rel.split("/")), "utf8"));
        } catch (err) {
            violations.push(`JSON 解析失败：fixtures/${versionDir}/${rel}（${err.message}）`);
        }
    }

    // —— 第 2 方：SHA256SUMS 登记（存在性 + 解析 + 重复 + 逐行实算） ——
    const sumsFile = join(fixtureRoot, SUMS_NAME);
    let sumsSet = null;
    let sumsCount = 0;
    if (existsSync(sumsFile)) {
        const { entries, bad } = parseSums(readFileSync(sumsFile, "utf8"));
        violations.push(...bad);
        sumsCount = entries.length;
        sumsSet = new Set();
        for (const e of entries) {
            if (sumsSet.has(e.path)) {
                violations.push(`${SUMS_NAME} 重复登记：${e.path}`);
            } else {
                sumsSet.add(e.path);
            }
        }
        verifyHashes(entries, fixtureRoot, violations);
    } else {
        violations.push(
            `${SUMS_NAME} 文件缺失：fixtures/${versionDir}/${SUMS_NAME}` +
                "（第 2 方不可用，跳过与其相关的两两比对）",
        );
    }

    // —— 第 3 方：测试注册表 import（仅仓内形态） ——
    let testSet = null;
    let testCount = 0;
    if (repoMode) {
        testSet = collectTestRegistry(readFileSync(testFile, "utf8"), versionDir, violations);
        testCount = testSet.size;
    }

    if (repoMode) {
        console.log(`${TAG} 仓内模式：三方一致校验（目录实况 ↔ ${SUMS_NAME} 登记 ↔ 测试注册表）。`);
    } else {
        console.log(`${TAG} 包内模式：两方校验（目录 ↔ ${SUMS_NAME}）；三方校验需在 KuroProtocol 仓内运行。`);
    }

    // —— 两两比对（某方不可用时跳过涉及它的比对，其余照常聚齐） ——
    if (sumsSet !== null) {
        diffParties("目录实况", dirSet, `${SUMS_NAME} 登记`, sumsSet, violations);
    }
    if (testSet !== null) {
        diffParties("目录实况", dirSet, "测试注册表", testSet, violations);
        if (sumsSet !== null) {
            diffParties(`${SUMS_NAME} 登记`, sumsSet, "测试注册表", testSet, violations);
        }
    }

    if (violations.length > 0) {
        const counts = [`目录实况 ${dirSet.size} 份`, `${SUMS_NAME} 登记 ${sumsCount} 行`];
        if (testSet !== null) {
            counts.push(`测试注册表 ${testCount} 条`);
        }
        console.log(
            `${TAG} 失败：共 ${violations.length} 处违规` +
                `（版本目录 fixtures/${versionDir}；${counts.join(" / ")}）：`,
        );
        for (let i = 0; i < violations.length; i++) {
            console.log(`  ${i + 1}. ${violations[i]}`);
        }
        process.exit(1);
    }

    if (repoMode) {
        console.log(
            `${TAG} 通过：仓内三方模式，版本目录 fixtures/${versionDir}` +
                `（package.json version ${pkgVersion} 推导），金样本 ${dirSet.size} 份` +
                `（目录 ${dirSet.size} / ${SUMS_NAME} ${sumsCount} / 测试注册表 ${testCount}），` +
                `目录文件数 ${allFiles.length}（含 ${SUMS_NAME}），sha256 实算 ${sumsCount}/${sumsCount} 全符。`,
        );
    } else {
        console.log(
            `${TAG} 通过：包内两方模式，版本目录 fixtures/${versionDir}` +
                `（package.json version ${pkgVersion} 推导），金样本 ${dirSet.size} 份` +
                `（目录 ${dirSet.size} / ${SUMS_NAME} ${sumsCount}），` +
                `目录文件数 ${allFiles.length}（含 ${SUMS_NAME}），sha256 实算 ${sumsCount}/${sumsCount} 全符。`,
        );
    }
}

main();
