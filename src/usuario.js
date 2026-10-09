const crypto = require("crypto");

const LIMITES = { nomeMin: 2, idadeMin: 0, idadeMax: 150 };
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarCadastro({ nome, email, idade } = {}) {
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

function criarUsuario({ nome, email, idade }) {
  return {
    id: crypto.randomUUID(),
    nome: nome.trim().normalize("NFC"),
    email: email.trim().toLowerCase(),
    idade,
    criadoEm: new Date().toISOString(),
  };
}

module.exports = { LIMITES, validarCadastro, criarUsuario };
