import { api, mensagensDeErro } from "./api.js";
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
  listaCadastro: $("#lista-cadastro"),
  listaBusca: $("#lista-busca"),
  campoBusca: $("#busca"),
  abaPesquisar: $('.tab[data-tab="buscar"]'),
};

const estado = {
  totalUsuarios: 0,
  numeroDaUltimaBusca: 0,
  timerBusca: null,
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

function lerFormulario(formulario) {
  return {
    nome: formulario.nome.value,
    email: formulario.email.value,
    idade: formulario.idade.value === "" ? null : Number(formulario.idade.value),
  };
}

async function cadastrar(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const botao = formulario.querySelector("button[type=submit]");

  botao.disabled = true;
  try {
    const usuario = await api.cadastrar(lerFormulario(formulario));
    ui.mostrarSucessoFormulario(usuario.nome);
    formulario.reset();
    formulario.nome.focus();
    carregarListaCadastro();
  } catch (erro) {
    ui.mostrarErrosFormulario(mensagensDeErro(erro));
  } finally {
    botao.disabled = false;
  }
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
      comBotaoRemover: true,
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

async function remover(botao) {
  botao.disabled = true;
  try {
    await api.remover(botao.dataset.id);
  } catch (erro) {
    const jaTinhaSidoRemovido = erro.status === STATUS_NAO_ENCONTRADO;
    if (!jaTinhaSidoRemovido) {
      botao.disabled = false;
      ui.mostrarToast("Não foi possível remover o registro.");
      return;
    }
  }

  ui.mostrarToast(`Registro de ${botao.dataset.nome} removido.`);

  if (await pesquisaLiberada()) {
    pesquisar();
    return;
  }

  elementos.campoBusca.value = "";
  location.hash = "#cadastro";
  avisarBloqueio(AVISOS.baseVazia);
}

function aoClicarNaListaDeBusca(evento) {
  const botao = evento.target.closest(".btn-danger");
  if (botao && cliqueJaEraConfirmacao(botao)) remover(botao);
}

function exibirAba(aba) {
  ui.esconderMensagemFormulario();
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

window.addEventListener("conexao", (evento) => ui.atualizarStatusServidor(evento.detail.online));
window.addEventListener("hashchange", navegar);
elementos.formulario.addEventListener("submit", cadastrar);
elementos.campoBusca.addEventListener("input", pesquisarQuandoPararDeDigitar);
elementos.listaBusca.addEventListener("click", aoClicarNaListaDeBusca);
$("#btn-atualizar").addEventListener("click", carregarListaCadastro);

navegar();
