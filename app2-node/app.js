const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Olá! Esta é a App 2 - Node.js Express");
});

app.get("/time", (req, res) => {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Recife" });
  res.send(`Horário atual do servidor (App 2): ${now}`);
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`App 2 rodando na porta ${PORT}`);
});