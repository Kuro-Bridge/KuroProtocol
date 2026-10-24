/**
 * verify-trust —— npm 可信发布（OIDC）信任配置预检（pnpm verify:trust；仅发布链调用）
 *
 * 用途：在 `npm publish` 之前，用 Actions 的 id_token 去换一次该包的**包级短时 token**。
 * 换到 = 该包当前有可用的信任配置；registry 回 404 = 没配 / claim 与 release.yml 不符 /
 * 配了但超过 2 天没完成首发而失效（npm 对三者一律回 404，且在 npm CLI 里只写 verbose
 * 日志，最终只剩一句需要认证的 ENEEDAUTH）。本脚本把这层失败提前成一条可执行的报错。
 *
 * 只在本仓发布链的 publish 环（`id-token: write` + `environment: release`）里有意义：
 * 本地没有 ACTIONS_ID_TOKEN_REQUEST_*，直接红退并说明原因；不会拿任何长期凭证。
 * 换到的 token 只用于判定成败，用完即弃，绝不打印、不落盘。
 *
 * 零 npm 依赖（仅 node: 内建 + 全局 fetch）；仓根由 import.meta.url 推导，不依赖 cwd。
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAG = "[verify:trust]";
const REGISTRY = "https://registry.npmjs.org";
const REGISTRY_HOST = new URL(REGISTRY).hostname;
const REQUEST_TIMEOUT_MS = 15_000;

/** 发布失败时打印的信任配置说明（repo 取 Actions 环境变量，避免写死仓库名）。 */
function printTrustGuidance(name: string): void {
    const repo = process.env["GITHUB_REPOSITORY"] ?? "Kuro-Bridge/KuroProtocol";
    console.log(`${TAG} 处置（本机 npm login，npm ≥ 11.15）：`);
    console.log(
        `${TAG}   npm trust github ${name} --file release.yml --repo ${repo} ` +
            "--environment release --allow-publish --yes",
    );
    console.log(
        `${TAG} 已有失效记录先 npm trust revoke ${name} --id <id> 再重建；` +
            "信任配置建成后 2 天内必须完成首次发布，逾期失效且不可编辑。",
    );
}

function fail(detail: string): never {
    console.log(`${TAG} ❌ ${detail}`);
    process.exit(1);
}

/** 读取 package.json 的包名（缺失直接红退）。 */
function readPackageName(): string {
    let raw: string;
    try {
        raw = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fail(`无法读取 package.json：${message}`);
    }
    const parsed: unknown = JSON.parse(raw);
    const name =
        typeof parsed === "object" && parsed !== null
            ? (parsed as { name?: unknown }).name
            : undefined;
    if (typeof name !== "string" || name === "") {
        fail("package.json 缺少 name");
    }
    return name;
}

/** 取 Actions 的 id_token（只有 `id-token: write` 的 job 才会注入两个环境变量）。 */
async function fetchIdToken(): Promise<string> {
    const endpoint = process.env["ACTIONS_ID_TOKEN_REQUEST_URL"];
    const requestToken = process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"];
    if (
        endpoint === undefined ||
        endpoint === "" ||
        requestToken === undefined ||
        requestToken === ""
    ) {
        fail(
            "缺少 ACTIONS_ID_TOKEN_REQUEST_URL / ACTIONS_ID_TOKEN_REQUEST_TOKEN：" +
                "本脚本只能在声明 id-token: write 的 Actions job 内运行",
        );
    }
    const url = new URL(endpoint);
    // audience 与 npm CLI 一致：npm:<registry 主机名>
    url.searchParams.append("audience", `npm:${REGISTRY_HOST}`);
    const response = await fetch(url, {
        headers: {
            accept: "application/json",
            authorization: `Bearer ${requestToken}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        fail(`GitHub id_token 请求失败：HTTP ${response.status}`);
    }
    const body = (await response.json()) as { value?: unknown };
    if (typeof body.value !== "string" || body.value === "") {
        fail("GitHub id_token 响应缺少 value");
    }
    return body.value;
}

/** registry 错误响应里的 message（拿不到就退回空串）。 */
async function readRegistryMessage(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { message?: unknown };
        return typeof body.message === "string" ? body.message : "";
    } catch {
        return "";
    }
}

/** 复刻 npm CLI 的换 token 请求：POST /-/npm/v1/oidc/token/exchange/package/<包名>。 */
async function exchangeForPackage(idToken: string, name: string): Promise<void> {
    const escapedName = name.split("/").join("%2F");
    const response = await fetch(
        `${REGISTRY}/-/npm/v1/oidc/token/exchange/package/${escapedName}`,
        {
            method: "POST",
            headers: {
                accept: "application/json",
                authorization: `Bearer ${idToken}`,
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
    );
    if (response.ok) {
        const body = (await response.json()) as { token?: unknown };
        if (typeof body.token !== "string" || body.token === "") {
            fail("换 token 响应缺少 token");
        }
        console.log(`${TAG} ✅ 已换到包级短时 token：信任配置可用（token 不打印、不落盘）`);
        return;
    }
    const message = await readRegistryMessage(response);
    if (response.status === 404) {
        console.log(`${TAG} ❌ registry 回 404：该包当前没有可用的 npm 信任配置。`);
        console.log(
            `${TAG} 三种原因同码：没配 / claim 与 release.yml 不符 / 建成后超过 2 天没完成首次发布而失效。`,
        );
        printTrustGuidance(name);
        process.exit(1);
    }
    console.log(
        `${TAG} ⚠️ 换 token 失败（HTTP ${response.status}${message === "" ? "" : `：${message}`}）` +
            "——非 404，不拦截发布；npm publish 会再次尝试",
    );
}

async function main(): Promise<void> {
    const name = readPackageName();
    console.log(`${TAG} 预检 npm 可信发布配置：${name} @ ${REGISTRY}`);
    const idToken = await fetchIdToken();
    await exchangeForPackage(idToken, name);
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${TAG} ❌ ${message}`);
    process.exitCode = 1;
});
