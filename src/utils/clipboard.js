export async function copiarTexto(texto) {
  if (!texto) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // WebView com file:// pode negar a API moderna de clipboard.
    }
  }

  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(area);
  }
}
