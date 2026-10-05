import NextAuth, { type Session } from "next-auth";
import GitHub from "next-auth/providers/github";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function normalizedGitHubId(value: unknown): string | undefined {
  const candidate = typeof value === "number" && Number.isSafeInteger(value)
    ? String(value)
    : typeof value === "string"
      ? value.trim()
      : "";
  return /^[1-9]\d*$/.test(candidate) ? candidate : undefined;
}

export function configuredAdminGitHubId(): string | undefined {
  return normalizedGitHubId(process.env.FALCON_FUEL_ADMIN_GITHUB_ID);
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET
    && process.env.AUTH_GITHUB_ID
    && process.env.AUTH_GITHUB_SECRET
    && configuredAdminGitHubId(),
  );
}

export function isAllowedAdminGitHubId(
  candidate: unknown,
  allowedGitHubId = configuredAdminGitHubId(),
): boolean {
  return Boolean(allowedGitHubId && normalizedGitHubId(candidate) === allowedGitHubId);
}

export function isAdminSession(
  session: Session | null,
  allowedGitHubId = configuredAdminGitHubId(),
): boolean {
  return isAllowedAdminGitHubId(session?.user.githubId, allowedGitHubId);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: {
    strategy: "jwt",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/admin/sign-in",
    error: "/admin/sign-in",
  },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "github"
        && isAllowedAdminGitHubId(profile?.id);
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.githubId = normalizedGitHubId(profile?.id);
      }
      return token;
    },
    session({ session, token }) {
      session.user.githubId = normalizedGitHubId(token.githubId);
      return session;
    },
  },
});
