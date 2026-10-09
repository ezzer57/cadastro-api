const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { normalizar } = require("./texto");
const { aplicarMigracoes } = require("./migracoes");
const { EmailJaCadastrado } = require("./erros");

const BANCO_EM_MEMORIA = ":memory:";
const COLUNAS = "id, nome, email, idade, criado_em AS criadoEm";
const CODIGO_SQLITE_VALOR_REPETIDO = 2067;

function abrirBanco(caminhoArquivo) {
  if (caminhoArquivo !== BANCO_EM_MEMORIA) {
    fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });
  }

  const banco = new DatabaseSync(caminhoArquivo);
  banco.exec("PRAGMA journal_mode = WAL");
  aplicarMigracoes(banco);
  return banco;
}

function padraoContendoTexto(texto) {
  const textoSemCuringas = texto.replace(/[!%_]/g, "!$&");
  return `%${textoSemCuringas}%`;
}

function traduzirEmailRepetido(gravar) {
  try {
    return gravar();
  } catch (erro) {
    if (erro.errcode === CODIGO_SQLITE_VALOR_REPETIDO) throw new EmailJaCadastrado();
    throw erro;
  }
}

function criarRepositorio(caminhoArquivo) {
  const banco = abrirBanco(caminhoArquivo);

  const consultas = {
    listar: banco.prepare(`SELECT ${COLUNAS} FROM usuarios ORDER BY rowid`),
    buscarPorNome: banco.prepare(
      `SELECT ${COLUNAS} FROM usuarios WHERE nome_normalizado LIKE ? ESCAPE '!' ORDER BY rowid`,
    ),
    buscarPorId: banco.prepare(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`),
    emailEmUso: banco.prepare("SELECT 1 FROM usuarios WHERE email = :email AND id IS NOT :excetoId"),
    inserir: banco.prepare(`
      INSERT INTO usuarios (id, nome, nome_normalizado, email, idade, criado_em)
      VALUES (:id, :nome, :nomeNormalizado, :email, :idade, :criadoEm)
      RETURNING ${COLUNAS}`),
    atualizar: banco.prepare(`
      UPDATE usuarios
      SET nome = :nome, nome_normalizado = :nomeNormalizado, email = :email, idade = :idade
      WHERE id = :id
      RETURNING ${COLUNAS}`),
    remover: banco.prepare(`DELETE FROM usuarios WHERE id = ? RETURNING ${COLUNAS}`),
  };

  return {
    listar: () => consultas.listar.all(),

    buscarPorNome: (nome) => consultas.buscarPorNome.all(padraoContendoTexto(normalizar(nome))),

    buscarPorIdOuNulo: (id) => consultas.buscarPorId.get(id) ?? null,

    emailEmUso: (email, { excetoId = null } = {}) => consultas.emailEmUso.get({ email, excetoId }) !== undefined,

    adicionar: (usuario) => traduzirEmailRepetido(() =>
      consultas.inserir.get({ ...usuario, nomeNormalizado: normalizar(usuario.nome) })),

    atualizarPorIdOuNulo: (id, dados) => traduzirEmailRepetido(() =>
      consultas.atualizar.get({ id, ...dados, nomeNormalizado: normalizar(dados.nome) }) ?? null),

    removerPorIdOuNulo: (id) => consultas.remover.get(id) ?? null,

    fechar: () => banco.close(),
  };
}

module.exports = { criarRepositorio };
