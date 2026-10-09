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

    existeEmail(email) {
      return ler().some((usuario) => usuario.email === email);
    },

    adicionar(usuario) {
      gravar([...ler(), usuario]);
      return usuario;
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
