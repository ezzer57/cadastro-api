import { escapeHtml, destacar, iniciais, corAvatar, plural } from "./utils.js";

const DURACAO_AVISO_MS = 5000;
const DURACAO_TOAST_MS = 3000;
const ATRASO_ENTRE_ITENS_MS = 30;
const MAXIMO_DE_ITENS_ANIMADOS = 10;

const $ = (seletor) => document.querySelector(seletor);

const ICONE_EDITAR_PESSOA = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 15H7a4 4 0 0 0-4 4v2"/><path d="M21.4 16.6a1 1 0 0 0-3-3l-4 4a2 2 0 0 0-.5.9l-.8 2.8a.5.5 0 0 0 .6.6l2.9-.8a2 2 0 0 0 .8-.5z"/><circle cx="10" cy="7" r="4"/></svg>`;
const ICONE_REMOVER_PESSOA = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/></svg>`;
const ICONE_BOLO = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/></svg>`;

const BOTOES_DE_ACAO = `
  <button type="button" class="btn-item" data-acao="editar">${ICONE_EDITAR_PESSOA}<span>Editar</span></button>
  <button type="button" class="btn-item perigo" data-acao="remover">${ICONE_REMOVER_PESSOA}<span>Remover</span></button>`;

function itemUsuario(usuario, posicao, { termo, comAcoes }) {
  const atrasoAnimacao = Math.min(posicao, MAXIMO_DE_ITENS_ANIMADOS) * ATRASO_ENTRE_ITENS_MS;

  return `
    <li data-id="${escapeHtml(usuario.id)}" data-nome="${escapeHtml(usuario.nome)}" style="animation-delay: ${atrasoAnimacao}ms">
      <div class="user-info">
        <span class="avatar" style="background: ${corAvatar(usuario.nome)}">${escapeHtml(iniciais(usuario.nome))}</span>
        <div>
          <div class="user-name">${destacar(usuario.nome, termo)}</div>
          <div class="user-email">${escapeHtml(usuario.email)}</div>
        </div>
      </div>
      <div class="user-actions">
        <span class="badge">${ICONE_BOLO}${plural(usuario.idade, "ano", "anos")}</span>
        ${comAcoes ? BOTOES_DE_ACAO : ""}
      </div>
    </li>`;
}

export function renderizarLista(lista, usuarios, { vazio, termo = "", comAcoes = false }) {
  if (!usuarios.length) {
    mostrarMensagemNaLista(lista, vazio);
    return;
  }
  lista.innerHTML = usuarios.map((usuario, i) => itemUsuario(usuario, i, { termo, comAcoes })).join("");
}

export function mostrarMensagemNaLista(lista, mensagem) {
  lista.innerHTML = `<li class="empty">${escapeHtml(mensagem)}</li>`;
}

export function atualizarRodapeDosUltimos(rodape, quantidadeExibida, total) {
  rodape.hidden = total <= quantidadeExibida;
  rodape.innerHTML = `Mostrando os ${quantidadeExibida} mais recentes de ${total}. <a href="#buscar">Ver todos</a>`;
}

export function atualizarPaginacao(navegacao, paginacao) {
  const temMaisDeUmaPagina = Boolean(paginacao) && paginacao.totalPaginas > 1;
  navegacao.hidden = !temMaisDeUmaPagina;
  if (!temMaisDeUmaPagina) return;

  $("#pagina-anterior").disabled = paginacao.pagina <= 1;
  $("#pagina-seguinte").disabled = paginacao.pagina >= paginacao.totalPaginas;
  $("#pagina-info").textContent = `Página ${paginacao.pagina} de ${paginacao.totalPaginas}`;
}

export function atualizarStatusServidor(online) {
  const status = $("#status");
  status.classList.toggle("ok", online);
  status.classList.toggle("err", !online);
  $("#status-text").textContent = online ? "Servidor online" : "Servidor offline";
}

export function inserirCamposDeUsuario(formulario) {
  const modelo = $("#modelo-campos-usuario");
  formulario.querySelector("[data-campos-usuario]").replaceWith(modelo.content.cloneNode(true));
}

export function preencherFormulario(formulario, usuario) {
  formulario.nome.value = usuario.nome;
  formulario.email.value = usuario.email;
  formulario.idade.value = usuario.idade;
}

export function mostrarSucessoCadastro(caixa, nome) {
  caixa.className = "msg ok";
  caixa.innerHTML = `Cadastro de <strong>${escapeHtml(nome)}</strong> salvo com sucesso.`;
  caixa.hidden = false;
}

export function mostrarErros(caixa, erros) {
  caixa.className = "msg err";
  caixa.innerHTML = `<ul>${erros.map((erro) => `<li>${escapeHtml(erro.mensagem)}</li>`).join("")}</ul>`;
  caixa.hidden = false;
}

export function marcarCamposInvalidos(formulario, erros) {
  limparCamposInvalidos(formulario);
  const camposInvalidos = erros
    .map((erro) => formulario.elements.namedItem(erro.campo ?? ""))
    .filter((campo) => campo instanceof HTMLInputElement);

  camposInvalidos.forEach((campo) => campo.setAttribute("aria-invalid", "true"));
  camposInvalidos[0]?.focus();
}

export function limparCamposInvalidos(formulario) {
  formulario.querySelectorAll('[aria-invalid="true"]').forEach((campo) => campo.removeAttribute("aria-invalid"));
}

export function limparCampoAoDigitar(formulario) {
  formulario.addEventListener("input", (evento) => evento.target.removeAttribute("aria-invalid"));
}

export function esconderMensagem(caixa) {
  caixa.hidden = true;
}

export function configurarModal(modal) {
  modal.addEventListener("click", (evento) => {
    const clicouForaDoConteudo = evento.target === modal;
    if (clicouForaDoConteudo || evento.target.closest("[data-fechar-modal]")) modal.close();
  });
}

let timerToast;

export function mostrarToast(texto) {
  const toast = $("#toast");
  toast.textContent = texto;
  toast.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => (toast.hidden = true), DURACAO_TOAST_MS);
}

let timerAviso;
const aviso = $("#aviso");

aviso.style.setProperty("--duracao-aviso", `${DURACAO_AVISO_MS}ms`);

aviso.addEventListener("animationend", (evento) => {
  if (evento.animationName !== "sair") return;
  aviso.hidden = true;
  aviso.classList.remove("saindo");
});

$("#aviso-fechar").addEventListener("click", () => fecharAviso());

export function mostrarAviso({ titulo, texto }) {
  $("#aviso-titulo").textContent = titulo;
  $("#aviso-texto").textContent = texto;

  aviso.classList.remove("saindo");
  reiniciarAnimacao(aviso, () => (aviso.hidden = true), () => (aviso.hidden = false));

  clearTimeout(timerAviso);
  timerAviso = setTimeout(fecharAviso, DURACAO_AVISO_MS);
}

export function fecharAviso() {
  clearTimeout(timerAviso);
  if (aviso.hidden) return;
  aviso.classList.add("saindo");
}

export function balancar(elemento) {
  reiniciarAnimacao(elemento, () => elemento.classList.remove("shake"), () => elemento.classList.add("shake"));
}

function forcarNavegadorAAplicarEstilos(elemento) {
  void elemento.offsetWidth;
}

function reiniciarAnimacao(elemento, desligar, ligar) {
  desligar();
  forcarNavegadorAAplicarEstilos(elemento);
  ligar();
}
