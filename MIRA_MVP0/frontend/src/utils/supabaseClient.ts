/** @format */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables at build time
if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase environment variables!');
	console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
	console.error('Please check your .env.local file or Amplify environment variables.');
	
	// Throw error during build to prevent deployment with missing config
	if (typeof window === 'undefined') {
		throw new Error(
			'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
		);
	}
}

export const supabase = createClient(supabaseUrl, supabaseKey);
