import NextAuth, { type NextAuthConfig } from 'next-auth';

function getOidcProviders() {
  const issuer = process.env.AUTH_OIDC_ISSUER;
  const clientId = process.env.AUTH_OIDC_CLIENT_ID;
  const clientSecret = process.env.AUTH_OIDC_CLIENT_SECRET;

  if (!issuer || !clientId) {
    return [];
  }

  return [
    {
      id: 'oidc',
      name: 'OpenID Connect',
      type: 'oidc' as const,
      issuer,
      clientId,
      clientSecret,
    },
  ];
}

export const authConfig: NextAuthConfig = {
  providers: getOidcProviders(),
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.sub = account.providerAccountId ?? token.sub;
        token.iss = account.issuer ?? process.env.AUTH_OIDC_ISSUER ?? 'oidc';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? session.user.id;
        (session as unknown as { issuer?: string }).issuer =
          (token.iss as string) ?? (token.issuer as string);
      }
      return session;
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
