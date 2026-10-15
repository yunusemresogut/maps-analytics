/**
 * Harita panelleri, alt ortadaki "Maps'e Sor" barının (bottom-4, h-11)
 * üstünde biter; böylece hiçbir ekran genişliğinde çakışmazlar.
 */
export const MAP_PANEL_BOTTOM_CLASS = "bottom-[4.5rem]";

/** Harita üzerindeki kayan paneller için yükseklik (kısa ekranlarda taşmaz) */
export const MAP_PANEL_HEIGHT_CLASS = "h-[min(80vh,calc(100vh-3.5rem-6rem))]";

export const MAP_PANEL_SHELL_CLASS =
  "flex flex-col overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950/95 backdrop-blur-md shadow-(--panel-shadow)";
