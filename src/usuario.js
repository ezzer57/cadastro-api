const crypto = require("crypto");
const { limparEspacos } = require("./texto");

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

function criarUsuario(dados) {
  const agora = agoraEmIso();
  return {
    id: crypto.randomUUID(),
    ...padronizarDados(dados),
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function aplicarEdicao(usuario, dados) {
  const novosDados = padronizarDados(dados);
  const houveMudanca = CAMPOS_EDITAVEIS.some((campo) => usuario[campo] !== novosDados[campo]);
  if (!houveMudanca) return usuario;

  return { ...usuario, ...novosDados, atualizadoEm: agoraEmIso() };
}

module.exports = { padronizarNome, padronizarEmail, padronizarDados, criarUsuario, aplicarEdicao };
