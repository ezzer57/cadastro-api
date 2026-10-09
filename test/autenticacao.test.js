const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { iniciarServidorDeTeste, SEGREDO_DE_TESTE, SENHA_PADRAO } = require("./servidor-de-teste");
const { criarUsuario } = require("../src/usuario");

let servidor;
const contas = {};

before(async () => {
  servidor = await iniciarServidorDeTeste();
});

after(() => servidor.encerrar());

const comToken = (token, metodo, caminho, corpo) => servidor.enviar(metodo, caminho, { corpo, token });
const paraBase64Url = (objeto) => Buffer.from(JSON.stringify(objeto)).toString("base64url");

test("o primeiro cadastro vira admin e os seguintes viram comum", async () => {
  const pessoas = {
    admin: { nome: "Ana Admin", email: "ana@exemplo.com", idade: 40 },
    comum: { nome: "Caio Comum", email: "caio@exemplo.com", idade: 25 },
    outra: { nome: "Olga Outra", email: "olga@exemplo.com", idade: 30 },
  };

  for (const [apelido, dados] of Object.entries(pessoas)) {
    const { status, corpo } = await servidor.cadastrar(dados);
    assert.equal(status, 201);
    contas[apelido] = { id: corpo.id, email: corpo.email, papel: corpo.papel };
  }

  assert.equal(contas.admin.papel, "admin");
  assert.equal(contas.comum.papel, "comum");
  assert.equal(contas.outra.papel, "comum");
});

