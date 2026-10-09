import { api, errosDaResposta, urlDaListagem } from "./api.js";
import * as ui from "./componentes.js";
import { plural, formatarDataHora } from "./utils.js";

const ESPERA_FIM_DIGITACAO_MS = 250;
const PRAZO_PARA_CONFIRMAR_REMOCAO_MS = 3000;
const STATUS_NAO_ENCONTRADO = 404;
const ULTIMOS_CADASTROS_EXIBIDOS = 5;
const REGISTROS_POR_PAGINA = 10;
const PAPEL_ADMIN = "admin";

const $ = (seletor) => document.querySelector(seletor);

const elementos = {
  formularioEntrar: $("#form-entrar"),
  mensagemEntrar: $("#entrar-msg"),
  formularioCriarConta: $("#form-criar-conta"),
  mensagemCriarConta: $("#criar-conta-msg"),
  formularioCadastro: $("#form-cadastro"),
  mensagemCadastro: $("#form-msg"),
  listaCadastro: $("#lista-cadastro"),
  rodapeCadastro: $("#rodape-cadastro"),
  listaBusca: $("#lista-busca"),
  campoBusca: $("#busca"),
  paginacao: $("#paginacao"),
  modalEdicao: $("#modal-edicao"),
  formularioEdicao: $("#form-edicao"),
  mensagemEdicao: $("#edicao-msg"),
};

const estado = {
  usuarioLogado: null,
  usuarioEmEdicao: null,
  numeroDaUltimaBusca: 0,
  timerBusca: null,
  paginaAtual: 1,
};

function ehAdmin() {
  return estado.usuarioLogado?.papel === PAPEL_ADMIN;
}

function podeAlterar(usuario) {
  return ehAdmin() || usuario.id === estado.usuarioLogado?.id;
}

function lerFormulario(formulario, { senhaOpcional = false } = {}) {
  const senha = formulario.senha.value;
  return {
    nome: formulario.nome.value,
    email: formulario.email.value,
    idade: formulario.idade.value === "" ? null : Number(formulario.idade.value),
    ...(senhaOpcional && senha === "" ? {} : { senha }),
  };
}

function exibirErrosDoFormulario(formulario, caixa, erro) {
  const erros = errosDaResposta(erro);
  ui.mostrarErros(caixa, erros);
  ui.marcarCamposInvalidos(formulario, erros);
}

function limparFeedbackDoFormulario(formulario, caixa) {
  ui.esconderMensagem(caixa);
  ui.limparCamposInvalidos(formulario);
}

async function executarComBotaoTravado(formulario, acao) {
  const botao = formulario.querySelector("button[type=submit]");
  botao.disabled = true;
  try {
    await acao();
  } finally {
    botao.disabled = false;
  }
}

function iniciarSessao(usuario, mensagem) {
  estado.usuarioLogado = usuario;
  ui.atualizarSessao(usuario);
  ui.fecharAviso();
  ui.mostrarToast(mensagem);
  history.replaceState(null, "", "#cadastro");
  navegar();
}

function encerrarSessao() {
  api.sair();
  estado.usuarioLogado = null;
  ui.atualizarSessao(null);
  if (elementos.modalEdicao.open) elementos.modalEdicao.close();
  history.replaceState(null, "", location.pathname);
  navegar();
}

function sair() {
  encerrarSessao();
  ui.mostrarToast("Você saiu da sua conta.");
}

function aoEncerrarSessaoPeloServidor(evento) {
  encerrarSessao();
  ui.mostrarAviso({ titulo: "Sessão encerrada", texto: evento.detail.mensagem });
}

async function entrar(evento) {
  evento.preventDefault();
  const formulario = evento.target;

  await executarComBotaoTravado(formulario, async () => {
    try {
      const usuario = await api.entrar({ email: formulario.email.value, senha: formulario.senha.value });
      formulario.reset();
      limparFeedbackDoFormulario(formulario, elementos.mensagemEntrar);
      iniciarSessao(usuario, `Boas-vindas, ${usuario.nome}!`);
    } catch (erro) {
      formulario.senha.value = "";
      exibirErrosDoFormulario(formulario, elementos.mensagemEntrar, erro);
    }
  });
}

async function criarConta(evento) {
  evento.preventDefault();
  const formulario = evento.target;

  await executarComBotaoTravado(formulario, async () => {
    try {
      const dados = lerFormulario(formulario);
      await api.cadastrar(dados);
      const usuario = await api.entrar({ email: dados.email, senha: dados.senha });

      formulario.reset();
      limparFeedbackDoFormulario(formulario, elementos.mensagemCriarConta);
      iniciarSessao(usuario, usuario.papel === PAPEL_ADMIN
        ? "Conta criada com acesso de administrador, por ser a primeira do sistema."
        : `Conta criada. Boas-vindas, ${usuario.nome}!`);
    } catch (erro) {
      exibirErrosDoFormulario(formulario, elementos.mensagemCriarConta, erro);
    }
  });
}

