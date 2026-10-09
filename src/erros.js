class ErroDeDominio extends Error {
  constructor(erros) {
    super(erros.map((erro) => erro.mensagem).join(" "));
    this.erros = erros;
  }
}

class ErroDeValidacao extends ErroDeDominio {
  static lancarSeHouver(erros) {
    if (erros.length) throw new ErroDeValidacao(erros);
  }
}

class NaoAutenticado extends ErroDeDominio {
  constructor(mensagem = "Faça login para continuar.") {
    super([{ mensagem }]);
  }
}

class CredenciaisInvalidas extends ErroDeDominio {
  constructor() {
    super([{ mensagem: "E-mail ou senha incorretos." }]);
  }
}

class SemPermissao extends ErroDeDominio {
  constructor() {
    super([{ mensagem: "Você só pode alterar ou remover a sua própria conta." }]);
  }
}

class UsuarioNaoEncontrado extends ErroDeDominio {
  constructor() {
    super([{ mensagem: "Usuário não encontrado." }]);
  }
}

class EmailJaCadastrado extends ErroDeDominio {
  constructor() {
    super([{ campo: "email", mensagem: "Já existe um usuário com esse e-mail." }]);
  }
}

class UltimoAdministrador extends ErroDeDominio {
  constructor() {
    super([{ mensagem: "Não é possível remover o último administrador do sistema." }]);
  }
}

class MuitasTentativas extends ErroDeDominio {
  constructor(segundosParaLiberar) {
    const minutos = Math.ceil(segundosParaLiberar / 60);
    super([{ mensagem: `Muitas tentativas de login. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.` }]);
    this.segundosParaLiberar = segundosParaLiberar;
  }
}

module.exports = {
  ErroDeValidacao,
  NaoAutenticado,
  CredenciaisInvalidas,
  SemPermissao,
  UsuarioNaoEncontrado,
  EmailJaCadastrado,
  UltimoAdministrador,
  MuitasTentativas,
};
