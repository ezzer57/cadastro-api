const MIGRACOES = [
  `CREATE TABLE IF NOT EXISTS usuarios (
     id               TEXT PRIMARY KEY,
     nome             TEXT NOT NULL,
     nome_normalizado TEXT NOT NULL,
     email            TEXT NOT NULL UNIQUE,
     idade            INTEGER NOT NULL,
     criado_em        TEXT NOT NULL
   )`,

  `CREATE TABLE usuarios_com_restricoes (
     id               TEXT PRIMARY KEY NOT NULL,
     nome             TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 100),
     nome_normalizado TEXT NOT NULL,
     email            TEXT NOT NULL UNIQUE
                      CHECK (length(email) <= 254 AND email = lower(email) AND email LIKE '%_@_%._%'),
     idade            INTEGER NOT NULL CHECK (typeof(idade) = 'integer' AND idade BETWEEN 0 AND 150),
     criado_em        TEXT NOT NULL
   );
   INSERT INTO usuarios_com_restricoes
     SELECT id, nome, nome_normalizado, email, idade, criado_em FROM usuarios ORDER BY rowid;
   DROP TABLE usuarios;
   ALTER TABLE usuarios_com_restricoes RENAME TO usuarios;`,

  `CREATE TABLE usuarios_com_data_de_edicao (
     id               TEXT PRIMARY KEY NOT NULL,
     nome             TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 100),
     nome_normalizado TEXT NOT NULL,
     email            TEXT NOT NULL UNIQUE
                      CHECK (length(email) <= 254 AND email = lower(email) AND email LIKE '%_@_%._%'),
     idade            INTEGER NOT NULL CHECK (typeof(idade) = 'integer' AND idade BETWEEN 0 AND 150),
     criado_em        TEXT NOT NULL,
     atualizado_em    TEXT NOT NULL CHECK (atualizado_em >= criado_em)
   );
   INSERT INTO usuarios_com_data_de_edicao
     SELECT id, nome, nome_normalizado, email, idade, criado_em, criado_em FROM usuarios ORDER BY rowid;
   DROP TABLE usuarios;
   ALTER TABLE usuarios_com_data_de_edicao RENAME TO usuarios;`,
];

function versaoDoBanco(banco) {
  return banco.prepare("PRAGMA user_version").get().user_version;
}

function aplicarMigracoes(banco) {
  const versaoAtual = versaoDoBanco(banco);

  MIGRACOES.slice(versaoAtual).forEach((sql, posicao) => {
    banco.exec("BEGIN");
    try {
      banco.exec(sql);
      banco.exec(`PRAGMA user_version = ${versaoAtual + posicao + 1}`);
      banco.exec("COMMIT");
    } catch (erro) {
      banco.exec("ROLLBACK");
      throw erro;
    }
  });
}

module.exports = { MIGRACOES, versaoDoBanco, aplicarMigracoes };
