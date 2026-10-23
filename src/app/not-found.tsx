import type { Metadata } from "next";
import { NotFoundView } from "@/components/layout/not-found-view";
import { tr } from "@/i18n/dictionaries/tr";

export const metadata: Metadata = {
  title: tr.pageTitle.notFound,
};

export default function NotFound() {
  return <NotFoundView />;
}
