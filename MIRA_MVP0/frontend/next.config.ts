/** @format */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: 'export',
	trailingSlash: true,
	images: {
		unoptimized: true,
		// Allow loading avatars from Google
		domains: [
			"lh3.googleusercontent.com",
			"lh4.googleusercontent.com",
			"lh5.googleusercontent.com"
		]
	},
	outputFileTracingRoot: __dirname,
	// Note: rewrites are not supported with static export
	// API calls should be made directly to the backend URL in the frontend code
};

export default nextConfig;
