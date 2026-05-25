export default function ProdutoCard({ produto }) {
  return (
    <article className="produto-card">
      <div>
        <span className="badge">{produto.categoria}</span>
        <h3>{produto.descricao}</h3>
        <p>{produto.tipo}</p>
      </div>
      <strong>{produto.plu}</strong>
    </article>
  );
}
