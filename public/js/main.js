import { api, errosDaResposta } from "./api.js";
import * as ui from "./componentes.js";
import { plural } from "./utils.js";

const ESPERA_FIM_DIGITACAO_MS = 250;
const PRAZO_PARA_CONFIRMAR_REMOCAO_MS = 3000;
const STATUS_NAO_ENCONTRADO = 404;

const AVISOS = {
  pesquisaBloqueada: {
    titulo: "Pesquisa bloqueada",
    texto: "Ainda não existe ninguém na base. Faça o primeiro cadastro para desbloquear a pesquisa.",
  },
  baseVazia: {
    titulo: "A base ficou vazia",
    texto: "Você removeu o último registro. Cadastre alguém para liberar a pesquisa de novo.",
  },
};

const $ = (seletor) => document.querySelector(seletor);

const elementos = {
  formulario: $("#form-cadastro"),
  mensagemCadastro: $("#form-msg"),
  listaCadastro: $("#lista-cadastro"),
  listaBusca: $("#lista-busca"),
  campoBusca: $("#busca"),
  abaPesquisar: $('.tab[data-tab="buscar"]'),
  modalEdicao: $("#modal-edicao"),
  formularioEdicao: $("#form-edicao"),
  mensagemEdicao: $("#edicao-msg"),
};

const estado = {
  totalUsuarios: 0,
  numeroDaUltimaBusca: 0,
  timerBusca: null,
  idEmEdicao: null,
};

function atualizarTotal(total) {
  estado.totalUsuarios = total;
  const bloqueada = total === 0;

  elementos.abaPesquisar.classList.toggle("locked", bloqueada);
  elementos.abaPesquisar.title = bloqueada ? "Faça o primeiro cadastro para desbloquear" : "";
  if (!bloqueada) ui.fecharAviso();
}

function avisarBloqueio(aviso) {
  ui.mostrarAviso(aviso);
  ui.balancar(elementos.abaPesquisar);
}

async function pesquisaLiberada() {
  const usuariosOuNuloSeOffline = await api.listar().catch(() => null);
  if (usuariosOuNuloSeOffline) atualizarTotal(usuariosOuNuloSeOffline.length);
  return estado.totalUsuarios > 0;
}

function lerFormulario(formulario) {
  return {
    nome: formulario.nome.value,
    email: formulario.email.value,
    idade: formulario.idade.value === "" ? null : Number(formulario.idade.value),
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

async function carregarListaCadastro() {
  try {
    const usuarios = await api.listar();
    atualizarTotal(usuarios.length);
    ui.renderizarLista(elementos.listaCadastro, usuarios, {
      vazio: "Nenhum registro por aqui ainda. Use o formulário ao lado para fazer o primeiro cadastro.",
    });
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
  const numeroDestaBusca = ++estado.numeroDaUltimaBusca;
  const chegouBuscaMaisNova = () => numeroDestaBusca !== estado.numeroDaUltimaBusca;

  $("#busca-termo").textContent = encodeURIComponent(termo);
  $("#busca-titulo").textContent = termo ? `Resultados para “${termo}”` : "Todos os registros";

  try {
    const usuarios = termo ? await api.buscarPorNome(termo) : await api.listar();
    if (chegouBuscaMaisNova()) return;

    $("#busca-contagem").textContent = plural(usuarios.length, "registro", "registros");
    ui.renderizarLista(elementos.listaBusca, usuarios, {
      termo,
      comAcoes: true,
      vazio: termo ? `Ninguém encontrado com “${termo}”. Tente outra parte do nome.` : "Nenhum registro por aqui ainda.",
    });
  } catch {
    if (chegouBuscaMaisNova()) return;
    $("#busca-contagem").textContent = "";
    ui.mostrarMensagemNaLista(elementos.listaBusca, "Não foi possível pesquisar agora.");
  }
}

function pesquisarQuandoPararDeDigitar() {
  clearTimeout(estado.timerBusca);
  estado.timerBusca = setTimeout(pesquisar, ESPERA_FIM_DIGITACAO_MS);
}

async function abrirEdicao(id) {
  try {
    const usuario = await api.buscarPorId(id);
    estado.idEmEdicao = usuario.id;

    $("#edicao-id").textContent = usuario.id;
    limparFeedbackDoFormulario(elementos.formularioEdicao, elementos.mensagemEdicao);
    ui.preencherFormulario(elementos.formularioEdicao, usuario);
    elementos.modalEdicao.showModal();
    elementos.formularioEdicao.nome.focus();
  } catch (erro) {
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
      const usuario = await api.atualizar(estado.idEmEdicao, lerFormulario(formulario));
      elementos.modalEdicao.close();
      ui.mostrarToast(`Registro de ${usuario.nome} atualizado.`);
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
      ui.mostrarToast("Não foi possível remover o registro.");
      return;
    }
  }

  ui.mostrarToast(`Registro de ${item.dataset.nome} removido.`);

  if (await pesquisaLiberada()) {
    pesquisar();
    return;
  }

  elementos.campoBusca.value = "";
  location.hash = "#cadastro";
  avisarBloqueio(AVISOS.baseVazia);
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

function exibirAba(aba) {
  limparFeedbackDoFormulario(elementos.formulario, elementos.mensagemCadastro);
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === aba));
  $("#view-cadastro").hidden = aba !== "cadastro";
  $("#view-buscar").hidden = aba !== "buscar";
}

async function navegar() {
  const querPesquisar = location.hash === "#buscar";

  if (querPesquisar && await pesquisaLiberada()) {
    exibirAba("buscar");
    pesquisar();
    return;
  }

  if (querPesquisar) {
    history.replaceState(null, "", "#cadastro");
    avisarBloqueio(AVISOS.pesquisaBloqueada);
    elementos.formulario.nome.focus();
  }

  exibirAba("cadastro");
  carregarListaCadastro();
}

for (const formulario of [elementos.formulario, elementos.formularioEdicao]) {
  ui.inserirCamposDeUsuario(formulario);
  ui.limparCampoAoDigitar(formulario);
}
ui.configurarModal(elementos.modalEdicao);

window.addEventListener("conexao", (evento) => ui.atualizarStatusServidor(evento.detail.online));
window.addEventListener("hashchange", navegar);
elementos.formulario.addEventListener("submit", cadastrar);
elementos.formularioEdicao.addEventListener("submit", salvarEdicao);
elementos.campoBusca.addEventListener("input", pesquisarQuandoPararDeDigitar);
elementos.listaBusca.addEventListener("click", aoClicarNaListaDeBusca);
$("#btn-atualizar").addEventListener("click", carregarListaCadastro);

navegar();
