/**
 * check-doc-links —— 仓内相对路径死链检查（pnpm verify:docs）
 *
 * 用途：扫描 README.md、AGENTS.md、docs 下全部 .md、src 下全部 .ts（存在的才查），提取全部
 * 仓内相对路径 token（markdown 链接、正文、注释一视同仁），逐一以 fs.existsSync 判
 * 存在（目录也算过）；有死链即输出「文件:行号 → 路径」清单并 exit 1。
 *
 * 纪律出处（Koishi-CE）：docs ↔ code 机械联动——文档引用的仓内路径必须真实存在，
 * 防止文件改名/搬迁后文档无声腐烂。2026-09-17 实证：全仓唯一真实死链是
 * src/index.ts:8 的 docs/protocol/peer-guide.md（历史包布局残留，并行修复中）；
 * 其余不存在的 token 均为跨仓引用，见下方豁免清单（每条带证据）。
 *
 * 零 npm 依赖（仅 Node 内建）；只经 npm scripts 调用，无需 shebang。仓根由
 * import.meta.url 推导，不依赖 cwd。dist/、node_modules 等构建产物不在提取模式的
 * 前缀（docs|src|fixtures|scripts）内，天然跳过——产物非源码契约，勿加入模式。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 仓内相对路径 token：markdown 链接、正文、注释一视同仁（已知局限：紧邻的英文句点等
// 标点会被并入 token——本仓行文路径均以反引号或 CJK 标点收尾，不受影响）
const TOKEN = /(?:docs|src|fixtures|scripts)\/[A-Za-z0-9_.\-\/]+/g;

/**
 * 豁免清单：指向姊妹仓（主仓 KuroAdapter / KuroAdapter-Pure）布局的跨仓引用，本仓
 * 不存在同名文件；每条附证据理由。files 省略 = 全局豁免，否则仅豁免指定文件。
 */
const EXEMPTIONS = [
    {
        // 主仓 KuroAdapter 的历史文档目录（本仓 docs/ 扁平无子目录）。引用处均带平移
        // 出处头或「主仓」限定：docs/design.md L3-6、docs/changelog.md L5、src/frame.ts
        // / src/index.ts / src/messages/ws.ts 的历史出处注释。
        match: /^docs\/history\//,
    },
    {
        // KuroAdapter-Pure 仓文件：docs/BOOTSTRAP-NOTES.md:4 明确限定「其 docs/STATUS.md」。
        match: /^docs\/STATUS\.md$/,
    },
    {
        // 主仓 KuroAdapter 的镜像门禁脚本（跨仓固定引用：docs/DECISIONS.md ADR-001、
        // docs/MIRROR-RESYNC.md、docs/RELEASE.md 协同节均指主仓侧该脚本），本仓无此文件。
        match: /^scripts\/check-protocol-mirror\.mjs$/,
    },
];

function isExempt(relFile, token) {
    for (const exemption of EXEMPTIONS) {
        if (!exemption.match.test(token)) {
            continue;
        }
        return exemption.files === undefined || exemption.files.includes(relFile);
    }
    return false;
}

/** 递归收集 dir 下指定扩展名的文件（排除不存在的情况由调用方 existsSync 把关）。 */
function walk(dir, extension, accumulator) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, extension, accumulator);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            accumulator.push(full);
        }
    }
    return accumulator;
}

const targets = [];
for (const rootFile of ["README.md", "AGENTS.md"]) {
    const full = join(REPO_ROOT, rootFile);
    if (existsSync(full)) {
        targets.push(full);
    }
}
const docsDir = join(REPO_ROOT, "docs");
if (existsSync(docsDir)) {
    targets.push(...walk(docsDir, ".md", []));
}
const srcDir = join(REPO_ROOT, "src");
if (existsSync(srcDir)) {
    targets.push(...walk(srcDir, ".ts", []));
}
targets.sort();

let referenceCount = 0;
let exemptCount = 0;
const violations = [];
for (const file of targets) {
    const relFile = relative(REPO_ROOT, file).replaceAll("\\", "/");
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
        for (const token of line.match(TOKEN) ?? []) {
            referenceCount += 1;
            if (isExempt(relFile, token)) {
                exemptCount += 1;
                continue;
            }
            if (!existsSync(join(REPO_ROOT, token))) {
                violations.push(`${relFile}:${index + 1} → ${token}`);
            }
        }
    }
}

if (violations.length > 0) {
    console.log(
        `[verify:docs] 失败：${violations.length} 处死链（检查 ${targets.length} 个文件，` +
            `提取 ${referenceCount} 处仓内路径引用，豁免 ${exemptCount} 处跨仓引用）：`,
    );
    for (const violation of violations) {
        console.log(`  ${violation}`);
    }
    process.exit(1);
}

console.log(
    `[verify:docs] 通过：检查 ${targets.length} 个文件，提取 ${referenceCount} 处仓内路径引用` +
        `（豁免 ${exemptCount} 处跨仓引用），死链 0。`,
);