async function carregarListaCadastro() {
  try {
    const { usuarios, paginacao } = await api.listar({ limite: ULTIMOS_CADASTROS_EXIBIDOS });
    ui.renderizarLista(elementos.listaCadastro, usuarios, {
      idDoUsuarioLogado: estado.usuarioLogado?.id,
      vazio: "Nenhum registro por aqui ainda. Use o formulário ao lado para fazer o primeiro cadastro.",
    });
    ui.atualizarRodapeDosUltimos(elementos.rodapeCadastro, usuarios.length, paginacao.total);
  } catch {
    ui.mostrarMensagemNaLista(elementos.listaCadastro, "Não foi possível carregar os registros.");
  }
}

async function cadastrar(evento) {
  evento.preventDefault();
  const formulario = evento.target;

  await executarComBotaoTravado(formulario, async () => {
    try {
      const usuario = await api.cadastrar(lerFormulario(formulario));
      ui.limparCamposInvalidos(formulario);
      ui.mostrarSucessoCadastro(elementos.mensagemCadastro, usuario.nome);
      formulario.reset();
      formulario.nome.focus();
      carregarListaCadastro();
    } catch (erro) {
      exibirErrosDoFormulario(formulario, elementos.mensagemCadastro, erro);
    }
  });
}

async function pesquisar() {
  const termo = elementos.campoBusca.value.trim();
  const filtros = { nome: termo, pagina: estado.paginaAtual, limite: REGISTROS_POR_PAGINA };
  const numeroDestaBusca = ++estado.numeroDaUltimaBusca;
  const chegouBuscaMaisNova = () => numeroDestaBusca !== estado.numeroDaUltimaBusca;

  $("#busca-endpoint").textContent = `GET ${urlDaListagem(filtros)}`;
  $("#busca-titulo").textContent = termo ? `Resultados para “${termo}”` : "Todos os registros";

  try {
    const { usuarios, paginacao } = await api.listar(filtros);
    if (chegouBuscaMaisNova()) return;

    const paginaAtualFicouVazia = usuarios.length === 0 && paginacao.total > 0;
    if (paginaAtualFicouVazia) {
      estado.paginaAtual = paginacao.totalPaginas;
      pesquisar();
      return;
    }

    $("#busca-contagem").textContent = plural(paginacao.total, "registro", "registros");
    ui.renderizarLista(elementos.listaBusca, usuarios, {
      termo,
      podeAlterar,
      idDoUsuarioLogado: estado.usuarioLogado?.id,
      vazio: termo ? `Ninguém encontrado com “${termo}”. Tente outra parte do nome.` : "Nenhum registro por aqui ainda.",
    });
    ui.atualizarPaginacao(elementos.paginacao, paginacao);
  } catch {
    if (chegouBuscaMaisNova()) return;
    $("#busca-contagem").textContent = "";
    ui.atualizarPaginacao(elementos.paginacao, null);
    ui.mostrarMensagemNaLista(elementos.listaBusca, "Não foi possível pesquisar agora.");
  }
}

function irParaPagina(passo) {
  estado.paginaAtual += passo;
  pesquisar();
}

function pesquisarQuandoPararDeDigitar() {
  estado.paginaAtual = 1;
  clearTimeout(estado.timerBusca);
  estado.timerBusca = setTimeout(pesquisar, ESPERA_FIM_DIGITACAO_MS);
}

function descreverDatas({ criadoEm, atualizadoEm }) {
  const cadastro = `Cadastrado em ${formatarDataHora(criadoEm)}`;
  const nuncaFoiEditado = atualizadoEm === criadoEm;
  return nuncaFoiEditado ? `${cadastro} · nunca editado` : `${cadastro} · editado em ${formatarDataHora(atualizadoEm)}`;
}

async function abrirEdicao(id) {
  try {
    const usuario = await api.buscarPorId(id);
    estado.usuarioEmEdicao = usuario;

    $("#edicao-id").textContent = usuario.id;
    $("#edicao-datas").textContent = descreverDatas(usuario);
    limparFeedbackDoFormulario(elementos.formularioEdicao, elementos.mensagemEdicao);
    ui.preencherFormulario(elementos.formularioEdicao, usuario);
    elementos.modalEdicao.showModal();
    elementos.formularioEdicao.nome.focus();
  } catch (erro) {
    if (!api.temSessao()) return;
    const naoExisteMais = erro.status === STATUS_NAO_ENCONTRADO;
    ui.mostrarToast(naoExisteMais ? "Esse registro não existe mais." : "Não foi possível abrir o registro.");
    pesquisar();
  }
}

