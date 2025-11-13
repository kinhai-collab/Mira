/** @format */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Note: removed `output: 'export'` to allow server-side API routes
	// If you need a fully static export, keep `output: 'export'` and
	// host the weather proxy separately (or call your backend directly).
	trailingSlash: true,
	images: {
		unoptimized: true,
		// Allow loading avatars from Google (Next.js 15+ uses remotePatterns)
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
			},
			{
				protocol: 'https',
				hostname: 'lh4.googleusercontent.com',
			},
			{
				protocol: 'https',
				hostname: 'lh5.googleusercontent.com',
			},
		],
	},
	outputFileTracingRoot: __dirname,
	// Note: rewrites are not supported with static export
	// API calls should be made directly to the backend URL in the frontend code
};

export default nextConfig;
