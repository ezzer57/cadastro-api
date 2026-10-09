const URL_USUARIOS = "/api/usuarios";

export class ErroApi extends Error {
  constructor(status, erros) {
    super(erros.map((erro) => erro.mensagem).join(" "));
    this.status = status;
    this.erros = erros;
  }
}

function notificarConexao(online) {
  window.dispatchEvent(new CustomEvent("conexao", { detail: { online } }));
}

function urlDoUsuario(id) {
  return `${URL_USUARIOS}/${encodeURIComponent(id)}`;
}

function comCorpoJson(metodo, dados) {
  return {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  };
}

async function requisicao(url, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch (erro) {
    notificarConexao(false);
    throw erro;
  }
  notificarConexao(true);

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroApi(resposta.status, corpo.erros ?? [{ mensagem: "Erro inesperado." }]);
  return corpo;
}

export const api = {
  listar: () => requisicao(URL_USUARIOS),

  buscarPorNome: (nome) => requisicao(`${URL_USUARIOS}?nome=${encodeURIComponent(nome)}`),

  buscarPorId: (id) => requisicao(urlDoUsuario(id)),

  cadastrar: (dados) => requisicao(URL_USUARIOS, comCorpoJson("POST", dados)),

  atualizar: (id, dados) => requisicao(urlDoUsuario(id), comCorpoJson("PUT", dados)),

  remover: (id) => requisicao(urlDoUsuario(id), { method: "DELETE" }),
};

export function errosDaResposta(erro) {
  return erro instanceof ErroApi ? erro.erros : [{ mensagem: "Não foi possível conectar ao servidor." }];
}
