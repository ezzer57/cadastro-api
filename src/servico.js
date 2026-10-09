const { validarDadosDoUsuario, validarTermoDeBusca, validarPaginacao } = require("./validacao");
const { PAPEIS, criarUsuario, aplicarEdicao } = require("./usuario");
const { lerPaginacao, resumirPaginacao } = require("./paginacao");
const { gerarHashDeSenha } = require("./senha");
const {
  ErroDeValidacao, UsuarioNaoEncontrado, EmailJaCadastrado, SemPermissao, UltimoAdministrador,
} = require("./erros");

function criarServicoDeUsuarios(repositorio) {
  function buscarPorId(id) {
    const usuario = repositorio.buscarPorIdOuNulo(id);
    if (!usuario) throw new UsuarioNaoEncontrado();
    return usuario;
  }

  function garantirEmailDisponivel(email, excetoId = null) {
    if (repositorio.emailEmUso(email, { excetoId })) throw new EmailJaCadastrado();
  }

  function garantirPermissaoSobre(usuarioLogado, idDoAlvo) {
    const ehAdmin = usuarioLogado.papel === PAPEIS.admin;
    if (!ehAdmin && usuarioLogado.id !== idDoAlvo) throw new SemPermissao();
  }

  function papelDoNovoUsuario() {
    const jaExisteAdmin = repositorio.contarAdministradores() > 0;
    return jaExisteAdmin ? PAPEIS.comum : PAPEIS.admin;
  }

  return {
    listar({ nome = "", pagina, limite } = {}) {
      ErroDeValidacao.lancarSeHouver([...validarTermoDeBusca(nome), ...validarPaginacao({ pagina, limite })]);

      const paginacao = lerPaginacao({ pagina, limite });
      const deslocamento = (paginacao.pagina - 1) * paginacao.limite;

      return {
        usuarios: repositorio.buscar({ nome, limite: paginacao.limite, deslocamento }),
        paginacao: resumirPaginacao(paginacao, repositorio.contar({ nome })),
      };
    },

    buscarPorId,

    async cadastrar(dados) {
      ErroDeValidacao.lancarSeHouver(validarDadosDoUsuario(dados));
      const senhaHash = await gerarHashDeSenha(dados.senha);

      const usuario = criarUsuario(dados, { papel: papelDoNovoUsuario() });
      garantirEmailDisponivel(usuario.email);
      return repositorio.adicionar(usuario, senhaHash);
    },

    async atualizar(usuarioLogado, id, dados) {
      garantirPermissaoSobre(usuarioLogado, id);
      ErroDeValidacao.lancarSeHouver(validarDadosDoUsuario(dados, { senhaObrigatoria: false }));
      buscarPorId(id);

      const senhaHash = dados.senha === undefined ? null : await gerarHashDeSenha(dados.senha);
      const usuarioAtual = buscarPorId(id);
      const usuarioEditado = aplicarEdicao(usuarioAtual, dados, { senhaMudou: senhaHash !== null });
      if (usuarioEditado === usuarioAtual) return usuarioAtual;

      garantirEmailDisponivel(usuarioEditado.email, id);
      return repositorio.atualizarPorIdOuNulo(id, usuarioEditado, senhaHash);
    },

    remover(usuarioLogado, id) {
      garantirPermissaoSobre(usuarioLogado, id);
      const alvo = buscarPorId(id);

      const ehOUltimoAdmin = alvo.papel === PAPEIS.admin && repositorio.contarAdministradores() === 1;
      if (ehOUltimoAdmin) throw new UltimoAdministrador();

      return repositorio.removerPorIdOuNulo(id);
    },
  };
}

module.exports = { criarServicoDeUsuarios };
