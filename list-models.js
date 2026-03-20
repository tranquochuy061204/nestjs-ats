const fs = require('fs');
require('dotenv').config();

async function list() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
  );
  const data = await response.json();
  const models = data.models
    ? data.models.map((m) => m.name).join('\n')
    : JSON.stringify(data);
  fs.writeFileSync('models.txt', models);
}

list();
