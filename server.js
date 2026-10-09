const path = require("path");
const { criarApp } = require("./src/app");
const { criarRepositorio } = require("./src/repositorio");

const PORTA = process.env.PORT || 3000;
const ARQUIVO_BANCO = process.env.DB_FILE || path.join(__dirname, "data", "cadastro.db");

const app = criarApp({ repositorio: criarRepositorio(ARQUIVO_BANCO) });

app.listen(PORTA, () => {
  console.log(`Cadastro.api rodando em http://localhost:${PORTA}`);
});
