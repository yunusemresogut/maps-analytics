"use client";

import { AdminMobileTopBar } from "@/components/admin/admin-sidebar";
import { useAdminLayout } from "@/contexts/admin-layout-context";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function AdminPageHeader({
  title,
  description,
  children,
}: AdminPageHeaderProps) {
  const { openMobileMenu } = useAdminLayout();

  return (
    <>
      <AdminMobileTopBar title={title} onMenuOpen={openMobileMenu} />
      <div className="border-b border-zinc-800/80 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="hidden text-xl font-semibold text-zinc-100 lg:block sm:text-2xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export function AdminPageBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`scrollbar-themed flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
