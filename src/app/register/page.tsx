import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { tr } from "@/i18n/dictionaries/tr";

export const metadata: Metadata = {
  title: tr.pageTitle.register,
  description: tr.auth.registerSubtitle,
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
