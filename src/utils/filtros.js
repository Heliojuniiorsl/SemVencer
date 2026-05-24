import { somenteNumeros } from './calcularDigito';

export function buscarProdutos(produtos, termo, categoria = 'Todas') {
  const categoriaNormalizada = categoria || 'Todas';
  const termoLower = (termo || '').toLowerCase();

  return produtos.filter((produto) => {
    const combinaCategoria = categoriaNormalizada === 'Todas' || produto.categoria === categoriaNormalizada;
    
    if (!termo) {
      return combinaCategoria;
    }
    
    const termoNumeros = somenteNumeros(termo);
    const apenasNumeros = termoNumeros === termo;
    
    if (apenasNumeros) {
      // Se é só números, busca por PLU
      return combinaCategoria && produto.plu.includes(termoNumeros);
    } else {
      // Se tem letras, busca por descrição/nome
      return combinaCategoria && produto.descricao.toLowerCase().includes(termoLower);
    }
  });
}

export function buscarProdutoExato(produtos, pluCompleto) {
  return produtos.find((produto) => produto.plu === pluCompleto);
}
