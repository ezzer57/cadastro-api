# Cadastro.api

CRUD completo de usuários em **Node.js + Express**, com **login (JWT)**, papéis **admin** e **comum**, e um site para
criar conta, entrar, cadastrar, pesquisar pelo nome, editar e remover.
Os dados ficam num banco **SQLite** (`data/cadastro.db`), criado automaticamente na primeira execução.
O SQLite já vem embutido no Node.js (`node:sqlite`); a única dependência extra para autenticação é o `jsonwebtoken`.

## Como rodar

Requer **Node.js 22.13 ou superior** (versão que traz o SQLite embutido).

```bash
npm install
npm start
```

Acesse **http://localhost:3000** no navegador e crie a primeira conta: ela recebe acesso de **administrador**.

| Comando        | O que faz                                                        |
|----------------|------------------------------------------------------------------|
| `npm start`    | Sobe o servidor (lê o arquivo `.env`, se existir)                |
| `npm run dev`  | Sobe o servidor e reinicia ao salvar um arquivo                  |
| `npm test`     | Roda os testes automáticos (API, autenticação, validação e banco) |

## Configuração

As configurações ficam em variáveis de ambiente. O jeito mais simples é copiar o modelo e editar:

```bash
cp .env.example .env
```

| Variável     | Padrão               | Para que serve |
|--------------|----------------------|----------------|
| `JWT_SECRET` | segredo temporário   | Chave que assina os tokens de login. Use um texto aleatório com **pelo menos 32 caracteres**. |
| `PORT`       | `3000`               | Porta do servidor. |
| `DB_FILE`    | `data/cadastro.db`   | Caminho do banco SQLite. |

Para gerar um `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sem `JWT_SECRET`, o servidor funciona, mas usa um segredo temporário e avisa no terminal: todos os logins deixam
de valer quando ele reinicia. O arquivo `.env` fica fora do Git, porque guarda um segredo.

## Autenticação

1. **Criar conta:** `POST /api/usuarios` com nome, e-mail, idade e senha (rota pública).
2. **Entrar:** `POST /api/login` com e-mail e senha. A resposta traz um **token JWT** válido por **2 horas**.
3. **Usar o token:** nas demais rotas, envie o cabeçalho `Authorization: Bearer <token>`.
4. **Quem sou eu:** `GET /api/eu` devolve o usuário dono do token.

### Papéis e permissões

| Ação                                   | Comum            | Admin          |
|----------------------------------------|------------------|----------------|
| Listar, pesquisar e ver pelo id         | ✅               | ✅             |
| Editar                                 | só a própria conta | qualquer conta |
| Remover                                | só a própria conta | qualquer conta |

- A **primeira conta** criada (ou a primeira depois que não houver nenhum admin) vira **admin**; as outras viram **comum**.
- O papel não pode ser enviado pela API: tentar mandar `"papel": "admin"` responde `400`.
- O **último admin** não pode ser removido (`409`), para o sistema nunca ficar sem administrador.

### Cuidados de segurança

- A senha é guardada só como **hash** (`scrypt`, embutido no Node.js, com sal aleatório) e nunca aparece nas respostas.
  O próprio banco recusa gravar uma senha que não esteja no formato de hash.
- E-mail inexistente e senha errada recebem **a mesma resposta** (`401 E-mail ou senha incorretos.`), para não revelar
  quais e-mails têm conta.
- Depois de **5 tentativas erradas** para o mesmo e-mail vindas do mesmo endereço, o login fica bloqueado por
  **15 minutos** (`429`, com o cabeçalho `Retry-After`).
- O token é assinado com `HS256` e verificado só com esse algoritmo. Tokens expirados, adulterados, sem assinatura
  ou de usuários removidos são recusados (`401`).

## Endpoints

| Método | Rota                               | Login?       | Descrição                                   |
|--------|------------------------------------|--------------|---------------------------------------------|
| POST   | `/api/usuarios`                    | não          | Cria uma conta                              |
| POST   | `/api/login`                       | não          | Entra e recebe o token                      |
| GET    | `/api/eu`                          | sim          | Mostra quem está logado                     |
| GET    | `/api/usuarios`                    | sim          | Lista os usuários, com paginação            |
| GET    | `/api/usuarios?nome=texto`         | sim          | Busca usuários pelo nome (busca parcial)    |
| GET    | `/api/usuarios/:id`                | sim          | Busca um usuário pelo `id`                  |
| PUT    | `/api/usuarios/:id`                | sim          | Edita (admin: qualquer um; comum: a si)     |
| DELETE | `/api/usuarios/:id`                | sim          | Remove (admin: qualquer um; comum: a si)    |

Todas as respostas são em JSON, inclusive os erros. Sem token, as rotas que exigem login respondem `401`
com o cabeçalho `WWW-Authenticate: Bearer`.

## Detalhes das rotas

### Formato do usuário

```json
{
  "id": "c0a8...",
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "idade": 27,
  "papel": "comum",
  "criadoEm": "2026-10-09T12:00:00.000Z",
  "atualizadoEm": "2026-10-09T15:30:00.000Z"
}
```

| Campo          | Significado |
|----------------|-------------|
| `id`           | Identificador gerado pelo sistema (UUID). |
| `papel`        | `admin` ou `comum` (veja [Papéis e permissões](#papéis-e-permissões)). |
| `criadoEm`     | Data e hora do cadastro (UTC, formato ISO 8601). Nunca muda. |
| `atualizadoEm` | Data e hora da última edição. No cadastro, é igual a `criadoEm`. |

A senha nunca faz parte das respostas.

### Criar conta: `POST /api/usuarios`

```json
{
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "idade": 27,
  "senha": "uma-senha-segura"
}
```

Respostas:
- `201 Created`: o usuário criado
- `400 Bad Request`: dados inválidos ou JSON malformado (veja [Validação](#validação))
- `409 Conflict`: e-mail já cadastrado
- `413 Payload Too Large`: corpo da requisição grande demais

### Entrar: `POST /api/login`

```json
{ "email": "joao@exemplo.com", "senha": "uma-senha-segura" }
```

Resposta `200 OK`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiraEm": "2026-10-09T17:30:00.000Z",
  "usuario": { "id": "c0a8...", "nome": "João Silva", "...": "..." }
}
```

