require("dotenv").config();
const fs = require("fs");
const path = require("path");

const e = process.env.GESTORA_EMAIL;
const s = process.env.GESTORA_SENHA;

console.log("cwd:", process.cwd());
console.log(".env existe aqui:", fs.existsSync(path.resolve(".env")));
console.log("email len:", e ? e.length : "(vazio)");
console.log("senha len:", s ? s.length : "(vazio)");
console.log("senha tem espaço/aspas/#:", /[\s'"#]/.test(s || ""));
console.log("API_URL:", process.env.API_URL || "(não definida)");

// Conta linhas duplicadas no .env, sem mostrar valores
const linhas = fs.readFileSync(".env", "utf8").split(/\r?\n/);
for (const nome of ["GESTORA_EMAIL", "GESTORA_SENHA", "API_URL"]) {
  const qtd = linhas.filter((l) => l.trim().startsWith(nome + "=")).length;
  console.log(`linhas com ${nome}=:`, qtd);
}

// Detecta a mesma variável definida no sistema (que o dotenv não sobrescreve)
console.log("Obs.: se 'senha len' não bater, pode haver variável de sistema GESTORA_SENHA.");