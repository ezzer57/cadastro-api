const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { criarApp } = require("../src/app");
const { criarRepositorio } = require("../src/repositorio");

const SEGREDO_DE_TESTE = "segredo-usado-apenas-nos-testes-automaticos";
const SENHA_PADRAO = "senha-de-teste-123";

async function iniciarServidorDeTeste() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "cadastro-api-"));
  const repositorio = criarRepositorio(path.join(pasta, "banco-de-teste.db"));
  const servidor = criarApp({ repositorio, segredoDoToken: SEGREDO_DE_TESTE }).listen(0);
  await once(servidor, "listening");
  const enderecoBase = `http://localhost:${servidor.address().port}`;

  async function enviar(metodo, caminho, { corpo, token } = {}) {
    const resposta = await fetch(`${enderecoBase}${caminho}`, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo === undefined || typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
    return { status: resposta.status, cabecalhos: resposta.headers, corpo: await resposta.json() };
  }

  function cadastrar(dados) {
    return enviar("POST", "/api/usuarios", { corpo: { senha: SENHA_PADRAO, ...dados } });
  }

  async function entrar(email, senha = SENHA_PADRAO) {
    const { corpo } = await enviar("POST", "/api/login", { corpo: { email, senha } });
    return corpo.token;
  }

  function encerrar() {
    servidor.closeAllConnections();
    servidor.close();
    repositorio.fechar();
    fs.rmSync(pasta, { recursive: true, force: true });
  }

  return { repositorio, enviar, cadastrar, entrar, encerrar };
}

module.exports = { iniciarServidorDeTeste, SEGREDO_DE_TESTE, SENHA_PADRAO };
