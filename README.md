# Cadastro.api

CRUD completo em **Node.js + Express**, com um site para cadastrar usuários, buscá-los pelo nome, editá-los e removê-los.
Os dados ficam salvos em `data/usuarios.json` (não precisa de banco de dados).

No site, a aba **Pesquisar** só abre depois que existir pelo menos 1 usuário cadastrado.
Enquanto não houver nenhum, ela aparece com um cadeado e, ao clicar, um aviso "salta" na tela pedindo para fazer o primeiro cadastro.

## Como rodar

Requer Node.js 20 ou superior.

```bash
npm install
npm start
```

Acesse **http://localhost:3000** no navegador.

| Comando        | O que faz                                         |
|----------------|---------------------------------------------------|
| `npm start`    | Sobe o servidor                                   |
| `npm run dev`  | Sobe o servidor e reinicia ao salvar um arquivo   |
| `npm test`     | Roda os testes automáticos da API                 |

Variáveis de ambiente opcionais: `PORT` (padrão `3000`) e `DATA_FILE` (caminho do arquivo de dados).

## Endpoints

| Método | Rota                       | Descrição                                   |
|--------|----------------------------|---------------------------------------------|
| POST   | `/api/usuarios`            | Cadastra um usuário                         |
| GET    | `/api/usuarios?nome=texto` | Busca usuários pelo nome (busca parcial)    |
| GET    | `/api/usuarios`            | Lista todos os usuários                     |
| GET    | `/api/usuarios/:id`        | Busca um usuário pelo `id`                  |
| PUT    | `/api/usuarios/:id`        | Edita um usuário pelo `id`                  |
| DELETE | `/api/usuarios/:id`        | Remove um usuário pelo `id`                 |

A busca ignora maiúsculas/minúsculas e acentos: `?nome=joao` encontra "João Silva".
Todas as respostas são em JSON, inclusive os erros (`{ "erros": ["..."] }`).

### Cadastrar: `POST /api/usuarios`

Body (JSON):

```json
{
  "nome": "João Silva",
  "email": "joao@exemplo.com",
  "idade": 27
}
```

Regras: `nome` com pelo menos 2 caracteres, `email` válido e único, `idade` **número inteiro** entre 0 e 150.

Respostas:
- `201 Created`: usuário criado (retorna o usuário com `id` e `criadoEm`)
- `400 Bad Request`: dados inválidos ou JSON malformado, ex.: `{ "erros": ["email inválido"] }`
- `409 Conflict`: e-mail já cadastrado

### Buscar: `GET /api/usuarios?nome=joao`

```json
[
  {
    "id": "c0a8...",
    "nome": "João Silva",
    "email": "joao@exemplo.com",
    "idade": 27,
    "criadoEm": "2026-10-09T12:00:00.000Z"
  }
]
```

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

Respostas:
- `200 OK`: usuário atualizado
- `400 Bad Request`: dados inválidos
- `404 Not Found`: nenhum usuário com esse `id`
- `409 Conflict`: o e-mail já pertence a outro usuário

No site, o botão **Editar** fica na aba Pesquisar, ao lado de "Remover", e abre uma janela com os dados preenchidos.

### Remover: `DELETE /api/usuarios/:id`

Use o `id` retornado no cadastro (ou na busca).

Respostas:
- `200 OK`: `{ "mensagem": "usuário apagado com sucesso", "usuario": { ... } }`
- `404 Not Found`: nenhum usuário com esse `id`

## Postman

Importe o arquivo `cadastro-api.postman_collection.json` no Postman (File → Import).
A coleção já vem com as requisições de cadastro, busca, listagem, busca pelo id, edição e remoção.
Ao rodar "Cadastrar usuário", o `id` criado é guardado automaticamente e usado em "Buscar usuário pelo id",
"Editar usuário" e "Apagar usuário".

## Estrutura

```
server.js                → ponto de entrada: lê a configuração e sobe o servidor
src/
  app.js                 → monta o Express (JSON, arquivos do site, rotas, tratamento de erros)
  rotas.js               → camada HTTP das rotas /api/usuarios
  usuario.js             → regras do usuário: validação e montagem do registro
  repositorio.js         → leitura e gravação no arquivo JSON
  texto.js               → normalização de texto (acentos/maiúsculas)
test/
  usuarios.test.js       → testes automáticos da API (node:test, sem dependências extras)
public/
  index.html, style.css  → página e visual
  js/main.js             → ponto de entrada do site: eventos, abas, edição e bloqueio da pesquisa
  js/api.js              → todas as chamadas HTTP para a API
  js/componentes.js      → peças visuais: lista, campos do formulário, janela, mensagens, toast e aviso
  js/utils.js            → funções puras de texto (escape de HTML, iniciais, destaque)
data/usuarios.json       → "banco de dados"
```

Cada camada tem uma responsabilidade só. Por exemplo, para trocar o arquivo JSON
por um banco de dados, basta reescrever `src/repositorio.js` mantendo os mesmos métodos.