Outras respostas: `400` (faltou e-mail ou senha), `401` (e-mail ou senha incorretos), `429` (muitas tentativas).

### Quem sou eu: `GET /api/eu`

Devolve o usuário dono do token (`200`) ou `401` se o token faltar, for inválido ou tiver expirado.

### Listar e buscar: `GET /api/usuarios?nome=joao`

O parâmetro `nome` é opcional. A busca é parcial e ignora maiúsculas/minúsculas e acentos:
`?nome=joao` encontra "João Silva".

```json
{
  "usuarios": [ { "id": "c0a8...", "nome": "João Silva", "...": "..." } ],
  "paginacao": { "pagina": 1, "limite": 20, "total": 1, "totalPaginas": 1 }
}
```

Respostas: `200`, `400` (`nome`, `pagina` ou `limite` inválidos) e `401`.

### Buscar pelo id: `GET /api/usuarios/:id`

Respostas: `200` (o usuário), `401` e `404` (nenhum usuário com esse `id`).

### Editar: `PUT /api/usuarios/:id`

Body com nome, e-mail e idade. A `senha` é **opcional**: se vier, troca a senha; se não vier, mantém a atual.

```json
{
  "nome": "João Silva Santos",
  "email": "joao.santos@exemplo.com",
  "idade": 28
}
```

O `id`, o `papel` e o `criadoEm` não mudam. A pessoa pode manter o próprio e-mail.
O `atualizadoEm` recebe a data e hora atuais, a não ser que nada tenha mudado: salvar os mesmos dados não conta como edição.

Respostas:
- `200 OK`: o usuário atualizado
- `400 Bad Request`: dados inválidos
- `401 Unauthorized`: sem login
- `403 Forbidden`: usuário comum tentando editar outra pessoa
- `404 Not Found`: nenhum usuário com esse `id`
- `409 Conflict`: o e-mail já pertence a outro usuário

