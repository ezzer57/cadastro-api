const URL_USUARIOS = "/api/usuarios";
const CHAVE_DO_TOKEN = "cadastro-api:token";
const STATUS_NAO_AUTENTICADO = 401;

class ErroApi extends Error {
  constructor(status, erros) {
    super(erros.map((erro) => erro.mensagem).join(" "));
    this.status = status;
    this.erros = erros;
  }
}

function lerTokenGuardado() {
  try {
    return sessionStorage.getItem(CHAVE_DO_TOKEN);
  } catch {
    return null;
  }
}

let token = lerTokenGuardado();

function guardarToken(novoToken) {
  token = novoToken;
  try {
    if (novoToken) sessionStorage.setItem(CHAVE_DO_TOKEN, novoToken);
    else sessionStorage.removeItem(CHAVE_DO_TOKEN);
  } catch {
    return;
  }
}

function avisar(evento, detalhe) {
  window.dispatchEvent(new CustomEvent(evento, { detail: detalhe }));
}

function urlDoUsuario(id) {
  return `${URL_USUARIOS}/${encodeURIComponent(id)}`;
}

export function urlDaListagem({ nome, pagina, limite } = {}) {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries({ nome, pagina, limite })) {
    if (valor) parametros.set(chave, valor);
  }

  const consulta = parametros.toString();
  return consulta ? `${URL_USUARIOS}?${consulta}` : URL_USUARIOS;
}

function comCorpoJson(metodo, dados) {
  return { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) };
}

async function requisicao(url, opcoes = {}) {
  const enviouToken = Boolean(token);
  const cabecalhos = { ...opcoes.headers, ...(enviouToken ? { Authorization: `Bearer ${token}` } : {}) };

  let resposta;
  try {
    resposta = await fetch(url, { ...opcoes, headers: cabecalhos });
  } catch (erro) {
    avisar("conexao", { online: false });
    throw erro;
  }
  avisar("conexao", { online: true });

  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.ok) return corpo;

  const erro = new ErroApi(resposta.status, corpo.erros ?? [{ mensagem: "Erro inesperado." }]);
  if (resposta.status === STATUS_NAO_AUTENTICADO && enviouToken) {
    guardarToken(null);
    avisar("sessao-encerrada", { mensagem: erro.message });
  }
  throw erro;
}

export const api = {
  temSessao: () => Boolean(token),

  async entrar(credenciais) {
    const { token: novoToken, usuario } = await requisicao("/api/login", comCorpoJson("POST", credenciais));
    guardarToken(novoToken);
    return usuario;
  },

  sair: () => guardarToken(null),

  eu: () => requisicao("/api/eu"),

  listar: (filtros) => requisicao(urlDaListagem(filtros)),

  buscarPorId: (id) => requisicao(urlDoUsuario(id)),

  cadastrar: (dados) => requisicao(URL_USUARIOS, comCorpoJson("POST", dados)),

  atualizar: (id, dados) => requisicao(urlDoUsuario(id), comCorpoJson("PUT", dados)),

  remover: (id) => requisicao(urlDoUsuario(id), { method: "DELETE" }),
};

export function errosDaResposta(erro) {
  return erro instanceof ErroApi ? erro.erros : [{ mensagem: "Não foi possível conectar ao servidor." }];
}
