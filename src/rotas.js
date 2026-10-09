const express = require("express");
const { NaoAutenticado } = require("./erros");

const CABECALHO_BEARER = /^Bearer\s+(\S+)$/i;

function criarExigenciaDeLogin(autenticacao) {
  return function exigirLogin(req, res, next) {
    const [, token] = (req.get("Authorization") ?? "").match(CABECALHO_BEARER) ?? [];
    if (!token) throw new NaoAutenticado();

    req.usuarioLogado = autenticacao.identificar(token);
    next();
  };
}

function criarRotasDeAutenticacao(autenticacao, exigirLogin) {
  const rotas = express.Router();

  rotas.post("/login", async (req, res) => {
    res.json(await autenticacao.entrar(req.body, req.ip));
  });

  rotas.get("/eu", exigirLogin, (req, res) => {
    res.json(req.usuarioLogado);
  });

  return rotas;
}

function criarRotasUsuarios(servico, exigirLogin) {
  const rotas = express.Router();

  rotas.post("/", async (req, res) => {
    res.status(201).json(await servico.cadastrar(req.body));
  });

  rotas.get("/", exigirLogin, (req, res) => {
    res.json(servico.listar(req.query));
  });

  rotas.get("/:id", exigirLogin, (req, res) => {
    res.json(servico.buscarPorId(req.params.id));
  });

  rotas.put("/:id", exigirLogin, async (req, res) => {
    res.json(await servico.atualizar(req.usuarioLogado, req.params.id, req.body));
  });

  rotas.delete("/:id", exigirLogin, (req, res) => {
    const removido = servico.remover(req.usuarioLogado, req.params.id);
    res.json({ mensagem: "Usuário apagado com sucesso.", usuario: removido });
  });

  return rotas;
}

module.exports = { criarExigenciaDeLogin, criarRotasDeAutenticacao, criarRotasUsuarios };
