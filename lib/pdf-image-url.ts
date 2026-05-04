/**
 * Append Supabase image transform parameters when the URL is a Supabase storage URL.
 * Returns original URL otherwise. PDF rendering benefits from a fixed aspect ratio
 * since @react-pdf/renderer Image lacks objectFit support.
 */
export function pdfImageUrl(
  url: string | null | undefined,
  width = 1000,
  height = 480,
): string | null {
  if (!url) return null;
  if (url.includes("supabase.co/storage")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}width=${width}&height=${height}&resize=cover&quality=85`;
  }
  return url;
}
