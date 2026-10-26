import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authenticateOfficerCredentials } from '@/lib/server/password-auth';

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
  providers: [
    ...getOidcProviders(),
    Credentials({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== 'string' || typeof credentials.password !== 'string') return null;
        return authenticateOfficerCredentials(credentials.email, credentials.password);
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        if (account.provider === 'credentials' && user?.id) {
          token.sub = user.id;
          token.iss = 'casepulse-password';
        } else {
          token.sub = account.providerAccountId ?? token.sub;
          token.iss = account.issuer ?? process.env.AUTH_OIDC_ISSUER ?? 'oidc';
        }
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
