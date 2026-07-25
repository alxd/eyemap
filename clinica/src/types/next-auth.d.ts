import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      clinicId: string;
      role: "admin" | "doctor";
    } & DefaultSession["user"];
  }

  interface User {
    clinicId: string;
    role: "admin" | "doctor";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    clinicId: string;
    role: "admin" | "doctor";
  }
}
