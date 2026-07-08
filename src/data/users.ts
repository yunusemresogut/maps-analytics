import {
  DEFAULT_USER_PERMISSIONS,
  getAdminPermissions,
} from "@/lib/permissions";
import type { User } from "@/types";

export const mockUsers: (User & { password: string })[] = [
  {
    id: "admin-main",
    email: "admin@admin.com",
    name: "Sistem Yöneticisi",
    role: "admin",
    permissions: getAdminPermissions(),
    password: "admin",
  },
];
