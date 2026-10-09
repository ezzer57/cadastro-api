const crypto = require("crypto");

const LIMITES = { nomeMin: 2, idadeMin: 0, idadeMax: 150 };
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarUsuario({ nome, email, idade } = {}) {
  const erros = [];

  if (typeof nome !== "string" || nome.trim().length < LIMITES.nomeMin) {
    erros.push(`nome é obrigatório (mínimo ${LIMITES.nomeMin} caracteres)`);
  }
  if (typeof email !== "string" || !FORMATO_EMAIL.test(email.trim())) {
    erros.push("email inválido");
  }
  if (!Number.isInteger(idade) || idade < LIMITES.idadeMin || idade > LIMITES.idadeMax) {
    erros.push(`idade deve ser um número inteiro entre ${LIMITES.idadeMin} e ${LIMITES.idadeMax}`);
  }

  return erros;
}

function padronizarDados({ nome, email, idade }) {
  return {
    nome: nome.trim().normalize("NFC"),
    email: email.trim().toLowerCase(),
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

module.exports = { LIMITES, validarUsuario, padronizarDados, criarUsuario };
