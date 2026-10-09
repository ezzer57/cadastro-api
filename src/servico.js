const { validarDadosDoUsuario, validarTermoDeBusca, validarPaginacao } = require("./validacao");
const { criarUsuario, aplicarEdicao } = require("./usuario");
const { lerPaginacao, resumirPaginacao } = require("./paginacao");
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
    listar({ nome = "", pagina, limite } = {}) {
      garantirQueNaoHaErros([...validarTermoDeBusca(nome), ...validarPaginacao({ pagina, limite })]);

      const paginacao = lerPaginacao({ pagina, limite });
      const deslocamento = (paginacao.pagina - 1) * paginacao.limite;

      return {
        usuarios: repositorio.buscar({ nome, limite: paginacao.limite, deslocamento }),
        paginacao: resumirPaginacao(paginacao, repositorio.contar({ nome })),
      };
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
      const usuarioAtual = buscarPorId(id);

      const usuarioEditado = aplicarEdicao(usuarioAtual, dados);
      if (usuarioEditado === usuarioAtual) return usuarioAtual;

      garantirEmailDisponivel(usuarioEditado.email, id);
      return repositorio.atualizarPorIdOuNulo(id, usuarioEditado);
    },

    remover(id) {
      const removido = repositorio.removerPorIdOuNulo(id);
      if (!removido) throw new UsuarioNaoEncontrado();
      return removido;
    },
  };
}

module.exports = { criarServicoDeUsuarios };
