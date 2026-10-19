"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sameCityName } from "@/data/regions";
import { reverseGeocode, searchAddresses, type Coords, type GeocodeResult } from "@/lib/geocode";

/**
 * Mağaza konumu tek doğruluk kaynağıdır: pin (koordinat) ↔ şehir/ilçe/ülke ↔ adres
 * birbirinden kopamaz.
 * - Pin haritadan seçilir/sürüklenirse adres, şehir, ilçe ve ülke konumdan yeniden bulunur
 * - Adres aramasından seçim yapılırsa hepsi birlikte gelir
 * - Şehir, ilçe ve ülke elle yazılmaz; her zaman konumdan türetilir
 *   (Türkiye'de şehir = 81 ilden biri; yurt dışında şehir/kasaba)
 * - Adres metni detay için (bina, kat) düzenlenebilir; düzenlenirse
 *   "konumu bu adrese taşı" ile pin adrese götürülebilir
 */
export type StoreLocation = {
  coords: Coords | null;
  city: string;
  district: string;
  country: string;
  address: string;
};

export type LocationStatus =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "error"; message: string };

export function useStoreLocation(initial: StoreLocation, options: { verifyInitial?: boolean } = {}) {
  const [location, setLocation] = useState<StoreLocation>(initial);
  const [status, setStatus] = useState<LocationStatus>({ kind: "idle" });
  /** Adres metni kullanıcı tarafından konumdan bağımsız değiştirildi mi */
  const [addressEdited, setAddressEdited] = useState(false);
  /** Konum ilk değerden farklı mı (düzenlemede kaydedilecek değişiklik) */
  const [changed, setChanged] = useState(false);
  /** Kayıtlı şehir pinin gerçek konumuyla uyuşmuyorsa konuma göre doğru şehir */
  const [mismatchCity, setMismatchCity] = useState<string | null>(null);
  // Art arda işlemlerde eski isteğin yanıtı yenisini ezmesin
  const requestId = useRef(0);

  const applyResult = useCallback((result: GeocodeResult, keepAddress?: string) => {
    setLocation({
      coords: { latitude: result.latitude, longitude: result.longitude },
      city: result.city,
      district: result.district,
      country: result.country,
      address: keepAddress ?? result.address,
    });
    setAddressEdited(false);
    setMismatchCity(null);
    setChanged(true);
    setStatus({ kind: "idle" });
  }, []);

  /**
   * Mevcut mağaza açılınca kayıtlı şehir bir kez konumla karşılaştırılır:
   * eksik ilçe/ülke sessizce tamamlanır, şehir uyuşmuyorsa uyarı verilir.
   * Kullanıcı bu sırada pini değiştirirse sonuç yok sayılır.
   */
  const verifyStarted = useRef(false);
  useEffect(() => {
    if (!options.verifyInitial || verifyStarted.current || !initial.coords) return;
    verifyStarted.current = true;
    const id = requestId.current;
    const coords = initial.coords;
    void reverseGeocode(coords)
      .then((result) => {
        if (id !== requestId.current || !result?.city) return;
        setLocation((prev) => ({
          ...prev,
          district: prev.district || result.district,
          country: prev.country || result.country,
        }));
        if (!sameCityName(result.city, initial.city)) setMismatchCity(result.city);
      })
      .catch(() => undefined);
  }, [options.verifyInitial, initial.coords, initial.city]);

  /** Pin haritadan seçildi ya da sürüklendi */
  const setFromMap = useCallback(async (coords: Coords) => {
    const id = ++requestId.current;
    // Pin hemen yerine gider; şehir ve adres bulunana kadar kayıt engellenir
    setLocation((prev) => ({ ...prev, coords, city: "", district: "", country: "" }));
    setMismatchCity(null);
    setChanged(true);
    setStatus({ kind: "resolving" });
    try {
      const result = await reverseGeocode(coords);
      if (id !== requestId.current) return;
      if (!result?.city) {
        setStatus({ kind: "error", message: "Bu noktanın şehri belirlenemedi (deniz ya da boş alan olabilir). Başka bir nokta seçin." });
        return;
      }
      applyResult({ ...result, ...coords });
    } catch {
      if (id !== requestId.current) return;
      setStatus({ kind: "error", message: "Bu nokta için adres bulunamadı. Tekrar deneyin ya da adres arayın." });
    }
  }, [applyResult]);

  /** Pin yerinde kalır; şehir/ilçe/ülke mevcut konumdan yeniden bulunur. Yazılan adres korunur. */
  const resolveCurrent = useCallback(async () => {
    const coords = location.coords;
    if (!coords) return;
    const keep = location.address.trim() ? location.address : undefined;
    const id = ++requestId.current;
    setStatus({ kind: "resolving" });
    try {
      const result = await reverseGeocode(coords);
      if (id !== requestId.current) return;
      if (!result?.city) {
        setStatus({ kind: "error", message: "Bu konumun şehri belirlenemedi. Pini doğru yere taşıyın." });
        return;
      }
      applyResult({ ...result, ...coords }, keep);
    } catch {
      if (id !== requestId.current) return;
      setStatus({ kind: "error", message: "Konumdan şehir bulunamadı. Tekrar deneyin." });
    }
  }, [location.coords, location.address, applyResult]);

  /** Adres aramasından bir sonuç seçildi */
  const setFromSearch = useCallback((result: GeocodeResult) => {
    ++requestId.current;
    applyResult(result);
  }, [applyResult]);

  /** Kullanıcı adres metnini düzenledi (pin yerinde kalır) */
  const editAddress = useCallback((address: string) => {
    setLocation((prev) => ({ ...prev, address }));
    setAddressEdited(true);
    setChanged(true);
  }, []);

  /** Yazılan adresi bulup pini oraya taşır; kullanıcının yazdığı metin korunur */
  const locateAddress = useCallback(async () => {
    const text = location.address.trim();
    if (text.length < 3) return;
    const id = ++requestId.current;
    setStatus({ kind: "resolving" });
    try {
      const query = location.city && !text.toLocaleLowerCase("tr-TR").includes(location.city.toLocaleLowerCase("tr-TR"))
        ? `${text}, ${location.city}`
        : text;
      const [best] = await searchAddresses(query);
      if (id !== requestId.current) return;
      if (!best) {
        setStatus({ kind: "error", message: "Bu adres haritada bulunamadı. Adresi sadeleştirin ya da pini haritadan seçin." });
        return;
      }
      applyResult(best, text);
    } catch {
      if (id !== requestId.current) return;
      setStatus({ kind: "error", message: "Adres araması başarısız. Tekrar deneyin." });
    }
  }, [location.address, location.city, applyResult]);

  /** Kaydetmeye hazır mı; değilse nedeni */
  const blocker =
    status.kind === "resolving"
      ? "Konum bilgisi bulunuyor, lütfen bekleyin."
      : !location.coords
        ? "Önce haritadan konum seçin veya adres arayın."
        : !location.city.trim()
          ? "Konumun şehri belirlenemedi. Pini başka bir noktaya taşıyın."
          : mismatchCity
            ? `Kayıtlı şehir (${location.city}) pinin konumuyla uyuşmuyor. "Şehri konumdan düzelt" ile düzeltin ya da pini taşıyın.`
            : location.address.trim().length < 5
              ? "Adres eksik."
              : null;

  return {
    location,
    status,
    addressEdited,
    changed,
    mismatchCity,
    blocker,
    setFromMap,
    setFromSearch,
    resolveCurrent,
    editAddress,
    locateAddress,
  };
}

export type StoreLocationController = ReturnType<typeof useStoreLocation>;
