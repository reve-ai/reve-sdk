import { defineConfig, mergeConfig } from "vitest/config";

import sharedConfig from "@reve-tools/vitest-config/vitest.shared.js";

export default mergeConfig(
	sharedConfig,
	defineConfig({
		test: {
			environment: "happy-dom",
			coverage: {
				thresholds: {
					statements: 70,
					branches: 70,
					functions: 70,
					lines: 70,
					perFile: true,
				},
			},
		},
	}),
);
