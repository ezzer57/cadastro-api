# Cadastro.api

CRUD completo em **Node.js + Express**, com um site para cadastrar usuários, buscá-los pelo nome, editá-los e removê-los.
Os dados ficam num banco **SQLite** (`data/cadastro.db`), criado automaticamente na primeira execução.
Não é preciso instalar nada além do Node.js: o SQLite já vem embutido nele (`node:sqlite`).

## Como rodar

Requer **Node.js 22.13 ou superior** (versão que traz o SQLite embutido).

```bash
npm install
npm start
```

Acesse **http://localhost:3000** no navegador.

| Comando        | O que faz                                                  |
|----------------|------------------------------------------------------------|
| `npm start`    | Sobe o servidor                                            |
| `npm run dev`  | Sobe o servidor e reinicia ao salvar um arquivo            |
| `npm test`     | Roda os testes automáticos (API, validação e banco)        |

Variáveis de ambiente opcionais: `PORT` (padrão `3000`) e `DB_FILE` (caminho do banco, padrão `data/cadastro.db`).

## Endpoints

| Método | Rota                                   | Descrição                                   |
|--------|----------------------------------------|---------------------------------------------|
| POST   | `/api/usuarios`                        | Cadastra um usuário                         |
| GET    | `/api/usuarios`                        | Lista os usuários, com paginação            |
| GET    | `/api/usuarios?nome=texto`             | Busca usuários pelo nome (busca parcial)    |
| GET    | `/api/usuarios?pagina=2&limite=10`     | Escolhe a página e quantos itens por página |
| GET    | `/api/usuarios/:id`                    | Busca um usuário pelo `id`                  |
| PUT    | `/api/usuarios/:id`                    | Edita um usuário pelo `id`                  |
| DELETE | `/api/usuarios/:id`                    | Remove um usuário pelo `id`                 |

Todas as respostas são em JSON, inclusive os erros.

## Detalhes das rotas

### Formato do usuário

```json
{
  "id": "c0a8...",
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "idade": 27,
  "criadoEm": "2026-10-09T12:00:00.000Z",
  "atualizadoEm": "2026-10-09T15:30:00.000Z"
}
```

| Campo          | Significado |
|----------------|-------------|
| `id`           | Identificador gerado pelo sistema (UUID). |
| `criadoEm`     | Data e hora do cadastro (UTC, formato ISO 8601). Nunca muda. |
| `atualizadoEm` | Data e hora da última edição. No cadastro, é igual a `criadoEm`. |

### Cadastrar: `POST /api/usuarios`

Body (JSON):

```json
{
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "idade": 27
}
```

