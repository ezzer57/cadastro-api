const express = require("express");
const path = require("path");
const { criarExigenciaDeLogin, criarRotasDeAutenticacao, criarRotasUsuarios } = require("./rotas");
const { criarServicoDeUsuarios } = require("./servico");
const { criarServicoDeAutenticacao } = require("./autenticacao");
const { criarEmissorDeTokens } = require("./token");
const { criarLimitadorDeTentativas } = require("./limitador");
const {
  ErroDeValidacao, NaoAutenticado, CredenciaisInvalidas, SemPermissao, UsuarioNaoEncontrado,
  EmailJaCadastrado, UltimoAdministrador, MuitasTentativas,
} = require("./erros");

const VALIDADE_PADRAO_DO_TOKEN = "2h";

const STATUS_HTTP_POR_ERRO = new Map([
  [ErroDeValidacao, 400],
  [NaoAutenticado, 401],
  [CredenciaisInvalidas, 401],
  [SemPermissao, 403],
  [UsuarioNaoEncontrado, 404],
  [EmailJaCadastrado, 409],
  [UltimoAdministrador, 409],
  [MuitasTentativas, 429],
]);

const MENSAGENS_DO_LEITOR_DE_JSON = {
  "entity.parse.failed": "O corpo da requisição não é um JSON válido.",
  "entity.too.large": "O corpo da requisição é grande demais.",
};

function cabecalhosDoErro(err) {
  if (err instanceof NaoAutenticado) return { "WWW-Authenticate": "Bearer" };
  if (err instanceof MuitasTentativas) return { "Retry-After": String(err.segundosParaLiberar) };
  return {};
}

function responderComMensagem(res, status, mensagem) {
  res.status(status).json({ erros: [{ mensagem }] });
}

function responderRotaInexistenteEmJson(req, res) {
  responderComMensagem(res, 404, "Rota não encontrada.");
}

function responderErrosEmJson(err, req, res, next) {
  const statusDoErroDeDominio = STATUS_HTTP_POR_ERRO.get(err.constructor);
  if (statusDoErroDeDominio) {
    return res.set(cabecalhosDoErro(err)).status(statusDoErroDeDominio).json({ erros: err.erros });
  }

  const mensagemDoLeitorDeJson = MENSAGENS_DO_LEITOR_DE_JSON[err.type];
  if (mensagemDoLeitorDeJson) return responderComMensagem(res, err.status, mensagemDoLeitorDeJson);

  console.error(err);
  responderComMensagem(res, 500, "Erro interno no servidor.");
}

function criarApp({ repositorio, segredoDoToken, validadeDoToken = VALIDADE_PADRAO_DO_TOKEN }) {
  const autenticacao = criarServicoDeAutenticacao({
    repositorio,
    emissorDeTokens: criarEmissorDeTokens({ segredo: segredoDoToken, validade: validadeDoToken }),
    limitador: criarLimitadorDeTentativas(),
  });
  const exigirLogin = criarExigenciaDeLogin(autenticacao);

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use("/api", criarRotasDeAutenticacao(autenticacao, exigirLogin));
  app.use("/api/usuarios", criarRotasUsuarios(criarServicoDeUsuarios(repositorio), exigirLogin));
  app.use("/api", responderRotaInexistenteEmJson);
  app.use(responderErrosEmJson);

  return app;
}

module.exports = { criarApp };
