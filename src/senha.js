const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const PREFIXO = "scrypt";
const BYTES_DO_SAL = 16;
const BYTES_DA_CHAVE = 64;

function montarHash(sal, chave) {
  return [PREFIXO, sal.toString("hex"), chave.toString("hex")].join("$");
}

const HASH_FALSO_PARA_IGUALAR_O_TEMPO = montarHash(crypto.randomBytes(BYTES_DO_SAL), crypto.randomBytes(BYTES_DA_CHAVE));

async function gerarHashDeSenha(senha) {
  const sal = crypto.randomBytes(BYTES_DO_SAL);
  const chave = await scrypt(senha.normalize("NFC"), sal, BYTES_DA_CHAVE);
  return montarHash(sal, chave);
}

async function senhaConfere(senha, hashGuardadoOuNulo) {
  const [, salHex, chaveHex] = (hashGuardadoOuNulo ?? HASH_FALSO_PARA_IGUALAR_O_TEMPO).split("$");
  const chaveGuardada = Buffer.from(chaveHex, "hex");
  const chaveCalculada = await scrypt(senha.normalize("NFC"), Buffer.from(salHex, "hex"), chaveGuardada.length);

  const chavesIguais = crypto.timingSafeEqual(chaveCalculada, chaveGuardada);
  return chavesIguais && hashGuardadoOuNulo !== null;
}

module.exports = { gerarHashDeSenha, senhaConfere };
