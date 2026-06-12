"use client";

import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import {
  StoreFormFields,
  emptyStoreForm,
  formToStoreData,
} from "@/components/map/store-form-fields";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";
import { useState } from "react";

type AddStorePanelProps = {
  coords: { latitude: number; longitude: number };
  onClose: () => void;
  onSaved: (storeId: string) => void;
};

export function AddStorePanel({ coords, onClose, onSaved }: AddStorePanelProps) {
  const { user } = useAuth();
  const { addStore } = useStores();
  const [form, setForm] = useState(emptyStoreForm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const store = addStore(formToStoreData(form, coords), {
      userId: user.id,
      userName: user.name,
    });
    onSaved(store.id);
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 w-full max-w-md animate-in slide-in-from-right">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-zinc-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h3 className="font-semibold text-zinc-100">Yeni Konum Ekle</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="h-3 w-3" />
              {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-themed flex-1 overflow-y-auto p-4">
          <StoreFormFields form={form} onChange={setForm} />
        </div>

        <div className="flex gap-2 border-t border-zinc-800 p-4">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button type="submit" className="flex-1">
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  );
}
