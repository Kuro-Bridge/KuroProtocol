/**
 * check-doc-links —— 仓内相对路径死链检查（pnpm verify:docs）
 *
 * 用途：扫描 README.md、AGENTS.md、docs 下全部 .md、src 下全部 .ts（存在的才查），提取全部
 * 仓内相对路径 token（markdown 链接、正文、注释一视同仁），逐一以 fs.existsSync 判
 * 存在（目录也算过）；有死链即输出「文件:行号 → 路径」清单并 exit 1。
 *
 * 纪律出处（Koishi-CE）：docs ↔ code 机械联动——文档引用的仓内路径必须真实存在，
 * 防止文件改名/搬迁后文档无声腐烂。跨仓引用不检查，逐条登记在豁免清单（每条带理由）。
 * 2026-10 文档重构后仅存一类跨仓引用：src 注释保留的主仓历史草案目录（docs/history/）。
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
const TOKEN = /(?:docs|src|fixtures|scripts)\/[A-Za-z0-9_.\-/]+/g;

interface Exemption {
    readonly match: RegExp;
    readonly files?: readonly string[];
}

/**
 * 豁免清单：指向姊妹仓（主仓 KuroAdapter / KuroAdapter-Pure）布局的跨仓引用，本仓
 * 不存在同名文件；每条附证据理由。files 省略 = 全局豁免，否则仅豁免指定文件。
 */
const EXEMPTIONS: readonly Exemption[] = [
    {
        // 主仓 KuroAdapter 的历史文档目录：src 注释保留的历史草案出处引用
        // （src/index.ts / src/frame.ts / src/messages/ws.ts 指向主仓 docs/history/draft-v0.1.md）。
        match: /^docs\/history\//,
    },
];

function isExempt(relFile: string, token: string): boolean {
    for (const exemption of EXEMPTIONS) {
        if (!exemption.match.test(token)) {
            continue;
        }
        return exemption.files === undefined || exemption.files.includes(relFile);
    }
    return false;
}

/** 递归收集 dir 下指定扩展名的文件（排除不存在的情况由调用方 existsSync 把关）。 */
function walk(dir: string, extension: string, accumulator: string[]): string[] {
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

const targets: string[] = [];
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
const violations: string[] = [];
for (const file of targets) {
    const relFile = relative(REPO_ROOT, file).split("\\").join("/");
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
