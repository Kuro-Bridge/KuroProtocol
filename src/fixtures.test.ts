/**
 * 金样本夹具一致性门禁（docs/fixtures.md）—— validateFixture 的第一消费方（ADR-002）
 *
 * 契约校验逻辑（fixtureSchema 元 schema、reject.stage 声明一致性、accept/reject × wire/dispatch
 * 三分支、behavior.reply 引用）已平移提炼为 src/fixtures.ts 的纯函数 validateFixture（可分发导出），
 * 本文件只消费其结果：每份金样本必须 ok、name 唯一；行为语义（close/reply 实跑）归各消费方。
 * 静态 import（不用 node:fs）保持 src 零 Node API；新增夹具须在此登记 import 与条目。
 */
import { describe, expect, it } from "vitest";
import bindingsUpdated from "../fixtures/v0.4/frames/bindings-updated.json" with { type: "json" };
import chatGameToPlatform from "../fixtures/v0.4/frames/chat-game-to-platform.json" with {
    type: "json",
};
import chatPlatformToServer from "../fixtures/v0.4/frames/chat-platform-to-server.json" with {
    type: "json",
};
import commandResultForbidden from "../fixtures/v0.4/frames/command-result-forbidden.json" with {
    type: "json",
};
import commandRoundtrip from "../fixtures/v0.4/frames/command-roundtrip.json" with { type: "json" };
import gameEvents from "../fixtures/v0.4/frames/game-events.json" with { type: "json" };
import heartbeatPingPong from "../fixtures/v0.4/frames/heartbeat-ping-pong.json" with {
    type: "json",
};
import queryRoundtrip from "../fixtures/v0.4/frames/query-roundtrip.json" with { type: "json" };
import handshakeHelloSuccess from "../fixtures/v0.4/handshake/hello-success.json" with {
    type: "json",
};
import handshakeTokenAuthClose1008 from "../fixtures/v0.4/handshake/token-auth-close-1008.json" with {
    type: "json",
};
import handshakeVersionMismatchClose1002 from "../fixtures/v0.4/handshake/version-mismatch-close-1002.json" with {
    type: "json",
};
import knownTypeInvalidBody from "../fixtures/v0.4/tolerance/known-type-invalid-body.json" with {
    type: "json",
};
import unknownEventIgnored from "../fixtures/v0.4/tolerance/unknown-event-ignored.json" with {
    type: "json",
};
import unknownRequestUnknownResultReply from "../fixtures/v0.4/tolerance/unknown-request-unknown-result-reply.json" with {
    type: "json",
};
import unknownResultNoEcho from "../fixtures/v0.4/tolerance/unknown-result-no-echo.json" with {
    type: "json",
};
import wireSkeletonInvalid from "../fixtures/v0.4/tolerance/wire-skeleton-invalid.json" with {
    type: "json",
};
import { validateFixture } from "./fixtures.js";

/** 夹具注册表：fixtures/v0.4 全部金样本（新增夹具须在此登记 import 与条目）。 */
const rawFixtures: unknown[] = [
    handshakeHelloSuccess,
    handshakeVersionMismatchClose1002,
    handshakeTokenAuthClose1008,
    chatGameToPlatform,
    chatPlatformToServer,
    commandRoundtrip,
    commandResultForbidden,
    queryRoundtrip,
    heartbeatPingPong,
    bindingsUpdated,
    gameEvents,
    wireSkeletonInvalid,
    knownTypeInvalidBody,
    unknownRequestUnknownResultReply,
    unknownEventIgnored,
    unknownResultNoEcho,
];

/** 从原始 JSON 尽力取 name（测试标题定位用；元校验失败时兜底） */
function sampleNameOf(raw: unknown): string {
    if (typeof raw === "object" && raw !== null && "name" in raw) {
        const name = (raw as { name: unknown }).name;
        if (typeof name === "string" && name !== "") {
            return name;
        }
    }
    return "（name 缺失或非法的样本）";
}

describe("金样本夹具一致性门禁（fixtures/v0.4）", () => {
    it("夹具注册表：全部通过 validateFixture 且 name 唯一", () => {
        const fixtures = rawFixtures.map((raw) => {
            const result = validateFixture(raw);
            if (!result.ok) {
                throw new Error(
                    `${sampleNameOf(raw)}: validateFixture 未通过，issues:\n  ${result.issues.join("\n  ")}`,
                );
            }
            return result.fixture;
        });
        const names = new Set(fixtures.map((fixture) => fixture.name));
        expect(names.size).toBe(fixtures.length);
        // 份数真相移交 scripts/verify-fixtures.mjs 三方一致校验（ADR-003）
    });

    for (const raw of rawFixtures) {
        it(`fixtures: ${sampleNameOf(raw)}`, () => {
            const result = validateFixture(raw);
            const detail = result.ok ? undefined : result.issues.join("\n");
            expect(result.ok, detail).toBe(true);
        });
    }
});
