export type OpeningStatus = "open" | "opening_soon" | "planned";

export type ProjectStatus = "tamamlandi" | "santiye" | "proje" | "beklemede";

export type LocationType = "cadde" | "avm";

export type Store = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  projectStatus: ProjectStatus;
  openingDate: string;
  locationType: LocationType;
  grossM2: number;
  floorCount: number;
  phone?: string;
  isCustom?: boolean;
  createdBy?: string;
};

export type StoreNote = {
  id: string;
  storeId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreFile = {
  id: string;
  storeId: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

export type StoreUserData = {
  notes: StoreNote[];
  files: StoreFile[];
  specialNote: string;
};
