const express = require("express");
const { validarUsuario, padronizarDados, criarUsuario } = require("./usuario");

const MENSAGENS = {
  naoEncontrado: "usuário não encontrado",
  emailDuplicado: "já existe um usuário com esse email",
};

function responderErro(res, status, mensagem) {
  return res.status(status).json({ erros: [mensagem] });
}

function criarRotasUsuarios(repositorio) {
  const rotas = express.Router();

  rotas.get("/", (req, res) => {
    const { nome } = req.query;
    res.json(nome ? repositorio.buscarPorNome(nome) : repositorio.listar());
  });

  rotas.get("/:id", (req, res) => {
    const usuario = repositorio.buscarPorIdOuNulo(req.params.id);
    if (!usuario) return responderErro(res, 404, MENSAGENS.naoEncontrado);

    res.json(usuario);
  });

  rotas.post("/", (req, res) => {
    const erros = validarUsuario(req.body);
    if (erros.length) return res.status(400).json({ erros });

    const usuario = criarUsuario(req.body);
    if (repositorio.emailEmUso(usuario.email)) return responderErro(res, 409, MENSAGENS.emailDuplicado);

    res.status(201).json(repositorio.adicionar(usuario));
  });

  rotas.put("/:id", (req, res) => {
    const { id } = req.params;
    const erros = validarUsuario(req.body);
    if (erros.length) return res.status(400).json({ erros });

    if (!repositorio.buscarPorIdOuNulo(id)) return responderErro(res, 404, MENSAGENS.naoEncontrado);

    const dados = padronizarDados(req.body);
    if (repositorio.emailEmUso(dados.email, { excetoId: id })) {
      return responderErro(res, 409, MENSAGENS.emailDuplicado);
    }

    res.json(repositorio.atualizarPorIdOuNulo(id, dados));
  });

  rotas.delete("/:id", (req, res) => {
    const removido = repositorio.removerPorIdOuNulo(req.params.id);
    if (!removido) return responderErro(res, 404, MENSAGENS.naoEncontrado);

    res.json({ mensagem: "usuário apagado com sucesso", usuario: removido });
  });

  return rotas;
}

module.exports = { criarRotasUsuarios };