### Remover: `DELETE /api/usuarios/:id`

Respostas:
- `200 OK`: `{ "mensagem": "Usuário apagado com sucesso.", "usuario": { ... } }`
- `401 Unauthorized`: sem login
- `403 Forbidden`: usuário comum tentando remover outra pessoa
- `404 Not Found`: nenhum usuário com esse `id`
- `409 Conflict`: tentativa de remover o último administrador

## Paginação

A listagem (com ou sem `nome`) é sempre paginada, com os **mais recentes primeiro**.

| Parâmetro | Padrão | Regras |
|-----------|--------|--------|
| `pagina`  | `1`    | número inteiro a partir de 1 |
| `limite`  | `20`   | número inteiro de 1 a 100 |

- `total` conta todos os usuários encontrados (respeitando o filtro `nome`), não só os da página.
- Pedir uma página depois da última devolve `usuarios: []`, com o `total` correto.
- Valores inválidos (`pagina=0`, `limite=500`, `pagina=abc`) respondem `400` apontando o campo.

## Validação

### Regras dos campos

| Campo   | Regras |
|---------|--------|
| `nome`  | Obrigatório, texto, até 100 caracteres, pelo menos 2 letras. Aceita letras (com acento), espaços, hífen, apóstrofo e ponto. Espaços extras são removidos (`"  Ana   Lima "` vira `"Ana Lima"`). |
| `email` | Obrigatório, texto, até 254 caracteres (64 antes do `@`), formato `nome@dominio.com`, único. Salvo em minúsculas. |
| `idade` | Obrigatória, **número inteiro** (não aceita `"25"` em texto nem `25.5`), de 0 a 150. |
| `senha` | Obrigatória no cadastro e opcional na edição, texto de **8 a 128 caracteres**. |

Qualquer outro campo enviado (como `id`, `papel`, `criadoEm`, `atualizadoEm` ou `telefone`) é recusado:
esses campos são controlados pelo próprio sistema.

### Formato dos erros

Cada erro informa o **campo** com problema e uma **mensagem** pronta para mostrar ao usuário:

```json
{
  "erros": [
    { "campo": "email", "mensagem": "Informe um e-mail válido, como nome@dominio.com." },
    { "campo": "senha", "mensagem": "A senha deve ter pelo menos 8 caracteres." }
  ]
}
```

Erros que não são de um campo específico (como 401, 403 e 404) vêm só com a `mensagem`.

### Camadas de validação

| Camada | Onde | O que garante | Resposta |
|--------|------|---------------|----------|
| Borda HTTP | `src/app.js` | JSON bem formado e de tamanho aceitável | `400` / `413` |
| Autenticação | `src/rotas.js`, `src/autenticacao.js` | token válido, usuário existente, limite de tentativas | `401` / `429` |
| Dados | `src/validacao.js` | campos obrigatórios, tipos, tamanhos, formatos, campos desconhecidos, paginação | `400` |
| Regras de negócio | `src/servico.js` | permissões por papel, e-mail único, usuário existente, último admin | `403` / `409` / `404` |
| Banco de dados | `src/migracoes.js` | `NOT NULL`, `UNIQUE` e `CHECK`, inclusive senha só em hash (última linha de defesa) | recusa a gravação |

## O site

- **Entrar / Criar conta:** a tela inicial, enquanto ninguém está logado.
- **Cadastrar:** formulário para criar a conta de outra pessoa (com senha) e os 5 cadastros mais recentes.
- **Pesquisar:** busca por nome enquanto você digita, 10 registros por página, e os botões **Editar** e **Remover**
  aparecem só onde você tem permissão (na sua conta, ou em todas se você for admin).
- No topo aparecem o seu nome, a etiqueta **ADMIN** (se for o caso) e o botão **Sair**.
- Se o token expirar ou deixar de valer, o site volta para a tela de entrada com o aviso "Sessão encerrada".
- O token fica no `sessionStorage` do navegador: some ao fechar a aba ou ao clicar em **Sair**.

## Postman

