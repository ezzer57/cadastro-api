const { validarLogin } = require("./validacao");
const { padronizarEmail } = require("./usuario");
const { senhaConfere } = require("./senha");
const { ErroDeValidacao, CredenciaisInvalidas, MuitasTentativas, NaoAutenticado } = require("./erros");

function criarServicoDeAutenticacao({ repositorio, emissorDeTokens, limitador }) {
  return {
    async entrar(corpo, origem) {
      ErroDeValidacao.lancarSeHouver(validarLogin(corpo));

      const email = padronizarEmail(corpo.email);
      const chaveDeTentativas = `${origem}|${email}`;
      if (limitador.estaBloqueado(chaveDeTentativas)) {
        throw new MuitasTentativas(limitador.segundosParaLiberar(chaveDeTentativas));
      }

      const credenciais = repositorio.buscarCredenciaisPorEmailOuNulo(email);
      const senhaCorreta = await senhaConfere(corpo.senha, credenciais?.senhaHash ?? null);
      const usuario = senhaCorreta ? repositorio.buscarPorIdOuNulo(credenciais.id) : null;

      if (!usuario) {
        limitador.registrarFalha(chaveDeTentativas);
        throw new CredenciaisInvalidas();
      }

      limitador.esquecer(chaveDeTentativas);
      return { ...emissorDeTokens.emitir(usuario), usuario };
    },

    identificar(token) {
      const usuario = repositorio.buscarPorIdOuNulo(emissorDeTokens.lerIdDoUsuario(token));
      if (!usuario) throw new NaoAutenticado("Sua conta não existe mais.");
      return usuario;
    },
  };
}

module.exports = { criarServicoDeAutenticacao };
