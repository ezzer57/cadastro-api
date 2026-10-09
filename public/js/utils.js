const ENTIDADES_HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const MATIZ_INICIAL_AVATAR = 200;
const FAIXA_DE_MATIZES_AVATAR = 140;

export function escapeHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatarDataHora(dataIso) {
  return FORMATO_DATA_HORA.format(new Date(dataIso));
}

export function plural(quantidade, singular, pluralTexto) {
  return `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
}

export function destacar(nome, termo) {
  if (!termo) return escapeHtml(nome);

  const nomeNfc = nome.normalize("NFC");
  const busca = normalizar(termo);
  const inicio = normalizar(nomeNfc).indexOf(busca);
  if (inicio === -1) return escapeHtml(nomeNfc);

  const fim = inicio + busca.length;
  return escapeHtml(nomeNfc.slice(0, inicio))
    + `<mark>${escapeHtml(nomeNfc.slice(inicio, fim))}</mark>`
    + escapeHtml(nomeNfc.slice(fim));
}

export function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? partes.at(-1)[0] : "";
  return (primeira + ultima).toUpperCase();
}

export function corAvatar(nome) {
  let hash = 0;
  for (const caractere of nome) hash = (hash * 31 + caractere.codePointAt(0)) | 0;

  const matiz = MATIZ_INICIAL_AVATAR + (Math.abs(hash) % FAIXA_DE_MATIZES_AVATAR);
  return `linear-gradient(135deg, hsl(${matiz} 85% 62%), hsl(${matiz + 40} 80% 52%))`;
}
