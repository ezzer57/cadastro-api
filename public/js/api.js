const URL_USUARIOS = "/api/usuarios";

export class ErroApi extends Error {
  constructor(status, erros) {
    super(erros.join("; "));
    this.status = status;
    this.erros = erros;
  }
}

function notificarConexao(online) {
  window.dispatchEvent(new CustomEvent("conexao", { detail: { online } }));
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
  if (!resposta.ok) throw new ErroApi(resposta.status, corpo.erros ?? ["erro inesperado"]);
  return corpo;
}

export const api = {
  listar: () => requisicao(URL_USUARIOS),

  buscarPorNome: (nome) => requisicao(`${URL_USUARIOS}?nome=${encodeURIComponent(nome)}`),

  cadastrar: (dados) => requisicao(URL_USUARIOS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  }),

  remover: (id) => requisicao(`${URL_USUARIOS}/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export function mensagensDeErro(erro) {
  return erro instanceof ErroApi ? erro.erros : ["Não foi possível conectar ao servidor."];
}
