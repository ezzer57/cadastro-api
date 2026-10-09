const jwt = require("jsonwebtoken");
const { NaoAutenticado } = require("./erros");

const ALGORITMO = "HS256";

function criarEmissorDeTokens({ segredo, validade }) {
  if (!segredo) throw new Error("É preciso informar o segredo usado para assinar os tokens.");

  return {
    emitir(usuario) {
      const token = jwt.sign({}, segredo, { algorithm: ALGORITMO, subject: usuario.id, expiresIn: validade });
      const { exp } = jwt.decode(token);
      return { token, expiraEm: new Date(exp * 1000).toISOString() };
    },

    lerIdDoUsuario(token) {
      try {
        return jwt.verify(token, segredo, { algorithms: [ALGORITMO] }).sub;
      } catch (erro) {
        const expirou = erro instanceof jwt.TokenExpiredError;
        throw new NaoAutenticado(expirou ? "Sua sessão expirou. Entre de novo." : "Token inválido. Entre de novo.");
      }
    },
  };
}

module.exports = { criarEmissorDeTokens };
