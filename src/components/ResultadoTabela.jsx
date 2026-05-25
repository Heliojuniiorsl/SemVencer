import { Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function ResultadoTabela({ produtos }) {
  const [copiado, setCopiado] = useState(false);
  const [linhaCopiada, setLinhaCopiada] = useState(null);

  function copiarPlu(plu) {
    navigator.clipboard.writeText(plu);
    setLinhaCopiada(plu);
    setCopiado(true);
    setTimeout(() => {
      setCopiado(false);
      setLinhaCopiada(null);
    }, 1500);
  }

  return (
    <div className="resultado-tabela-container">
      <div className="tabela-scroll">
        <table className="resultado-tabela">
          <thead>
            <tr>
              <th>PLU</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((produto) => (
              <tr key={produto.plu} className="tabela-linha">
                <td className="plu-cell">
                  <strong>{produto.plu}</strong>
                </td>
                <td className="descricao-cell">{produto.descricao}</td>
                <td className="categoria-cell">
                  <span className="badge-tabela">{produto.categoria}</span>
                </td>
                <td className="tipo-cell">{produto.tipo}</td>
                <td className="acao-cell">
                  <button
                    className="btn-copiar-tabela"
                    onClick={() => copiarPlu(produto.plu)}
                    title="Copiar PLU"
                  >
                    {linhaCopiada === produto.plu ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="resultado-info">{produtos.length} produtos encontrados</p>
    </div>
  );
}
