/** @format */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: 'export',
	trailingSlash: true,
	images: {
		unoptimized: true
	},
	outputFileTracingRoot: __dirname,
	// Note: rewrites are not supported with static export
	// API calls should be made directly to the backend URL in the frontend code
};

export default nextConfig;
