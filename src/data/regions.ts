import type { Region } from "@/types";

export const defaultRegions: Region[] = [
  {
    id: "marmara",
    name: "Marmara",
    cities: ["İstanbul", "Bursa", "Kocaeli", "Tekirdağ", "Edirne"],
    color: "#3a66c4",
  },
  {
    id: "ege",
    name: "Ege",
    cities: ["İzmir", "Manisa", "Aydın", "Muğla", "Denizli"],
    color: "#8a76cb",
  },
  {
    id: "akdeniz",
    name: "Akdeniz",
    cities: ["Antalya", "Adana", "Mersin", "Hatay", "Isparta"],
    color: "#3f9a9b",
  },
  {
    id: "ic-anadolu",
    name: "İç Anadolu",
    cities: ["Ankara", "Konya", "Kayseri", "Eskişehir", "Sivas"],
    color: "#cc9a45",
  },
  {
    id: "karadeniz",
    name: "Karadeniz",
    cities: ["Samsun", "Trabzon", "Ordu", "Rize", "Zonguldak"],
    color: "#43a882",
  },
  {
    id: "guneydogu",
    name: "Güneydoğu",
    cities: ["Gaziantep", "Diyarbakır", "Şanlıurfa", "Mardin", "Adıyaman"],
    color: "#d27f4b",
  },
  {
    id: "dogu-anadolu",
    name: "Doğu Anadolu",
    cities: ["Erzurum", "Van", "Malatya", "Elazığ", "Ağrı"],
    color: "#c56a93",
  },
];

export const ALL_TURKEY_CITIES = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bartın",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Düzce",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Iğdır",
  "Isparta",
  "İstanbul",
  "İzmir",
  "Kahramanmaraş",
  "Karabük",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kırıkkale",
  "Kırklareli",
  "Kırşehir",
  "Kilis",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Şanlıurfa",
  "Şırnak",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Uşak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
];

const TR_FOLD: Record<string, string> = { ı: "i", ğ: "g", ü: "u", ş: "s", ö: "o", ç: "c", â: "a", î: "i", û: "u" };

/** "IZMIR", "izmir", "İzmir İli" → "izmir": klavye ve büyük harf farkları eşleşmeyi bozmasın */
function normalizeCityName(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıığüşöçâîû]/g, (ch) => TR_FOLD[ch] ?? ch)
    .replace(/\s+(ili|province)$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Serbest yazılmış il adını 81 ilden birine eşler (büyük/küçük harf ve "İli" eki farkı yok sayılır) */
export function canonicalProvince(name: string | null | undefined): string | null {
  if (!name) return null;
  const target = normalizeCityName(name);
  return ALL_TURKEY_CITIES.find((city) => normalizeCityName(city) === target) ?? null;
}

/** İki şehir adı aynı mı (büyük/küçük harf, Türkçe karakter ve "İli" eki farkı yok sayılır) */
export function sameCityName(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeCityName(a) === normalizeCityName(b);
}

export function isProvince(name: string | null | undefined): boolean {
  return canonicalProvince(name) !== null;
}

export function findRegionForCity(
  city: string,
  regions: Region[]
): Region | undefined {
  // Türkçe büyük/küçük harf (İ/i, I/ı) doğru eşleşsin
  const target = normalizeCityName(city);
  return regions.find((r) =>
    r.cities.some((c) => normalizeCityName(c) === target)
  );
}
