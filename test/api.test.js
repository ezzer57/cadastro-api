const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { criarApp } = require("../src/app");
const { criarRepositorio } = require("../src/repositorio");

let servidor;
let repositorio;
let pastaTemporaria;
let urlUsuarios;

before(async () => {
  pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), "cadastro-api-"));
  repositorio = criarRepositorio(path.join(pastaTemporaria, "banco-de-teste.db"));

  servidor = criarApp({ repositorio }).listen(0);
  await once(servidor, "listening");
  urlUsuarios = `http://localhost:${servidor.address().port}/api/usuarios`;
});

after(() => {
  servidor.closeAllConnections();
  servidor.close();
  repositorio.fechar();
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

test("busca um usuário pelo id e responde 404 para id inexistente", async () => {
  const { corpo: criado } = await cadastrar({ nome: "Ana Lima", email: "ana@exemplo.com", idade: 30 });

  const encontrado = await enviar("GET", `${urlUsuarios}/${criado.id}`);
  assert.equal(encontrado.status, 200);
  assert.deepEqual(encontrado.corpo, criado);

  const inexistente = await enviar("GET", `${urlUsuarios}/id-que-nao-existe`);
  assert.equal(inexistente.status, 404);
});

test("edita um usuário mantendo id e data de criação", async () => {
  const [ana] = await buscar("ana lima");

  const { status, corpo } = await enviar("PUT", `${urlUsuarios}/${ana.id}`, {
    nome: "Ana Lima Souza",
    email: "Ana.Souza@Exemplo.com",
    idade: 31,
  });

  assert.equal(status, 200);
  assert.equal(corpo.id, ana.id);
  assert.equal(corpo.criadoEm, ana.criadoEm);
  assert.equal(corpo.nome, "Ana Lima Souza");
  assert.equal(corpo.email, "ana.souza@exemplo.com");
  assert.equal(corpo.idade, 31);
  assert.deepEqual((await buscar("souza")).map((u) => u.id), [ana.id]);
});

test("permite editar mantendo o próprio e-mail", async () => {
  const [ana] = await buscar("ana lima");
  const { status } = await enviar("PUT", `${urlUsuarios}/${ana.id}`, { nome: "Ana L. Souza", email: ana.email, idade: 32 });
  assert.equal(status, 200);
});

test("não permite editar para o e-mail de outro usuário", async () => {
  const { corpo: bia } = await cadastrar({ nome: "Bia Rocha", email: "bia@exemplo.com", idade: 25 });
  const [ana] = await buscar("ana");

  const { status } = await enviar("PUT", `${urlUsuarios}/${bia.id}`, { nome: "Bia Rocha", email: ana.email, idade: 25 });
  assert.equal(status, 409);
});

test("edição com dados inválidos responde 400 e não altera o usuário", async () => {
  const [bia] = await buscar("bia");

  const { status, corpo } = await enviar("PUT", `${urlUsuarios}/${bia.id}`, { nome: "", email: "x", idade: null });
  assert.equal(status, 400);
  assert.equal(corpo.erros.length, 3);
  assert.deepEqual((await enviar("GET", `${urlUsuarios}/${bia.id}`)).corpo, bia);
});

test("editar id inexistente responde 404", async () => {
  const { status } = await enviar("PUT", `${urlUsuarios}/id-que-nao-existe`, { nome: "Fulano", email: "fulano@exemplo.com", idade: 40 });
  assert.equal(status, 404);
});

test("busca trata % e _ como texto comum, não como curinga", async () => {
  assert.ok((await buscar("")).length > 0);
  assert.deepEqual(await buscar("%"), []);
  assert.deepEqual(await buscar("_"), []);
});

test("erros de validação informam o campo e a mensagem", async () => {
  const { status, corpo } = await cadastrar({ nome: "", email: "teste@hjm,m.com", idade: 200 });

  assert.equal(status, 400);
  assert.deepEqual(corpo.erros.map((erro) => erro.campo), ["nome", "email", "idade"]);
  assert.ok(corpo.erros.every((erro) => typeof erro.mensagem === "string" && erro.mensagem.length > 0));
});

test("rejeita campos que não fazem parte do usuário", async () => {
  const { status, corpo } = await cadastrar({ ...joao, email: "extra@exemplo.com", id: "123", telefone: "99999" });

  assert.equal(status, 400);
  assert.deepEqual(corpo.erros.map((erro) => erro.campo), ["id", "telefone"]);
});

test("rejeita corpo que não é um objeto JSON", async () => {
  const { status, corpo } = await enviar("POST", urlUsuarios, "[1, 2]");
  assert.equal(status, 400);
  assert.equal(corpo.erros.length, 1);
});

test("padroniza espaços extras no nome", async () => {
  const { status, corpo } = await cadastrar({ nome: "  Carla    Dias  ", email: "carla@exemplo.com", idade: 40 });
  assert.equal(status, 201);
  assert.equal(corpo.nome, "Carla Dias");
});

test("e-mail repetido responde 409 apontando o campo email", async () => {
  const { status, corpo } = await cadastrar({ nome: "Outra Carla", email: "CARLA@exemplo.com", idade: 30 });
  assert.equal(status, 409);
  assert.equal(corpo.erros[0].campo, "email");
});

test("busca com termo longo demais responde 400", async () => {
  const resposta = await fetch(`${urlUsuarios}?nome=${"a".repeat(101)}`);
  assert.equal(resposta.status, 400);
});

test("corpo grande demais responde 413 em JSON", async () => {
  const { status, corpo } = await cadastrar({ ...joao, nome: "a".repeat(200_000) });
  assert.equal(status, 413);
  assert.ok(corpo.erros);
});

test("cadastro começa com atualizadoEm igual a criadoEm", async () => {
  const { corpo } = await cadastrar({ nome: "Davi Costa", email: "davi@exemplo.com", idade: 33 });
  assert.equal(corpo.atualizadoEm, corpo.criadoEm);
});

test("editar muda atualizadoEm e mantém criadoEm", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-01T10:00:00.000Z") });
  const { corpo: criado } = await cadastrar({ nome: "Eva Prado", email: "eva@exemplo.com", idade: 41 });

  t.mock.timers.tick(60_000);
  const { corpo: editado } = await enviar("PUT", `${urlUsuarios}/${criado.id}`, { nome: "Eva Prado", email: "eva@exemplo.com", idade: 42 });

  assert.equal(editado.criadoEm, "2026-05-01T10:00:00.000Z");
  assert.equal(editado.atualizadoEm, "2026-05-01T10:01:00.000Z");
});

test("salvar sem nenhuma mudança não altera atualizadoEm", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-06-01T08:00:00.000Z") });
  const { corpo: criado } = await cadastrar({ nome: "Fábio Reis", email: "fabio@exemplo.com", idade: 50 });

  t.mock.timers.tick(60_000);
  const { status, corpo } = await enviar("PUT", `${urlUsuarios}/${criado.id}`, {
    nome: "  Fábio   Reis ",
    email: "FABIO@exemplo.com",
    idade: 50,
  });

  assert.equal(status, 200);
  assert.equal(corpo.atualizadoEm, criado.atualizadoEm);
});
