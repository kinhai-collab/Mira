/** @format */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	devIndicators: {
		appIsrStatus: false,
		buildActivity: false,
	},
	experimental: {
		// disable the new devtools safely
		turbo: {
			resolveAlias: {},
		},
	},
};

export default nextConfig;
