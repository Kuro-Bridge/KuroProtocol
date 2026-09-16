import { defineConfig } from "tsdown";

// 双格式产物（ADR-001）：esm 为主，cjs 供 Koishi loader 等 require 消费方
// （npm 0.1.0 仅 esm 且 exports 缺 require 的 CJS 断裂不在 0.4.0 重演）。
export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
});
