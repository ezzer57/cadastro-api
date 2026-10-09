const fs = require("fs");
const path = require("path");
const { normalizar } = require("./texto");

function criarRepositorio(caminhoArquivo) {
  function ler() {
    if (!fs.existsSync(caminhoArquivo)) return [];
    return JSON.parse(fs.readFileSync(caminhoArquivo, "utf8"));
  }

  function gravar(usuarios) {
    fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });
    fs.writeFileSync(caminhoArquivo, JSON.stringify(usuarios, null, 2) + "\n");
  }

  return {
    listar: ler,

    buscarPorNome(nome) {
      const termo = normalizar(nome);
      return ler().filter((usuario) => normalizar(usuario.nome).includes(termo));
    },

    buscarPorIdOuNulo(id) {
      return ler().find((usuario) => usuario.id === id) ?? null;
    },

    emailEmUso(email, { excetoId = null } = {}) {
      return ler().some((usuario) => usuario.email === email && usuario.id !== excetoId);
    },

    adicionar(usuario) {
      gravar([...ler(), usuario]);
      return usuario;
    },

    atualizarPorIdOuNulo(id, dados) {
      const usuarios = ler();
      const indice = usuarios.findIndex((usuario) => usuario.id === id);
      if (indice === -1) return null;

      usuarios[indice] = { ...usuarios[indice], ...dados };
      gravar(usuarios);
      return usuarios[indice];
    },

    removerPorIdOuNulo(id) {
      const usuarios = ler();
      const removido = usuarios.find((usuario) => usuario.id === id);
      if (!removido) return null;

      gravar(usuarios.filter((usuario) => usuario.id !== id));
      return removido;
    },
  };
}

module.exports = { criarRepositorio };
