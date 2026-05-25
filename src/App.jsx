import { useMemo, useState, useEffect } from 'react';
import { Calculator, Copy, Search, PackageSearch, CheckCircle2, Grid3x3, List } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import ProdutoCard from './components/ProdutoCard';
import ResultadoTabela from './components/ResultadoTabela';
import ResultadoCards from './components/ResultadoCards';
import produtos from './data/plus.json';
import { calcularUltimoDigito, montarPluCompleto, somenteNumeros } from './utils/calcularDigito';
import { buscarProdutoExato, buscarProdutos } from './utils/filtros';

const categorias = ['Todas', 'Bovino', 'Suíno', 'Aves', 'Cordeiro', 'Peixes', 'Outros'];

export default function App() {
  const [aba, setAba] = useState('calcular');
  const [pluBase, setPluBase] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [copiado, setCopiado] = useState(false);
  const [visualizacao, setVisualizacao] = useState('tabela');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detectar mudanças de tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Muda automaticamente para cards em mobile e tabela em desktop
      setVisualizacao(mobile ? 'cards' : 'tabela');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const baseLimpa = somenteNumeros(pluBase);
  const ultimoDigito = calcularUltimoDigito(baseLimpa);
  const pluCompleto = montarPluCompleto(baseLimpa);
  const produtoCalculado = buscarProdutoExato(produtos, pluCompleto);

  const resultados = useMemo(() => {
    return buscarProdutos(produtos, termoPesquisa, categoria).slice(0, 80);
  }, [termoPesquisa, categoria]);

  async function copiarPlu() {
    if (!pluCompleto) return;
    await navigator.clipboard.writeText(pluCompleto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <main className="app">
      <Header />
      <nav className="tabs">
        <button className={aba === 'calcular' ? 'active' : ''} onClick={() => setAba('calcular')}>
          <Calculator size={18} /> Descobrir último dígito
        </button>
        <button className={aba === 'pesquisar' ? 'active' : ''} onClick={() => setAba('pesquisar')}>
          <Search size={18} /> Pesquisar PLU
        </button>
      </nav>

      {aba === 'calcular' && (
        <section className="panel">
          <div className="panel-title">
            <PackageSearch size={24} />
            <div>
              <h2>Digite o PLU sem o último dígito</h2>
            </div>
          </div>

          <input
            className="input-principal"
            value={pluBase}
            inputMode="numeric"
            maxLength={7}
            placeholder="Digite o PLU base"
            onChange={(event) => setPluBase(somenteNumeros(event.target.value))}
          />

          {baseLimpa.length > 0 && baseLimpa.length < 2 && (
            <p className="aviso">Digite pelo menos 2 números para calcular.</p>
          )}

          {ultimoDigito !== null && (
            <div className="resultado-box">
              <span>Último dígito</span>
              <strong>{ultimoDigito}</strong>
              <p>PLU completo: <b>{pluCompleto}</b></p>
              <button onClick={copiarPlu}>
                {copiado ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copiado ? 'Copiado' : 'Copiar PLU'}
              </button>
            </div>
          )}

          {ultimoDigito !== null && (
            produtoCalculado ? (
              <div className="produto-encontrado">
                <h3>Produto encontrado</h3>
                <ProdutoCard produto={produtoCalculado} />
              </div>
            ) : (
              <div className="produto-vazio">
                Nenhum produto encontrado com o PLU completo <b>{pluCompleto}</b>.
              </div>
            )
          )}
        </section>
      )}

      {aba === 'pesquisar' && (
        <section className="panel">
          <div className="panel-title">
            <Search size={24} />
            <div>
              <h2>Pesquisar produto por PLU ou nome</h2>
            </div>
          </div>

          <div className="filtros">
            <input
              className="input-principal"
              value={termoPesquisa}
              placeholder="Ex: frango, 789, carne moida..."
              onChange={(event) => setTermoPesquisa(event.target.value)}
            />

            <div className="categorias">
              {categorias.map((item) => (
                <button key={item} className={categoria === item ? 'active' : ''} onClick={() => setCategoria(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="visualizacao-controls">
            <div className="contador">
              Mostrando {resultados.length} resultado(s){resultados.length === 80 ? ' — limite visual de 80 itens' : ''}
            </div>
            
            <div className="botoes-visualizacao">
              <button
                className={`btn-view ${visualizacao === 'cards' ? 'active' : ''}`}
                onClick={() => setVisualizacao('cards')}
                title="Visualizar como cards"
              >
                <Grid3x3 size={18} /> Cards
              </button>
              <button
                className={`btn-view ${visualizacao === 'tabela' ? 'active' : ''}`}
                onClick={() => setVisualizacao('tabela')}
                title="Visualizar como tabela"
              >
                <List size={18} /> Tabela
              </button>
            </div>
          </div>

          {resultados.length > 0 ? (
            visualizacao === 'cards' ? (
              <ResultadoCards produtos={resultados} />
            ) : (
              <ResultadoTabela produtos={resultados} />
            )
          ) : (
            <div className="produto-vazio">Nenhum PLU encontrado nessa pesquisa.</div>
          )}
        </section>
      )}
      <Footer />
    </main>
  );
}
