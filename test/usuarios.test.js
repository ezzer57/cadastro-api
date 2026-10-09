const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { criarApp } = require("../src/app");
const { criarRepositorio } = require("../src/repositorio");

let servidor;
let pastaTemporaria;
let urlUsuarios;

before(async () => {
  pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), "cadastro-api-"));
  const repositorio = criarRepositorio(path.join(pastaTemporaria, "usuarios.json"));

  servidor = criarApp({ repositorio }).listen(0);
  await once(servidor, "listening");
  urlUsuarios = `http://localhost:${servidor.address().port}/api/usuarios`;
});

after(() => {
  servidor.closeAllConnections();
  servidor.close();
  fs.rmSync(pastaTemporaria, { recursive: true, force: true });
});

async function enviar(metodo, url, corpo) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

const cadastrar = (dados) => enviar("POST", urlUsuarios, dados);
const buscar = async (nome) => (await fetch(`${urlUsuarios}?nome=${encodeURIComponent(nome)}`)).json();
const joao = { nome: "João Silva", email: "Joao@Exemplo.com", idade: 27 };

test("começa sem nenhum usuário", async () => {
  assert.deepEqual(await (await fetch(urlUsuarios)).json(), []);
});

test("cadastra um usuário válido e padroniza o e-mail", async () => {
  const { status, corpo } = await cadastrar(joao);

  assert.equal(status, 201);
  assert.equal(corpo.nome, "João Silva");
  assert.equal(corpo.email, "joao@exemplo.com");
  assert.equal(corpo.idade, 27);
  assert.ok(corpo.id);
});

test("rejeita dados inválidos com a lista de erros", async () => {
  const { status, corpo } = await cadastrar({ nome: "A", email: "sem-arroba", idade: 200 });

  assert.equal(status, 400);
  assert.equal(corpo.erros.length, 3);
});

test("rejeita idade vazia, nula ou em texto", async () => {
  for (const idade of [null, "", "25", undefined]) {
    const { status } = await cadastrar({ ...joao, email: "outro@exemplo.com", idade });
    assert.equal(status, 400, `idade ${JSON.stringify(idade)} deveria ser recusada`);
  }
});

test("não permite e-mail repetido, mesmo com maiúsculas diferentes", async () => {
  const { status } = await cadastrar({ ...joao, email: "JOAO@exemplo.com" });
  assert.equal(status, 409);
});

test("busca pelo nome ignorando maiúsculas e acentos", async () => {
  assert.deepEqual((await buscar("JOAO")).map((u) => u.nome), ["João Silva"]);
  assert.deepEqual((await buscar("silv")).map((u) => u.nome), ["João Silva"]);
  assert.deepEqual(await buscar("maria"), []);
});

test("remove um usuário e responde 404 se tentar de novo", async () => {
  const [usuario] = await buscar("joao");

  const primeira = await enviar("DELETE", `${urlUsuarios}/${usuario.id}`);
  assert.equal(primeira.status, 200);
  assert.equal(primeira.corpo.usuario.id, usuario.id);

  const segunda = await enviar("DELETE", `${urlUsuarios}/${usuario.id}`);
  assert.equal(segunda.status, 404);
  assert.deepEqual(await buscar("joao"), []);
});

test("JSON malformado responde 400 em JSON", async () => {
  const { status, corpo } = await enviar("POST", urlUsuarios, "{ nome: ");
  assert.equal(status, 400);
  assert.ok(corpo.erros);
});

test("rota inexistente da API responde 404 em JSON", async () => {
  const { status, corpo } = await enviar("GET", urlUsuarios.replace("usuarios", "nao-existe"));
  assert.equal(status, 404);
  assert.ok(corpo.erros);
});