test("a senha nunca aparece nas respostas e fica guardada só como hash", async () => {
  const senha = "minha-senha-secreta";
  const { corpo } = await servidor.cadastrar({ nome: "Sigilo Total", email: "sigilo@exemplo.com", idade: 33, senha });

  assert.equal(JSON.stringify(corpo).toLowerCase().includes("senha"), false);

  const { senhaHash } = servidor.repositorio.buscarCredenciaisPorEmailOuNulo("sigilo@exemplo.com");
  assert.match(senhaHash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.equal(senhaHash.includes(senha), false);
});

test("o cadastro exige senha de 8 a 128 caracteres", async () => {
  for (const senha of [undefined, "", "curta", "a".repeat(129)]) {
    const { status, corpo } = await servidor.cadastrar({ nome: "Sem Senha", email: "sem.senha@exemplo.com", idade: 20, senha });
    assert.equal(status, 400, JSON.stringify(senha));
    assert.deepEqual(corpo.erros.map((erro) => erro.campo), ["senha"]);
  }
});

test("o login certo devolve token, validade e usuário, e /api/eu identifica quem entrou", async () => {
  const { status, corpo } = await servidor.enviar("POST", "/api/login", {
    corpo: { email: "  CAIO@Exemplo.com ", senha: SENHA_PADRAO },
  });

  assert.equal(status, 200);
  assert.ok(corpo.token);
  assert.ok(Date.parse(corpo.expiraEm) > Date.now());
  assert.equal(corpo.usuario.id, contas.comum.id);

  const eu = await comToken(corpo.token, "GET", "/api/eu");
  assert.equal(eu.status, 200);
  assert.equal(eu.corpo.id, contas.comum.id);
});

test("e-mail inexistente e senha errada recebem a mesma resposta 401", async () => {
  const senhaErrada = await servidor.enviar("POST", "/api/login", { corpo: { email: "caio@exemplo.com", senha: "errada-123" } });
  const semConta = await servidor.enviar("POST", "/api/login", { corpo: { email: "ninguem@exemplo.com", senha: "errada-123" } });

  assert.equal(senhaErrada.status, 401);
  assert.equal(semConta.status, 401);
  assert.deepEqual(senhaErrada.corpo, semConta.corpo);
});

test("o login com corpo inválido responde 400 apontando os campos", async () => {
  const { status, corpo } = await servidor.enviar("POST", "/api/login", { corpo: { email: "", lembrar: true } });
  assert.equal(status, 400);
  assert.deepEqual(corpo.erros.map((erro) => erro.campo), ["email", "senha", "lembrar"]);
});

test("as rotas protegidas sem token respondem 401 pedindo autenticação Bearer", async () => {
  const rotas = [["GET", "/api/usuarios"], ["GET", "/api/usuarios/x"], ["PUT", "/api/usuarios/x"], ["DELETE", "/api/usuarios/x"], ["GET", "/api/eu"]];

  for (const [metodo, caminho] of rotas) {
    const { status, cabecalhos } = await servidor.enviar(metodo, caminho, { corpo: metodo === "PUT" ? {} : undefined });
    assert.equal(status, 401, `${metodo} ${caminho}`);
    assert.equal(cabecalhos.get("www-authenticate"), "Bearer");
  }
});

test("token expirado, adulterado, sem assinatura ou de outro segredo responde 401", async () => {
  const tokenValido = await servidor.entrar("caio@exemplo.com");
  const [cabecalho, , assinatura] = tokenValido.split(".");

  const casos = {
    expirado: jwt.sign({}, SEGREDO_DE_TESTE, { subject: contas.comum.id, expiresIn: -10 }),
    adulterado: [cabecalho, paraBase64Url({ sub: contas.admin.id, exp: 9999999999 }), assinatura].join("."),
    semAssinatura: `${paraBase64Url({ alg: "none", typ: "JWT" })}.${paraBase64Url({ sub: contas.admin.id })}.`,
    outroSegredo: jwt.sign({}, "outro-segredo-qualquer-com-mais-de-32-caracteres", { subject: contas.admin.id }),
    lixo: "isso-nao-e-um-token",
  };

  for (const [nome, token] of Object.entries(casos)) {
    const { status, corpo } = await comToken(token, "GET", "/api/eu");
    assert.equal(status, 401, nome);
    if (nome === "expirado") assert.match(corpo.erros[0].mensagem, /expirou/);
  }
});

test("o usuário comum não edita nem remove outra pessoa (403)", async () => {
  const token = await servidor.entrar("caio@exemplo.com");

  const edicao = await comToken(token, "PUT", `/api/usuarios/${contas.outra.id}`, { nome: "Hackeada", email: "olga@exemplo.com", idade: 30 });
  const remocao = await comToken(token, "DELETE", `/api/usuarios/${contas.outra.id}`);

  assert.equal(edicao.status, 403);
  assert.equal(remocao.status, 403);
  assert.equal((await comToken(token, "GET", `/api/usuarios/${contas.outra.id}`)).corpo.nome, "Olga Outra");
});

test("o usuário comum edita a própria conta, mas não consegue se tornar admin", async () => {
  const token = await servidor.entrar("caio@exemplo.com");

  const virarAdmin = await comToken(token, "PUT", `/api/usuarios/${contas.comum.id}`, {
    nome: "Caio Comum", email: "caio@exemplo.com", idade: 25, papel: "admin",
  });
  assert.equal(virarAdmin.status, 400);
  assert.deepEqual(virarAdmin.corpo.erros.map((erro) => erro.campo), ["papel"]);

  const edicao = await comToken(token, "PUT", `/api/usuarios/${contas.comum.id}`, { nome: "Caio C. Lima", email: "caio@exemplo.com", idade: 26 });
  assert.equal(edicao.status, 200);
  assert.equal(edicao.corpo.nome, "Caio C. Lima");
  assert.equal(edicao.corpo.papel, "comum");
});

test("o usuário comum pode ver a lista e qualquer pessoa pelo id", async () => {
  const token = await servidor.entrar("caio@exemplo.com");

  assert.equal((await comToken(token, "GET", "/api/usuarios")).status, 200);
  assert.equal((await comToken(token, "GET", `/api/usuarios/${contas.admin.id}`)).status, 200);
});

test("trocar a senha faz a nova funcionar e a antiga parar de funcionar", async () => {
  const token = await servidor.entrar("caio@exemplo.com");
  const novaSenha = "nova-senha-do-caio";

  const { status, corpo } = await comToken(token, "PUT", `/api/usuarios/${contas.comum.id}`, {
    nome: "Caio C. Lima", email: "caio@exemplo.com", idade: 26, senha: novaSenha,
  });
  assert.equal(status, 200);
  assert.notEqual(corpo.atualizadoEm, corpo.criadoEm);

  assert.ok(await servidor.entrar("caio@exemplo.com", novaSenha));
  assert.equal(await servidor.entrar("caio@exemplo.com", SENHA_PADRAO), undefined);
});

test("o admin edita e remove qualquer pessoa", async () => {
  const token = await servidor.entrar("ana@exemplo.com");
  const { corpo: alvo } = await servidor.cadastrar({ nome: "Pessoa Alvo", email: "alvo@exemplo.com", idade: 22 });

  const edicao = await comToken(token, "PUT", `/api/usuarios/${alvo.id}`, { nome: "Pessoa Editada", email: "alvo@exemplo.com", idade: 23 });
  assert.equal(edicao.status, 200);
  assert.equal(edicao.corpo.nome, "Pessoa Editada");

  const remocao = await comToken(token, "DELETE", `/api/usuarios/${alvo.id}`);
  assert.equal(remocao.status, 200);
});

test("o último admin não pode ser removido", async () => {
  const token = await servidor.entrar("ana@exemplo.com");
  const { status, corpo } = await comToken(token, "DELETE", `/api/usuarios/${contas.admin.id}`);

  assert.equal(status, 409);
  assert.match(corpo.erros[0].mensagem, /último administrador/);
});

test("o token de quem foi removido deixa de valer", async () => {
  const tokenDaOlga = await servidor.entrar("olga@exemplo.com");
  const tokenDoAdmin = await servidor.entrar("ana@exemplo.com");

  assert.equal((await comToken(tokenDoAdmin, "DELETE", `/api/usuarios/${contas.outra.id}`)).status, 200);

  const { status, corpo } = await comToken(tokenDaOlga, "GET", "/api/eu");
  assert.equal(status, 401);
  assert.match(corpo.erros[0].mensagem, /não existe mais/);
});

test("um usuário antigo, sem senha, não consegue entrar", async () => {
  servidor.repositorio.adicionar(criarUsuario({ nome: "Antigo Sem Senha", email: "antigo@exemplo.com", idade: 60 }));

  const { status } = await servidor.enviar("POST", "/api/login", { corpo: { email: "antigo@exemplo.com", senha: SENHA_PADRAO } });
  assert.equal(status, 401);
});

test("bloqueia o login após 5 senhas erradas e libera depois de 15 minutos", async (t) => {
  await servidor.cadastrar({ nome: "Bia Bloqueio", email: "bloqueio@exemplo.com", idade: 28 });
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });

  const tentar = (senha) => servidor.enviar("POST", "/api/login", { corpo: { email: "bloqueio@exemplo.com", senha } });

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    assert.equal((await tentar("senha-errada")).status, 401, `tentativa ${tentativa}`);
  }

  const bloqueado = await tentar(SENHA_PADRAO);
  assert.equal(bloqueado.status, 429);
  assert.ok(Number(bloqueado.cabecalhos.get("retry-after")) > 0);

  t.mock.timers.tick(15 * 60 * 1000 + 1000);
  assert.equal((await tentar(SENHA_PADRAO)).status, 200);
});
