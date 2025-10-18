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
	rewrites: async () => {
		const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
		return [
			{
				source: "/greeting",
				destination: `${apiBase}/greeting`,
			},
		];
	},
};

export default nextConfig;
