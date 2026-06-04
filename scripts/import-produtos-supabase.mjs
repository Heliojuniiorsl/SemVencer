import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const produtosPath = path.join(rootDir, 'src', 'data', 'plus.json');
const chunkSize = 500;

async function carregarEnv() {
  const env = { ...process.env };

  try {
    const conteudo = await fs.readFile(envPath, 'utf8');
    for (const linha of conteudo.split(/\r?\n/)) {
      const texto = linha.trim();
      if (!texto || texto.startsWith('#') || !texto.includes('=')) continue;
      const [chave, ...partes] = texto.split('=');
      const valor = partes.join('=').trim().replace(/^["']|["']$/g, '');
      env[chave.trim()] = valor;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return env;
}

function validarProdutos(produtos) {
  const vistos = new Set();
  const erros = [];

  produtos.forEach((produto, index) => {
    if (!produto.plu) erros.push(`Linha ${index + 1}: PLU vazio`);
    if (!produto.descricao) erros.push(`Linha ${index + 1}: descricao vazia`);
    if (vistos.has(produto.plu)) erros.push(`PLU duplicado: ${produto.plu}`);
    vistos.add(produto.plu);
  });

  if (erros.length > 0) {
    throw new Error(`Base invalida:\n${erros.slice(0, 20).join('\n')}`);
  }
}

function toDbProduto(produto) {
  return {
    plu: String(produto.plu),
    descricao: produto.descricao,
    categoria: produto.categoria || 'Outros',
    tipo: produto.tipo || produto.tipoPlu || 'Nao informado',
    tipo_plu: produto.tipoPlu || 'Nao informado',
    secao: produto.secao || 'Outros',
    embalagem_multiplo: produto.embalagemMultiplo ?? null,
    origem: 'BASE_DADOS_NOMES_CORRIGIDOS.xlsx',
  };
}

const env = await carregarEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env antes de importar.');
}

const produtos = JSON.parse(await fs.readFile(produtosPath, 'utf8'));
validarProdutos(produtos);

const supabase = createClient(supabaseUrl, supabaseKey);
let importados = 0;

for (let inicio = 0; inicio < produtos.length; inicio += chunkSize) {
  const lote = produtos.slice(inicio, inicio + chunkSize).map(toDbProduto);
  const { error } = await supabase.from('produtos_base').upsert(lote, { onConflict: 'plu' });

  if (error) {
    throw new Error(`Falha no lote ${inicio + 1}-${inicio + lote.length}: ${error.message}`);
  }

  importados += lote.length;
  console.log(`Importados ${importados}/${produtos.length}`);
}

console.log(`Importacao concluida: ${importados} produtos.`);
