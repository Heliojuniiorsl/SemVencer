import ProdutoCard from './ProdutoCard';

export default function ResultadoCards({ produtos }) {
  return (
    <div className="resultado-cards-container">
      <div className="cards-grid">
        {produtos.map((produto) => (
          <ProdutoCard key={produto.plu} produto={produto} />
        ))}
      </div>
      <p className="resultado-info">{produtos.length} produtos encontrados</p>
    </div>
  );
}
