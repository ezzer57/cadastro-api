const crypto = require("crypto");
const path = require("path");
const { criarApp } = require("./src/app");
const { criarRepositorio } = require("./src/repositorio");

const PORTA = process.env.PORT || 3000;
const ARQUIVO_BANCO = process.env.DB_FILE || path.join(__dirname, "data", "cadastro.db");
const TAMANHO_MINIMO_DO_SEGREDO = 32;

function lerSegredoDoToken() {
  const segredo = process.env.JWT_SECRET;

  if (!segredo) {
    console.warn(
      "Aviso: JWT_SECRET não foi definido. Usando um segredo temporário, então os logins " +
      "deixam de valer quando o servidor reinicia. Veja a seção \"Configuração\" do README.",
    );
    return crypto.randomBytes(32).toString("hex");
  }

  if (segredo.length < TAMANHO_MINIMO_DO_SEGREDO) {
    throw new Error(`JWT_SECRET deve ter pelo menos ${TAMANHO_MINIMO_DO_SEGREDO} caracteres.`);
  }
  return segredo;
}

const app = criarApp({
  repositorio: criarRepositorio(ARQUIVO_BANCO),
  segredoDoToken: lerSegredoDoToken(),
});

app.listen(PORTA, () => {
  console.log(`Cadastro.api rodando em http://localhost:${PORTA}`);
});
