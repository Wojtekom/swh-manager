import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Podaj email i hasło");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (user && user.active) {
          const isValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (isValid) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          }
        }

        throw new Error("Nieprawidłowy email lub hasło");
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
