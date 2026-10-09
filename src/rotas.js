const express = require("express");

function criarRotasUsuarios(servico) {
  const rotas = express.Router();

  rotas.get("/", (req, res) => {
    const { nome } = req.query;
    res.json(nome ? servico.buscarPorNome(nome) : servico.listar());
  });

  rotas.get("/:id", (req, res) => {
    res.json(servico.buscarPorId(req.params.id));
  });

  rotas.post("/", (req, res) => {
    res.status(201).json(servico.cadastrar(req.body));
  });

  rotas.put("/:id", (req, res) => {
    res.json(servico.atualizar(req.params.id, req.body));
  });

  rotas.delete("/:id", (req, res) => {
    res.json({ mensagem: "Usuário apagado com sucesso.", usuario: servico.remover(req.params.id) });
  });

  return rotas;
}

module.exports = { criarRotasUsuarios };
