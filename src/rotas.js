const express = require("express");
const { validarCadastro, criarUsuario } = require("./usuario");

function criarRotasUsuarios(repositorio) {
  const rotas = express.Router();

  rotas.get("/", (req, res) => {
    const { nome } = req.query;
    res.json(nome ? repositorio.buscarPorNome(nome) : repositorio.listar());
  });

  rotas.post("/", (req, res) => {
    const erros = validarCadastro(req.body);
    if (erros.length) return res.status(400).json({ erros });

    const usuario = criarUsuario(req.body);
    if (repositorio.existeEmail(usuario.email)) {
      return res.status(409).json({ erros: ["já existe um usuário com esse email"] });
    }

    res.status(201).json(repositorio.adicionar(usuario));
  });

  rotas.delete("/:id", (req, res) => {
    const removido = repositorio.removerPorIdOuNulo(req.params.id);
    if (!removido) return res.status(404).json({ erros: ["usuário não encontrado"] });

    res.json({ mensagem: "usuário apagado com sucesso", usuario: removido });
  });

  return rotas;
}

module.exports = { criarRotasUsuarios };
