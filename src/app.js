const express = require("express");
const path = require("path");
const { criarRotasUsuarios } = require("./rotas");
const { criarServicoDeUsuarios } = require("./servico");
const { ErroDeValidacao, UsuarioNaoEncontrado, EmailJaCadastrado } = require("./erros");

const STATUS_HTTP_POR_ERRO = new Map([
  [ErroDeValidacao, 400],
  [UsuarioNaoEncontrado, 404],
  [EmailJaCadastrado, 409],
]);

const MENSAGENS_DO_LEITOR_DE_JSON = {
  "entity.parse.failed": "O corpo da requisição não é um JSON válido.",
  "entity.too.large": "O corpo da requisição é grande demais.",
};

function responderComMensagem(res, status, mensagem) {
  res.status(status).json({ erros: [{ mensagem }] });
}

function responderRotaInexistenteEmJson(req, res) {
  responderComMensagem(res, 404, "Rota não encontrada.");
}

function responderErrosEmJson(err, req, res, next) {
  const statusDoErroDeDominio = STATUS_HTTP_POR_ERRO.get(err.constructor);
  if (statusDoErroDeDominio) return res.status(statusDoErroDeDominio).json({ erros: err.erros });

  const mensagemDoLeitorDeJson = MENSAGENS_DO_LEITOR_DE_JSON[err.type];
  if (mensagemDoLeitorDeJson) return responderComMensagem(res, err.status, mensagemDoLeitorDeJson);

  console.error(err);
  responderComMensagem(res, 500, "Erro interno no servidor.");
}

function criarApp({ repositorio }) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use("/api/usuarios", criarRotasUsuarios(criarServicoDeUsuarios(repositorio)));
  app.use("/api", responderRotaInexistenteEmJson);
  app.use(responderErrosEmJson);

  return app;
}

module.exports = { criarApp };
