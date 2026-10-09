class ErroDeDominio extends Error {
  constructor(erros) {
    super(erros.map((erro) => erro.mensagem).join(" "));
    this.erros = erros;
  }
}

class ErroDeValidacao extends ErroDeDominio {}

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

module.exports = { ErroDeValidacao, UsuarioNaoEncontrado, EmailJaCadastrado };
