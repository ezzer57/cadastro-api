const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarDadosDoUsuario, validarTermoDeBusca } = require("../src/validacao");

const usuarioValido = { nome: "Ana Lima", email: "ana@exemplo.com", idade: 30 };

function camposComErro(dados) {
  return validarDadosDoUsuario(dados).map((erro) => erro.campo);
}

test("aceita um usuário válido", () => {
  assert.deepEqual(validarDadosDoUsuario(usuarioValido), []);
});

test("aceita nomes com acentos, hífen, apóstrofo e ponto", () => {
  const nomes = ["José Ávila", "Ana-Maria", "D'Ávila", "D’Souza", "João Jr.", "Zoë Ñúñez", "Lê"];
  for (const nome of nomes) {
    assert.deepEqual(camposComErro({ ...usuarioValido, nome }), [], `"${nome}" deveria ser aceito`);
  }
});

test("rejeita nomes inválidos", () => {
  const nomes = [undefined, null, "", "   ", 123, ["Ana"], "A", "A.", "--", "Ana2", "Ana@Lima", "<script>", "a".repeat(101)];
  for (const nome of nomes) {
    assert.deepEqual(camposComErro({ ...usuarioValido, nome }), ["nome"], `${JSON.stringify(nome)} deveria ser recusado`);
  }
});

test("aceita e-mails válidos", () => {
  const emails = ["a@b.co", "nome.sobrenome@empresa.com.br", "nome+tag@sub.dominio.org", "  ANA@Exemplo.COM  ", "x_y-z@a-b.io"];
  for (const email of emails) {
    assert.deepEqual(camposComErro({ ...usuarioValido, email }), [], `"${email}" deveria ser aceito`);
  }
});

test("rejeita e-mails inválidos", () => {
  const emails = [
    undefined, "", 42, "sem-arroba", "a@b", "a@b.c", "teste@hjm,m.com", "a b@x.com", "a@@x.com", "a@x@y.com",
    ".a@x.com", "a.@x.com", "a..b@x.com", "a@-x.com", "a@x-.com", "a@x..com", "a@.x.com",
    `${"a".repeat(65)}@x.com`, `a@${"b".repeat(250)}.com`,
  ];
  for (const email of emails) {
    assert.deepEqual(camposComErro({ ...usuarioValido, email }), ["email"], `${JSON.stringify(email)} deveria ser recusado`);
  }
});

test("aceita idades inteiras de 0 a 150", () => {
  for (const idade of [0, 1, 18, 150]) {
    assert.deepEqual(camposComErro({ ...usuarioValido, idade }), [], `${idade} deveria ser aceita`);
  }
});

test("rejeita idades inválidas", () => {
  const idades = [undefined, null, "", "25", 25.5, -1, 151, NaN, Infinity, true, [25]];
  for (const idade of idades) {
    assert.deepEqual(camposComErro({ ...usuarioValido, idade }), ["idade"], `${String(idade)} deveria ser recusada`);
  }
});

test("rejeita campos desconhecidos, inclusive id e criadoEm", () => {
  assert.deepEqual(camposComErro({ ...usuarioValido, id: "x", criadoEm: "hoje", toString: "y" }), ["id", "criadoEm", "toString"]);
});

test("rejeita corpo que não é um objeto", () => {
  for (const corpo of [undefined, null, [], "texto", 10]) {
    const erros = validarDadosDoUsuario(corpo);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].campo, undefined);
  }
});

test("devolve uma mensagem por campo com problema", () => {
  const erros = validarDadosDoUsuario({ nome: "", email: "", idade: "" });
  assert.deepEqual(erros.map((erro) => erro.mensagem), ["Informe o nome.", "Informe o e-mail.", "Informe a idade."]);
});

test("valida o termo de busca", () => {
  assert.deepEqual(validarTermoDeBusca("ana"), []);
  assert.equal(validarTermoDeBusca(["ana", "bia"]).length, 1);
  assert.equal(validarTermoDeBusca("a".repeat(101)).length, 1);
});
