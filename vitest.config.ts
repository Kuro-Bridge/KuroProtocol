/**
 * Vitest 配置
 *
 * 测试文件放在 src/ 内（与源码相邻，biome + tsc 自动纳入检查），只测包内纯逻辑。
 * 夹具一致性门禁（src/fixtures.test.ts）以静态 import 引入根目录 fixtures 下的全部金样本 JSON，
 * 不用 node:fs 保持 src 零 Node API。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        environment: "node",
    },
});
