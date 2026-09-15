/**
 * 金样本夹具一致性门禁（docs/fixtures.md）
 *
 * 逐一消费 fixtures/v0.4 全部金样本：
 * - accept：每帧按 dir 方向 schema（wsInboundFrame / wsOutboundFrame）解析必须通过；
 * - reject/wire：每帧连 wireFrameSchema 线格式骨架都必须拒绝；
 * - reject/dispatch：每帧过 wire 骨架、但方向 schema 拒绝（两段式解析第二段）。
 * 夹具结构先经 fixtureSchema 元校验；behavior 是行为注记（跨仓契约），此处校验形状与引用有效性。
 * 静态 import（不用 node:fs）保持 src 零 Node API；新增夹具须在此登记。
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
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
import { wireFrameSchema, wsInboundFrame, wsOutboundFrame } from "./index.js";

const REPLY_REF = /^frames\[(\d+)\]$/;

const fixtureSchema = z.object({
    name: z.string().min(1),
    note: z.string().min(1),
    source: z.string().min(1),
    frames: z
        .array(z.object({ dir: z.enum(["peer->server", "server->peer"]), frame: z.unknown() }))
        .min(1),
    expect: z.object({
        schema: z.enum(["accept", "reject"]),
        reject: z.object({ stage: z.enum(["wire", "dispatch"]) }).optional(),
        behavior: z.object({
            reply: z.string().regex(REPLY_REF).nullable(),
            close: z
                .object({
                    code: z.number().int().positive(),
                    reason: z.string().min(1),
                })
                .nullable(),
        }),
    }),
});

type Fixture = z.infer<typeof fixtureSchema>;

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

function directionSchemaOf(dir: "peer->server" | "server->peer") {
    return dir === "peer->server" ? wsInboundFrame : wsOutboundFrame;
}

function assertRejectStageConsistency(fixture: Fixture): void {
    const { expect: exp } = fixture;
    const rejectDefined = exp.reject !== undefined;
    expect(rejectDefined, `${fixture.name}: reject 样本必须声明 reject.stage`).toBe(
        exp.schema === "reject",
    );
}

function assertFrames(fixture: Fixture): void {
    const { expect: exp } = fixture;
    for (const [index, entry] of fixture.frames.entries()) {
        const label = `${fixture.name} frames[${index}]（${entry.dir}）`;
        const wireOk = wireFrameSchema.safeParse(entry.frame).success;
        const directionOk = directionSchemaOf(entry.dir).safeParse(entry.frame).success;
        if (exp.schema === "accept") {
            expect(directionOk, `${label}: 方向 schema 应通过`).toBe(true);
        } else if (exp.reject?.stage === "wire") {
            expect(wireOk, `${label}: wire 骨架应拒绝`).toBe(false);
        } else {
            expect(wireOk, `${label}: wire 骨架应通过`).toBe(true);
            expect(directionOk, `${label}: 方向 schema 应拒绝（两段式第二段）`).toBe(false);
        }
    }
}

function assertBehaviorRef(fixture: Fixture): void {
    const reply = fixture.expect.behavior.reply;
    if (reply === null) {
        return;
    }
    const match = REPLY_REF.exec(reply);
    if (match === null) {
        throw new Error(`${fixture.name}: behavior.reply 引用格式非法（${reply}）`);
    }
    const index = Number(match[1]);
    expect(index, `${fixture.name}: behavior.reply 索引越界`).toBeLessThan(fixture.frames.length);
}

describe("金样本夹具一致性门禁（fixtures/v0.4）", () => {
    it("夹具注册表：全部通过元校验且 name 唯一", () => {
        const parsed = rawFixtures.map((raw) => fixtureSchema.parse(raw));
        const names = new Set(parsed.map((fixture) => fixture.name));
        expect(names.size).toBe(parsed.length);
        expect(parsed.length).toBe(16);
    });

    for (const raw of rawFixtures) {
        const fixture = fixtureSchema.parse(raw);
        it(`fixtures: ${fixture.name}`, () => {
            assertRejectStageConsistency(fixture);
            assertFrames(fixture);
            assertBehaviorRef(fixture);
        });
    }
});