Respostas:
- `201 Created`: o usuário criado
- `400 Bad Request`: dados inválidos ou JSON malformado (veja [Validação](#validação))
- `409 Conflict`: e-mail já cadastrado
- `413 Payload Too Large`: corpo da requisição grande demais

### Listar e buscar: `GET /api/usuarios?nome=joao`

O parâmetro `nome` é opcional. A busca é parcial e ignora maiúsculas/minúsculas e acentos:
`?nome=joao` encontra "João Silva".

```json
{
  "usuarios": [ { "id": "c0a8...", "nome": "João Silva", "...": "..." } ],
  "paginacao": { "pagina": 1, "limite": 20, "total": 1, "totalPaginas": 1 }
}
```

Respostas:
- `200 OK`: a página de usuários (veja [Paginação](#paginação))
- `400 Bad Request`: `nome`, `pagina` ou `limite` inválidos

### Buscar pelo id: `GET /api/usuarios/:id`

Respostas:
- `200 OK`: o usuário
- `404 Not Found`: nenhum usuário com esse `id`

### Editar: `PUT /api/usuarios/:id`

Body (JSON) com todos os campos, seguindo as mesmas regras do cadastro:

```json
{
  "nome": "João Silva Santos",
  "email": "joao.santos@exemplo.com",
  "idade": 28
}
```

O `id` e o `criadoEm` não mudam. A pessoa pode manter o próprio e-mail.
O `atualizadoEm` recebe a data e hora atuais, a não ser que nada tenha mudado: salvar os mesmos dados não conta como edição.

Respostas:
- `200 OK`: o usuário atualizado
- `400 Bad Request`: dados inválidos
- `404 Not Found`: nenhum usuário com esse `id`
- `409 Conflict`: o e-mail já pertence a outro usuário

### Remover: `DELETE /api/usuarios/:id`

Respostas:
- `200 OK`: `{ "mensagem": "Usuário apagado com sucesso.", "usuario": { ... } }`
- `404 Not Found`: nenhum usuário com esse `id`

## Paginação

A listagem (com ou sem `nome`) é sempre paginada, com os **mais recentes primeiro**.

| Parâmetro | Padrão | Regras |
|-----------|--------|--------|
| `pagina`  | `1`    | número inteiro a partir de 1 |
| `limite`  | `20`   | número inteiro de 1 a 100 |

`GET /api/usuarios?nome=silva&pagina=2&limite=10` responde algo como:

```json
{
  "usuarios": [ "...até 10 usuários..." ],
  "paginacao": { "pagina": 2, "limite": 10, "total": 23, "totalPaginas": 3 }
}
```

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

Qualquer outro campo enviado (como `id`, `criadoEm`, `atualizadoEm` ou `telefone`) é recusado:
esses campos são controlados pelo próprio sistema.

### Formato dos erros

Cada erro informa o **campo** com problema e uma **mensagem** pronta para mostrar ao usuário:

```json
{
  "erros": [
    { "campo": "email", "mensagem": "Informe um e-mail válido, como nome@dominio.com." },
    { "campo": "idade", "mensagem": "A idade deve estar entre 0 e 150." }
  ]
}
```

Erros que não são de um campo específico (como 404) vêm só com a `mensagem`.

### Camadas de validação

| Camada | Onde | O que garante | Resposta |
|--------|------|---------------|----------|
| Borda HTTP | `src/app.js` | JSON bem formado e de tamanho aceitável | `400` / `413` |
| Dados | `src/validacao.js` | campos obrigatórios, tipos, tamanhos, formatos, campos desconhecidos, paginação | `400` |
| Regras de negócio | `src/servico.js` | e-mail único, usuário existente | `409` / `404` |
| Banco de dados | `src/migracoes.js` | `NOT NULL`, `UNIQUE` e `CHECK` (última linha de defesa) | recusa a gravação |

Toda gravação passa pelo `servico.js`, então as regras valem para qualquer forma de entrada, não só para as rotas HTTP.
Mesmo que algum código grave direto no banco sem validar, o SQLite recusa dados fora das regras.

## O site

- **Cadastrar:** formulário de cadastro e os 5 cadastros mais recentes, com link para ver todos.
- **Pesquisar:** busca por nome enquanto você digita, 10 registros por página (botões "Anterior" e "Próxima"),
  e os botões **Editar** (abre uma janela com os dados preenchidos) e **Remover** (pede confirmação com um segundo clique).
- A aba Pesquisar só abre depois que existir pelo menos 1 usuário. Enquanto não houver nenhum, ela aparece com
  um cadeado e, ao clicar, um aviso "salta" na tela pedindo para fazer o primeiro cadastro.
- Os campos com erro ficam destacados em vermelho e o cursor vai para o primeiro deles.

## Postman

Importe o arquivo `cadastro-api.postman_collection.json` no Postman (File → Import).
A coleção já vem com as requisições de cadastro, busca, listagem paginada, busca pelo id, edição e remoção.
Ao rodar "Cadastrar usuário", o `id` criado é guardado automaticamente e usado em "Buscar usuário pelo id",
"Editar usuário" e "Apagar usuário".

## Testes

`npm test` roda os testes com o `node:test`, que já vem no Node.js (sem dependências extras).
Cada execução usa um banco temporário, então os testes nunca mexem em `data/cadastro.db`.

| Arquivo                     | O que cobre |
|-----------------------------|-------------|
| `test/api.test.js`          | requisições HTTP de ponta a ponta: CRUD, erros, paginação e datas |
| `test/validacao.test.js`    | casos válidos e inválidos de cada campo e da paginação |
| `test/repositorio.test.js`  | persistência, restrições do banco e migração de um banco antigo |

## Estrutura

```
server.js                → ponto de entrada: lê a configuração e sobe o servidor
src/
  app.js                 → monta o Express e transforma erros em respostas HTTP
  rotas.js               → camada HTTP das rotas /api/usuarios (só repassa para o serviço)
  servico.js             → regras de negócio: valida, confere e-mail único e existência
  validacao.js           → regras de cada campo e mensagens de erro
  paginacao.js           → valores padrão da paginação e cálculo do total de páginas
  usuario.js             → padronização dos dados, datas e montagem do registro
  erros.js               → erros do domínio (validação, não encontrado, e-mail repetido)
  repositorio.js         → leitura e gravação no banco SQLite
  migracoes.js           → estrutura do banco e restrições, versionadas
  texto.js               → normalização de texto (acentos, maiúsculas, espaços)
test/                    → testes automáticos (veja a seção Testes)
public/
  index.html, style.css  → página e visual
  js/main.js             → ponto de entrada do site: eventos, abas, edição, paginação e bloqueio da pesquisa
  js/api.js              → todas as chamadas HTTP para a API
  js/componentes.js      → peças visuais: lista, campos do formulário, janela, mensagens, toast e aviso
  js/utils.js            → funções puras (escape de HTML, destaque da busca, iniciais, cor do avatar, datas)
data/cadastro.db         → banco SQLite (criado automaticamente, fica fora do Git)
```

O banco guarda a própria versão (`PRAGMA user_version`). Ao iniciar, o servidor aplica as migrações
que faltam, então um banco criado numa versão anterior do projeto é atualizado sem perder dados.

Cada camada tem uma responsabilidade só. Foi assim que o armazenamento trocou de um arquivo JSON
para o SQLite: só `src/repositorio.js` mudou, e os testes da API passaram sem nenhuma alteração.

## Limitações conhecidas

- **Sem autenticação:** qualquer pessoa que acesse o servidor pode listar, editar e remover usuários.
- **E-mail validado só no formato:** o sistema garante que o e-mail é bem formado e único, mas não confirma
  se ele existe ou pertence à pessoa (isso exigiria enviar um e-mail com link de confirmação).
- **Banco local:** o SQLite fica num arquivo no próprio servidor, pensado para uma instância só.
