import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function logAttempt(email: string, success: boolean) {
  try {
    await prisma.loginAttempt.create({ data: { email, success } });
  } catch (error) {
    console.error("Failed to log login attempt:", error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        // Check if ANY admin exists. If not, create the first one automatically
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });

        if (adminCount === 0) {
          // This is the very first login - create the admin!
          const hashedPassword = await bcrypt.hash(credentials.password, 10);
          const newAdmin = await prisma.user.create({
            data: {
              email: credentials.email,
              password: hashedPassword,
              name: "System Admin",
              role: "ADMIN",
            }
          });
          await logAttempt(credentials.email, true);
          return {
            id: newAdmin.id,
            email: newAdmin.email,
            name: newAdmin.name,
            role: newAdmin.role,
          };
        }

        // Standard login flow
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          await logAttempt(credentials.email, false);
          throw new Error("Invalid credentials");
        }

        if (user.role !== "ADMIN" && user.role !== "EDITOR") {
          await logAttempt(credentials.email, false);
          throw new Error("Access denied: You must be a team member.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          await logAttempt(credentials.email, false);
          throw new Error("Invalid credentials");
        }

        await logAttempt(credentials.email, true);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login', // Redirect back to login on error
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-only-replace-in-production",
};
