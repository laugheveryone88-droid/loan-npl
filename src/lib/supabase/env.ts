function requirePublicEnvironmentVariable(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local for local development and to your Vercel project settings for production.`,
    );
  }

  return value;
}

export function getSupabaseEnvironment() {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: requirePublicEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requirePublicEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      publishableKey,
    ),
  };
}
