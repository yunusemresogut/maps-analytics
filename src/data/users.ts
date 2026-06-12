import {
  DEFAULT_USER_PERMISSIONS,
  getAdminPermissions,
} from "@/lib/permissions";
import type { User } from "@/types";

export const mockUsers: (User & { password: string })[] = [
  {
    id: "admin-1",
    email: "admin@demo.com",
    name: "Admin",
    role: "admin",
    permissions: getAdminPermissions(),
    password: "admin123",
  },
  {
    id: "user-1",
    email: "ahmet@demo.com",
    name: "Ahmet Yılmaz",
    role: "user",
    permissions: { ...DEFAULT_USER_PERMISSIONS },
    password: "user123",
  },
  {
    id: "user-2",
    email: "ayse@demo.com",
    name: "Ayşe Demir",
    role: "user",
    permissions: {
      view: true,
      add: false,
      edit: true,
      delete: false,
    },
    password: "user123",
  },
];
