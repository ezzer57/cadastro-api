const { padronizarNome, padronizarEmail } = require("./usuario");

const LIMITES = {
  nomeMinLetras: 2,
  nomeMax: 100,
  emailMax: 254,
  emailParteLocalMax: 64,
  idadeMin: 0,
  idadeMax: 150,
};

const CARACTERES_PERMITIDOS_NO_NOME = /^[\p{L}\p{M} '’.-]+$/u;
const LETRAS = /\p{L}/gu;
const PARTE_LOCAL_DO_EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
const DOMINIO_DO_EMAIL = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function estaVazio(valor) {
  return valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");
}

function ehObjetoJson(valor) {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function validarNome(valor) {
  if (estaVazio(valor)) return "Informe o nome.";
  if (typeof valor !== "string") return "O nome deve ser um texto.";

  const nome = padronizarNome(valor);
  if (nome.length > LIMITES.nomeMax) return `O nome deve ter no máximo ${LIMITES.nomeMax} caracteres.`;
  if (!CARACTERES_PERMITIDOS_NO_NOME.test(nome)) {
    return "O nome deve conter apenas letras, espaços, hífen, apóstrofo ou ponto.";
  }
  if ((nome.match(LETRAS) ?? []).length < LIMITES.nomeMinLetras) {
    return `O nome deve ter pelo menos ${LIMITES.nomeMinLetras} letras.`;
  }
  return null;
}

function temFormatoDeEmail(email) {
  const partes = email.split("@");
  if (partes.length !== 2) return false;

  const [parteLocal, dominio] = partes;
  return parteLocal.length <= LIMITES.emailParteLocalMax
    && PARTE_LOCAL_DO_EMAIL.test(parteLocal)
    && DOMINIO_DO_EMAIL.test(dominio);
}

function validarEmail(valor) {
  if (estaVazio(valor)) return "Informe o e-mail.";
  if (typeof valor !== "string") return "O e-mail deve ser um texto.";

  const email = padronizarEmail(valor);
  if (email.length > LIMITES.emailMax) return `O e-mail deve ter no máximo ${LIMITES.emailMax} caracteres.`;
  if (!temFormatoDeEmail(email)) return "Informe um e-mail válido, como nome@dominio.com.";
  return null;
}

function validarIdade(valor) {
  if (estaVazio(valor)) return "Informe a idade.";
  if (!Number.isInteger(valor)) return "A idade deve ser um número inteiro.";
  if (valor < LIMITES.idadeMin || valor > LIMITES.idadeMax) {
    return `A idade deve estar entre ${LIMITES.idadeMin} e ${LIMITES.idadeMax}.`;
  }
  return null;
}

const VALIDADORES_POR_CAMPO = { nome: validarNome, email: validarEmail, idade: validarIdade };

function validarDadosDoUsuario(corpo) {
  if (!ehObjetoJson(corpo)) {
    return [{ mensagem: "O corpo da requisição deve ser um objeto JSON com nome, email e idade." }];
  }

  const errosDosCampos = Object.entries(VALIDADORES_POR_CAMPO)
    .map(([campo, validar]) => ({ campo, mensagem: validar(corpo[campo]) }))
    .filter((erro) => erro.mensagem !== null);

  const errosDeCamposDesconhecidos = Object.keys(corpo)
    .filter((campo) => !Object.hasOwn(VALIDADORES_POR_CAMPO, campo))
    .map((campo) => ({ campo, mensagem: `O campo "${campo}" não é permitido.` }));

  return [...errosDosCampos, ...errosDeCamposDesconhecidos];
}

function validarTermoDeBusca(termo) {
  if (typeof termo !== "string") {
    return [{ campo: "nome", mensagem: "Informe um único termo de busca." }];
  }
  if (termo.length > LIMITES.nomeMax) {
    return [{ campo: "nome", mensagem: `O termo de busca deve ter no máximo ${LIMITES.nomeMax} caracteres.` }];
  }
  return [];
}

module.exports = { LIMITES, validarDadosDoUsuario, validarTermoDeBusca };
