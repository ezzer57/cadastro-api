const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { normalizar } = require("./texto");
const { aplicarMigracoes } = require("./migracoes");
const { EmailJaCadastrado } = require("./erros");

const BANCO_EM_MEMORIA = ":memory:";
const COLUNAS = "id, nome, email, idade, papel, criado_em AS criadoEm, atualizado_em AS atualizadoEm";
const CODIGO_SQLITE_VALOR_REPETIDO = 2067;
const SEM_LIMITE = -1;
const FILTRO_POR_NOME = "WHERE nome_normalizado LIKE :padrao ESCAPE '!'";
const MAIS_RECENTES_PRIMEIRO = "ORDER BY rowid DESC";

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
    buscar: banco.prepare(
      `SELECT ${COLUNAS} FROM usuarios ${FILTRO_POR_NOME} ${MAIS_RECENTES_PRIMEIRO} LIMIT :limite OFFSET :deslocamento`,
    ),
    contar: banco.prepare(`SELECT count(*) AS total FROM usuarios ${FILTRO_POR_NOME}`),
    buscarPorId: banco.prepare(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`),
    emailEmUso: banco.prepare("SELECT 1 FROM usuarios WHERE email = :email AND id IS NOT :excetoId"),
    buscarCredenciais: banco.prepare("SELECT id, senha_hash AS senhaHash FROM usuarios WHERE email = ?"),
    contarAdministradores: banco.prepare("SELECT count(*) AS total FROM usuarios WHERE papel = 'admin'"),
    inserir: banco.prepare(`
      INSERT INTO usuarios (id, nome, nome_normalizado, email, idade, papel, senha_hash, criado_em, atualizado_em)
      VALUES (:id, :nome, :nomeNormalizado, :email, :idade, :papel, :senhaHash, :criadoEm, :atualizadoEm)
      RETURNING ${COLUNAS}`),
    atualizar: banco.prepare(`
      UPDATE usuarios
      SET nome = :nome, nome_normalizado = :nomeNormalizado, email = :email, idade = :idade,
          senha_hash = coalesce(:senhaHash, senha_hash), atualizado_em = :atualizadoEm
      WHERE id = :id
      RETURNING ${COLUNAS}`),
    remover: banco.prepare(`DELETE FROM usuarios WHERE id = ? RETURNING ${COLUNAS}`),
  };

  return {
    buscar: ({ nome = "", limite = SEM_LIMITE, deslocamento = 0 } = {}) =>
      consultas.buscar.all({ padrao: padraoContendoTexto(normalizar(nome)), limite, deslocamento }),

    contar: ({ nome = "" } = {}) => consultas.contar.get({ padrao: padraoContendoTexto(normalizar(nome)) }).total,

    buscarPorIdOuNulo: (id) => consultas.buscarPorId.get(id) ?? null,

    emailEmUso: (email, { excetoId = null } = {}) => consultas.emailEmUso.get({ email, excetoId }) !== undefined,

    buscarCredenciaisPorEmailOuNulo: (email) => consultas.buscarCredenciais.get(email) ?? null,

    contarAdministradores: () => consultas.contarAdministradores.get().total,

    adicionar: ({ id, nome, email, idade, papel, criadoEm, atualizadoEm }, senhaHash = null) =>
      traduzirEmailRepetido(() => consultas.inserir.get({
        id, nome, email, idade, papel, senhaHash, criadoEm, atualizadoEm, nomeNormalizado: normalizar(nome),
      })),

    atualizarPorIdOuNulo: (id, { nome, email, idade, atualizadoEm }, senhaHash = null) =>
      traduzirEmailRepetido(() => consultas.atualizar.get({
        id, nome, email, idade, senhaHash, atualizadoEm, nomeNormalizado: normalizar(nome),
      }) ?? null),

    removerPorIdOuNulo: (id) => consultas.remover.get(id) ?? null,

    fechar: () => banco.close(),
  };
}

module.exports = { criarRepositorio };
