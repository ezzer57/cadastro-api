const crypto = require("crypto");
const { limparEspacos } = require("./texto");

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
  return {
    id: crypto.randomUUID(),
    ...padronizarDados(dados),
    criadoEm: new Date().toISOString(),
  };
}

module.exports = { padronizarNome, padronizarEmail, padronizarDados, criarUsuario };