Importe o arquivo `cadastro-api.postman_collection.json` no Postman (File → Import) e rode as requisições na ordem:

1. **Criar conta** (João): guarda o `id` em `usuarioId`.
2. **Entrar (login)**: guarda o token em `token`, usado automaticamente pelas próximas requisições.
3. **Quem sou eu**, 4. **Cadastrar outra pessoa** (Maria, guarda `outroId`), 5. **Listar**, 6. **Buscar pelo nome**,
   7. **Buscar pelo id**, 8. **Editar minha conta**, 9. **Apagar outra pessoa**.

Num banco novo, o João é a primeira conta e vira admin, então todas as requisições funcionam.
Se o banco já tiver um admin, o João vira comum e a requisição 9 responde `403`, como esperado.

## Testes

`npm test` roda os testes com o `node:test`, que já vem no Node.js.
Cada execução usa um banco temporário, então os testes nunca mexem em `data/cadastro.db`.

| Arquivo                       | O que cobre |
|-------------------------------|-------------|
| `test/api.test.js`            | CRUD de ponta a ponta (logado como admin), erros, paginação e datas |
| `test/autenticacao.test.js`   | criar conta, login, tokens inválidos, permissões, último admin, troca de senha, bloqueio de tentativas |
| `test/validacao.test.js`      | casos válidos e inválidos de cada campo, do login e da paginação |
| `test/repositorio.test.js`    | persistência, restrições do banco e migração de um banco antigo |
| `test/servidor-de-teste.js`   | apoio: sobe um servidor com banco temporário para os testes |

## Estrutura

```
server.js                → ponto de entrada: lê a configuração e sobe o servidor
src/
  app.js                 → monta o Express e transforma erros em respostas HTTP
  rotas.js               → rotas HTTP e a exigência de login (Authorization: Bearer)
  autenticacao.js        → login, limite de tentativas e identificação pelo token
  servico.js             → regras de negócio: permissões, e-mail único, existência, último admin
  validacao.js           → regras de cada campo, do login e mensagens de erro
  paginacao.js           → valores padrão da paginação e cálculo do total de páginas
  usuario.js             → papéis, padronização dos dados, datas e montagem do registro
  senha.js               → hash e conferência de senha (scrypt)
  token.js               → emissão e verificação dos tokens JWT
  limitador.js           → contagem de tentativas de login erradas
  erros.js               → erros do domínio (validação, 401, 403, 404, 409, 429)
  repositorio.js         → leitura e gravação no banco SQLite
  migracoes.js           → estrutura do banco e restrições, versionadas
  texto.js               → normalização de texto (acentos, maiúsculas, espaços)
test/                    → testes automáticos (veja a seção Testes)
public/
  index.html, style.css  → página e visual
  js/main.js             → ponto de entrada do site: sessão, telas, eventos, edição e paginação
  js/api.js              → chamadas HTTP para a API e guarda do token
  js/componentes.js      → peças visuais: lista, campos, janela, sessão, mensagens, toast e aviso
  js/utils.js            → funções puras (escape de HTML, destaque da busca, iniciais, cor do avatar, datas)
.env.example             → modelo das variáveis de ambiente
data/cadastro.db         → banco SQLite (criado automaticamente, fica fora do Git)
```

O banco guarda a própria versão (`PRAGMA user_version`). Ao iniciar, o servidor aplica as migrações
que faltam, então um banco criado numa versão anterior do projeto é atualizado sem perder dados.
Usuários criados antes da autenticação ficam sem senha e não conseguem entrar até um admin definir uma senha para eles.

## Limitações conhecidas

- **Sair não invalida o token no servidor:** o JWT continua válido até expirar (2 horas). O site apaga o token
  do navegador, mas uma cópia dele ainda funcionaria até o prazo acabar.
- **Limite de tentativas em memória:** o contador de senhas erradas zera quando o servidor reinicia.
- **E-mail validado só no formato:** o sistema não confirma se o e-mail existe ou pertence à pessoa, e não há
  recuperação de senha por e-mail.
- **Banco local:** o SQLite fica num arquivo no próprio servidor, pensado para uma instância só.
