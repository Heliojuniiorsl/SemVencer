import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const produtosPath = path.join(rootDir, 'src', 'data', 'plus.json');
const destinoPath = path.join(rootDir, 'supabase', 'import-produtos-base.sql');
const chunkSize = 250;

function sqlString(valor) {
  if (valor === null || valor === undefined || valor === '') return 'null';
  return `'${String(valor).replaceAll("'", "''")}'`;
}

function sqlNumber(valor) {
  if (valor === null || valor === undefined || valor === '') return 'null';
  const numero = Number(valor);
  return Number.isFinite(numero) ? String(numero) : 'null';
}

function validarProdutos(produtos) {
  const vistos = new Set();
  const erros = [];

  produtos.forEach((produto, index) => {
    if (!produto.plu) erros.push(`Linha ${index + 1}: PLU vazio`);
    if (!produto.descricao) erros.push(`Linha ${index + 1}: descricao vazia`);
    if (vistos.has(String(produto.plu))) erros.push(`PLU duplicado: ${produto.plu}`);
    vistos.add(String(produto.plu));
  });

  if (erros.length > 0) {
    throw new Error(`Base invalida:\n${erros.slice(0, 20).join('\n')}`);
  }
}

function toSqlProduto(produto) {
  return [
    sqlString(produto.plu),
    sqlString(produto.descricao),
    sqlString(produto.categoria || 'Outros'),
    sqlString(produto.tipo || produto.tipoPlu || 'Nao informado'),
    sqlString(produto.tipoPlu || 'Nao informado'),
    sqlString(produto.secao || 'Outros'),
    sqlNumber(produto.embalagemMultiplo),
    sqlString('BASE_DADOS_NOMES_CORRIGIDOS.xlsx'),
  ];
}

const produtos = JSON.parse(await fs.readFile(produtosPath, 'utf8'));
validarProdutos(produtos);

const colunas = [
  'plu',
  'descricao',
  'categoria',
  'tipo',
  'tipo_plu',
  'secao',
  'embalagem_multiplo',
  'origem',
].join(', ');

const linhas = [
  '-- Gerado por npm run supabase:gerar-sql-produtos',
  '-- Importa a base PLU sem apagar dados existentes.',
  'begin;',
  '',
];

for (let inicio = 0; inicio < produtos.length; inicio += chunkSize) {
  const lote = produtos.slice(inicio, inicio + chunkSize);
  linhas.push(`insert into public.produtos_base (${colunas}) values`);
  linhas.push(lote.map((produto) => `  (${toSqlProduto(produto).join(', ')})`).join(',\n'));
  linhas.push(`on conflict (plu) do update set
  descricao = excluded.descricao,
  categoria = excluded.categoria,
  tipo = excluded.tipo,
  tipo_plu = excluded.tipo_plu,
  secao = excluded.secao,
  embalagem_multiplo = excluded.embalagem_multiplo,
  origem = excluded.origem;`);
  linhas.push('');
}

linhas.push('commit;', '');

await fs.writeFile(destinoPath, linhas.join('\n'), 'utf8');
console.log(`SQL gerado com ${produtos.length} produtos: ${destinoPath}`);
