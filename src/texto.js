function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function limparEspacos(texto) {
  return String(texto).trim().replace(/\s+/g, " ");
}

module.exports = { normalizar, limparEspacos };
