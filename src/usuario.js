const crypto = require("crypto");
const { limparEspacos } = require("./texto");

const PAPEIS = { admin: "admin", comum: "comum" };
const CAMPOS_EDITAVEIS = ["nome", "email", "idade"];

function agoraEmIso() {
  return new Date().toISOString();
}

function padronizarNome(nome) {
  return limparEspacos(nome).normalize("NFC");
}

function padronizarEmail(email) {
  return email.trim().toLowerCase();
}

function padronizarDados({ nome, email, idade }) {
  return {
    nome: padronizarNome(nome),
    email: padronizarEmail(email),
    idade,
  };
}

function criarUsuario(dados, { papel = PAPEIS.comum } = {}) {
  const agora = agoraEmIso();
  return {
    id: crypto.randomUUID(),
    ...padronizarDados(dados),
    papel,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function aplicarEdicao(usuario, dados, { senhaMudou = false } = {}) {
  const novosDados = padronizarDados(dados);
  const algumCampoMudou = CAMPOS_EDITAVEIS.some((campo) => usuario[campo] !== novosDados[campo]);
  if (!algumCampoMudou && !senhaMudou) return usuario;

  return { ...usuario, ...novosDados, atualizadoEm: agoraEmIso() };
}

module.exports = { PAPEIS, padronizarNome, padronizarEmail, criarUsuario, aplicarEdicao };
