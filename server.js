const path = require("path");
const { criarApp } = require("./src/app");
const { criarRepositorio } = require("./src/repositorio");

const PORTA = process.env.PORT || 3000;
const ARQUIVO_DADOS = process.env.DATA_FILE || path.join(__dirname, "data", "usuarios.json");

const app = criarApp({ repositorio: criarRepositorio(ARQUIVO_DADOS) });

app.listen(PORTA, () => {
  console.log(`Cadastro.api rodando em http://localhost:${PORTA}`);
});
