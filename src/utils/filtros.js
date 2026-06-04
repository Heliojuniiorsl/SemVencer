import { somenteNumeros } from './calcularDigito';

export function buscarProdutos(produtos, termo, categoria = 'Todas') {
  const categoriaNormalizada = categoria || 'Todas';
  const termoLimpo = (termo || '').trim();
  const termoLower = termoLimpo.toLowerCase();

  return produtos.filter((produto) => {
    const combinaCategoria = categoriaNormalizada === 'Todas' || produto.categoria === categoriaNormalizada;

    if (!termoLimpo) {
      return combinaCategoria;
    }

    const termoNumeros = somenteNumeros(termoLimpo);
    const apenasNumeros = termoNumeros === termoLimpo;

    if (apenasNumeros) {
      return combinaCategoria && produto.plu.includes(termoNumeros);
    }

    const textoBusca = [
      produto.descricao,
      produto.categoria,
      produto.tipo,
      produto.tipoPlu,
      produto.secao,
      produto.embalagemMultiplo,
    ]
      .filter((valor) => valor !== null && valor !== undefined)
      .join(' ')
      .toLowerCase();

    return combinaCategoria && textoBusca.includes(termoLower);
  });
}

export function buscarProdutoExato(produtos, pluCompleto) {
  return produtos.find((produto) => produto.plu === pluCompleto);
}
