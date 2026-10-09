const { validarDadosDoUsuario, validarTermoDeBusca } = require("./validacao");
const { padronizarDados, criarUsuario } = require("./usuario");
const { ErroDeValidacao, UsuarioNaoEncontrado, EmailJaCadastrado } = require("./erros");

function garantirQueNaoHaErros(erros) {
  if (erros.length) throw new ErroDeValidacao(erros);
}

function criarServicoDeUsuarios(repositorio) {
  function buscarPorId(id) {
    const usuario = repositorio.buscarPorIdOuNulo(id);
    if (!usuario) throw new UsuarioNaoEncontrado();
    return usuario;
  }

  function garantirEmailDisponivel(email, excetoId = null) {
    if (repositorio.emailEmUso(email, { excetoId })) throw new EmailJaCadastrado();
  }

  return {
    listar: () => repositorio.listar(),

    buscarPorNome(termo) {
      garantirQueNaoHaErros(validarTermoDeBusca(termo));
      return repositorio.buscarPorNome(termo);
    },

    buscarPorId,

    cadastrar(dados) {
      garantirQueNaoHaErros(validarDadosDoUsuario(dados));

      const usuario = criarUsuario(dados);
      garantirEmailDisponivel(usuario.email);
      return repositorio.adicionar(usuario);
    },

    atualizar(id, dados) {
      garantirQueNaoHaErros(validarDadosDoUsuario(dados));
      buscarPorId(id);

      const dadosPadronizados = padronizarDados(dados);
      garantirEmailDisponivel(dadosPadronizados.email, id);
      return repositorio.atualizarPorIdOuNulo(id, dadosPadronizados);
    },

    remover(id) {
      const removido = repositorio.removerPorIdOuNulo(id);
      if (!removido) throw new UsuarioNaoEncontrado();
      return removido;
    },
  };
}

module.exports = { criarServicoDeUsuarios };
