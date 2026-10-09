const express = require("express");
const path = require("path");
const { criarRotasUsuarios } = require("./rotas");

function responderRotaInexistenteEmJson(req, res) {
  res.status(404).json({ erros: ["rota não encontrada"] });
}

function responderErrosEmJson(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ erros: ["o corpo da requisição não é um JSON válido"] });
  }
  console.error(err);
  res.status(500).json({ erros: ["erro interno no servidor"] });
}

function criarApp({ repositorio }) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use("/api/usuarios", criarRotasUsuarios(repositorio));
  app.use("/api", responderRotaInexistenteEmJson);
  app.use(responderErrosEmJson);

  return app;
}

module.exports = { criarApp };
