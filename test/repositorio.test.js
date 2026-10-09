const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { criarRepositorio } = require("../src/repositorio");
const { criarUsuario } = require("../src/usuario");
const { MIGRACOES, versaoDoBanco } = require("../src/migracoes");
const { EmailJaCadastrado } = require("../src/erros");

let pastaTemporaria;

before(() => {
  pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), "cadastro-api-banco-"));
});

after(() => {
  fs.rmSync(pastaTemporaria, { recursive: true, force: true });
});

function comRepositorioEmMemoria(usar) {
  const repositorio = criarRepositorio(":memory:");
  try {
    usar(repositorio);
  } finally {
    repositorio.fechar();
  }
}

const novoUsuario = (dados = {}) =>
  criarUsuario({ nome: "Pessoa Teste", email: `pessoa${Math.random()}@exemplo.com`, idade: 30, ...dados });

test("os dados continuam salvos depois de fechar e abrir o banco de novo", () => {
  const arquivo = path.join(pastaTemporaria, "persistencia.db");
  const usuario = novoUsuario();

  const primeiraConexao = criarRepositorio(arquivo);
  primeiraConexao.adicionar(usuario);
  primeiraConexao.fechar();

  const segundaConexao = criarRepositorio(arquivo);
  assert.deepEqual({ ...segundaConexao.buscarPorIdOuNulo(usuario.id) }, usuario);
  assert.equal(segundaConexao.contar(), 1);
  segundaConexao.fechar();
});

test("o banco recusa dados que furam as regras, mesmo sem passar pela validação", () => {
  comRepositorioEmMemoria((repositorio) => {
    const invalidos = [
      { idade: 200 },
      { idade: -1 },
      { idade: 18.5 },
      { nome: "A" },
      { nome: "a".repeat(101) },
      { email: "SEM-MINUSCULAS@EXEMPLO.COM" },
      { email: "sem-arroba" },
      { atualizadoEm: "2000-01-01T00:00:00.000Z" },
    ];
    for (const dados of invalidos) {
      const usuario = { ...novoUsuario(), ...dados };
      assert.throws(() => repositorio.adicionar(usuario), /CHECK constraint failed/, JSON.stringify(dados));
    }
    assert.equal(repositorio.contar(), 0);
  });
});

test("o banco recusa e-mail repetido e avisa com o erro de domínio", () => {
  comRepositorioEmMemoria((repositorio) => {
    repositorio.adicionar(novoUsuario({ email: "igual@exemplo.com" }));
    assert.throws(() => repositorio.adicionar(novoUsuario({ email: "igual@exemplo.com" })), EmailJaCadastrado);
  });
});

test("a busca trata %, _ e ! como texto comum", () => {
  comRepositorioEmMemoria((repositorio) => {
    repositorio.adicionar({ ...novoUsuario(), nome: "Rafa_100%!" });
    repositorio.adicionar(novoUsuario({ nome: "Bia Rocha" }));

    for (const termo of ["%", "_", "!", "100%"]) {
      assert.deepEqual(repositorio.buscar({ nome: termo }).map((u) => u.nome), ["Rafa_100%!"], termo);
    }
    assert.deepEqual(repositorio.buscar({ nome: "a_b" }), []);
  });
});

test("atualiza um banco antigo, sem as regras, mantendo os dados", () => {
  const arquivo = path.join(pastaTemporaria, "banco-antigo.db");
  const bancoAntigo = new DatabaseSync(arquivo);
  bancoAntigo.exec(MIGRACOES[0]);
  bancoAntigo.exec(`
    INSERT INTO usuarios VALUES ('id-1', 'Antigo Um', 'antigo um', 'um@exemplo.com', 20, '2026-01-01T00:00:00.000Z');
    INSERT INTO usuarios VALUES ('id-2', 'Antigo Dois', 'antigo dois', 'dois@exemplo.com', 30, '2026-01-02T00:00:00.000Z');
  `);
  bancoAntigo.close();

  const repositorio = criarRepositorio(arquivo);
  assert.deepEqual(repositorio.buscar().map((u) => u.id), ["id-2", "id-1"]);
  assert.ok(repositorio.buscar().every((u) => u.atualizadoEm === u.criadoEm));
  assert.throws(() => repositorio.adicionar({ ...novoUsuario(), idade: 999 }), /CHECK constraint failed/);
  repositorio.fechar();

  const banco = new DatabaseSync(arquivo);
  assert.equal(versaoDoBanco(banco), MIGRACOES.length);
  banco.close();
});
