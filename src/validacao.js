const { padronizarNome, padronizarEmail } = require("./usuario");
const { PAGINACAO } = require("./paginacao");

const LIMITES = {
  nomeMinLetras: 2,
  nomeMax: 100,
  emailMax: 254,
  emailParteLocalMax: 64,
  idadeMin: 0,
  idadeMax: 150,
  senhaMin: 8,
  senhaMax: 128,
};

const CARACTERES_PERMITIDOS_NO_NOME = /^[\p{L}\p{M} '’.-]+$/u;
const LETRAS = /\p{L}/gu;
const PARTE_LOCAL_DO_EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
const DOMINIO_DO_EMAIL = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const NUMERO_POSITIVO_DA_URL = /^[1-9]\d{0,8}$/;

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

function validarSenha(valor) {
  if (estaVazio(valor)) return "Informe a senha.";
  if (typeof valor !== "string") return "A senha deve ser um texto.";
  if (valor.length < LIMITES.senhaMin) return `A senha deve ter pelo menos ${LIMITES.senhaMin} caracteres.`;
  if (valor.length > LIMITES.senhaMax) return `A senha deve ter no máximo ${LIMITES.senhaMax} caracteres.`;
  return null;
}

const VALIDADORES_POR_CAMPO = { nome: validarNome, email: validarEmail, idade: validarIdade, senha: validarSenha };

function errosDeCamposDesconhecidos(corpo, camposPermitidos) {
  return Object.keys(corpo)
    .filter((campo) => !camposPermitidos.includes(campo))
    .map((campo) => ({ campo, mensagem: `O campo "${campo}" não é permitido.` }));
}

function validarDadosDoUsuario(corpo, { senhaObrigatoria = true } = {}) {
  if (!ehObjetoJson(corpo)) {
    return [{ mensagem: "O corpo da requisição deve ser um objeto JSON com os dados do usuário." }];
  }

  const senhaFicaDeFora = !senhaObrigatoria && corpo.senha === undefined;
  const errosDosCampos = Object.entries(VALIDADORES_POR_CAMPO)
    .filter(([campo]) => !(campo === "senha" && senhaFicaDeFora))
    .map(([campo, validar]) => ({ campo, mensagem: validar(corpo[campo]) }))
    .filter((erro) => erro.mensagem !== null);

  return [...errosDosCampos, ...errosDeCamposDesconhecidos(corpo, Object.keys(VALIDADORES_POR_CAMPO))];
}

function validarLogin(corpo) {
  if (!ehObjetoJson(corpo)) {
    return [{ mensagem: "O corpo da requisição deve ser um objeto JSON com email e senha." }];
  }

  const errosDeObrigatorios = [
    { campo: "email", mensagem: "Informe o e-mail." },
    { campo: "senha", mensagem: "Informe a senha." },
  ].filter(({ campo }) => typeof corpo[campo] !== "string" || estaVazio(corpo[campo]));

  return [...errosDeObrigatorios, ...errosDeCamposDesconhecidos(corpo, ["email", "senha"])];
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

function ehNumeroPositivoDaUrl(valor) {
  return typeof valor === "string" && NUMERO_POSITIVO_DA_URL.test(valor);
}

function validarPaginacao({ pagina, limite }) {
  const erros = [];

  if (pagina !== undefined && !ehNumeroPositivoDaUrl(pagina)) {
    erros.push({ campo: "pagina", mensagem: "A página deve ser um número inteiro a partir de 1." });
  }
  if (limite !== undefined && (!ehNumeroPositivoDaUrl(limite) || Number(limite) > PAGINACAO.limiteMaximo)) {
    erros.push({ campo: "limite", mensagem: `O limite deve ser um número inteiro de 1 a ${PAGINACAO.limiteMaximo}.` });
  }

  return erros;
}

module.exports = { validarDadosDoUsuario, validarLogin, validarTermoDeBusca, validarPaginacao };
