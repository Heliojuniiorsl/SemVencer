export default function ProdutoCard({ produto }) {
  const detalhes = [
    produto.tipoPlu || produto.tipo,
    produto.secao,
    produto.embalagemMultiplo ? `Emb. ${produto.embalagemMultiplo}` : '',
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <article className="produto-card">
      <div>
        <span className="badge">{produto.categoria}</span>
        <h3>{produto.descricao}</h3>
        <p>{detalhes}</p>
      </div>
      <strong>{produto.plu}</strong>
    </article>
  );
}
