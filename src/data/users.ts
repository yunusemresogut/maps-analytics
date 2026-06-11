import type { User } from "@/types";

export const mockUsers: (User & { password: string })[] = [
  {
    id: "admin-1",
    email: "admin@lcw.com",
    name: "Admin",
    role: "admin",
    password: "admin123",
  },
  {
    id: "user-1",
    email: "ahmet@lcw.com",
    name: "Ahmet Yılmaz",
    role: "user",
    password: "user123",
  },
  {
    id: "user-2",
    email: "ayse@lcw.com",
    name: "Ayşe Demir",
    role: "user",
    password: "user123",
  },
];
