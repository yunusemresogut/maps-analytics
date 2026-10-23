import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { tr } from "@/i18n/dictionaries/tr";

export const metadata: Metadata = {
  title: tr.pageTitle.login,
  description: tr.auth.userSubtitle,
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return <LoginForm />;
}
