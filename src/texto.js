function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

module.exports = { normalizar };