async function salvarEdicao(evento) {
  evento.preventDefault();
  const formulario = evento.target;

  await executarComBotaoTravado(formulario, async () => {
    try {
      const antes = estado.usuarioEmEdicao;
      const usuario = await api.atualizar(antes.id, lerFormulario(formulario, { senhaOpcional: true }));
      const nadaMudou = usuario.atualizadoEm === antes.atualizadoEm;

      if (usuario.id === estado.usuarioLogado.id) {
        estado.usuarioLogado = usuario;
        ui.atualizarSessao(usuario);
      }

      elementos.modalEdicao.close();
      ui.mostrarToast(nadaMudou ? "Nenhuma alteração para salvar." : `Registro de ${usuario.nome} atualizado.`);
      pesquisar();
    } catch (erro) {
      exibirErrosDoFormulario(formulario, elementos.mensagemEdicao, erro);
    }
  });
}

function cliqueJaEraConfirmacao(botao) {
  if (botao.classList.contains("confirmando")) return true;

  const rotulo = botao.querySelector("span");
  botao.classList.add("confirmando");
  rotulo.textContent = "Tem certeza?";

  setTimeout(() => {
    botao.classList.remove("confirmando");
    rotulo.textContent = "Remover";
  }, PRAZO_PARA_CONFIRMAR_REMOCAO_MS);
  return false;
}

async function remover(botao, item) {
  botao.disabled = true;
  try {
    await api.remover(item.dataset.id);
  } catch (erro) {
    const jaTinhaSidoRemovido = erro.status === STATUS_NAO_ENCONTRADO;
    if (!jaTinhaSidoRemovido) {
      botao.disabled = false;
      if (api.temSessao()) ui.mostrarToast(errosDaResposta(erro)[0].mensagem);
      return;
    }
  }

  const removeuAPropriaConta = item.dataset.id === estado.usuarioLogado?.id;
  if (removeuAPropriaConta) {
    encerrarSessao();
    ui.mostrarToast("Sua conta foi removida.");
    return;
  }

  ui.mostrarToast(`Registro de ${item.dataset.nome} removido.`);
  pesquisar();
}

const ACOES_DA_LISTA = {
  editar: (botao, item) => abrirEdicao(item.dataset.id),
  remover: (botao, item) => {
    if (cliqueJaEraConfirmacao(botao)) remover(botao, item);
  },
};

function aoClicarNaListaDeBusca(evento) {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  ACOES_DA_LISTA[botao.dataset.acao](botao, botao.closest("li"));
}

function navegar() {
  if (!estado.usuarioLogado) {
    ui.exibirTela("entrar");
    return;
  }

  const aba = location.hash === "#buscar" ? "buscar" : "cadastro";
  limparFeedbackDoFormulario(elementos.formularioCadastro, elementos.mensagemCadastro);
  ui.exibirTela(aba);

  if (aba === "buscar") {
    estado.paginaAtual = 1;
    pesquisar();
  } else {
    carregarListaCadastro();
  }
}

async function iniciar() {
  estado.usuarioLogado = await api.eu().catch(() => null);
  ui.atualizarSessao(estado.usuarioLogado);
  navegar();
}

for (const formulario of [elementos.formularioCriarConta, elementos.formularioCadastro, elementos.formularioEdicao]) {
  ui.inserirCamposDeUsuario(formulario, { senhaOpcional: formulario === elementos.formularioEdicao });
}
for (const formulario of document.querySelectorAll("form")) {
  ui.limparCampoAoDigitar(formulario);
}
ui.configurarModal(elementos.modalEdicao);

window.addEventListener("conexao", (evento) => ui.atualizarStatusServidor(evento.detail.online));
window.addEventListener("sessao-encerrada", aoEncerrarSessaoPeloServidor);
window.addEventListener("hashchange", navegar);
elementos.formularioEntrar.addEventListener("submit", entrar);
elementos.formularioCriarConta.addEventListener("submit", criarConta);
elementos.formularioCadastro.addEventListener("submit", cadastrar);
elementos.formularioEdicao.addEventListener("submit", salvarEdicao);
elementos.campoBusca.addEventListener("input", pesquisarQuandoPararDeDigitar);
elementos.listaBusca.addEventListener("click", aoClicarNaListaDeBusca);
$("#btn-atualizar").addEventListener("click", carregarListaCadastro);
$("#btn-sair").addEventListener("click", sair);
$("#pagina-anterior").addEventListener("click", () => irParaPagina(-1));
$("#pagina-seguinte").addEventListener("click", () => irParaPagina(1));

iniciar();
