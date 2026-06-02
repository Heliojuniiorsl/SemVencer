import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Calculator,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Eye,
  Filter,
  Grid3x3,
  LayoutDashboard,
  List,
  PackageCheck,
  PackageSearch,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import ProdutoCard from './components/ProdutoCard';
import ResultadoTabela from './components/ResultadoTabela';
import ResultadoCards from './components/ResultadoCards';
import produtos from './data/plus.json';
import { calcularUltimoDigito, montarPluCompleto, somenteNumeros } from './utils/calcularDigito';
import { buscarProdutoExato, buscarProdutos } from './utils/filtros';

const categorias = ['Todas', 'Bovino', 'Suíno', 'Aves', 'Cordeiro', 'Peixes', 'Outros'];

const navegacao = [
  { path: '/', label: 'Início', icon: LayoutDashboard },
  { path: '/plu', label: 'PLU', icon: Calculator },
  { action: 'cadastro', label: 'Cadastrar', icon: PackageCheck },
  { path: '/pesquisa-plu', label: 'Pesquisa', icon: Search },
  { path: '/validades', label: 'Validades', icon: CalendarCheck },
];

const statusConfig = {
  vencido: {
    label: 'Vencidos',
    badge: 'Vencido',
    icon: XCircle,
    tone: 'danger',
  },
  hoje: {
    label: 'Vencem hoje',
    badge: 'Hoje',
    icon: AlertTriangle,
    tone: 'warning',
  },
  critico: {
    label: 'Até 3 dias',
    badge: 'Até 3 dias',
    icon: Clock3,
    tone: 'orange',
  },
  alerta: {
    label: 'Até 7 dias',
    badge: 'Até 7 dias',
    icon: CalendarCheck,
    tone: 'blue',
  },
  ok: {
    label: 'Em dia',
    badge: 'Em dia',
    icon: ShieldCheck,
    tone: 'success',
  },
};

const setores = ['Área de venda', 'Câmara', 'Açougue', 'Câmara fria', 'Exposição', 'Manipulação', 'Separação'];

const storageKeys = {
  validades: 'semVencer.validades.v1',
  fotosPorPlu: 'semVencer.fotosPorPlu.v1',
};

const validadeSeed = [
  {
    produtoIndex: 1,
    lote: 'BLC-2305',
    setor: 'Açougue',
    quantidade: '8,4 kg',
    validadeEmDias: -1,
    responsavel: 'Equipe manhã',
  },
  {
    produtoIndex: 12,
    lote: 'EXP-1021',
    setor: 'Exposição',
    quantidade: '12 un',
    validadeEmDias: 0,
    responsavel: 'Balcão',
  },
  {
    produtoIndex: 28,
    lote: 'CAM-7720',
    setor: 'Câmara fria',
    quantidade: '18,2 kg',
    validadeEmDias: 1,
    responsavel: 'Conferência',
  },
  {
    produtoIndex: 44,
    lote: 'MAN-1844',
    setor: 'Manipulação',
    quantidade: '6,7 kg',
    validadeEmDias: 3,
    responsavel: 'Produção',
  },
  {
    produtoIndex: 67,
    lote: 'SEP-4920',
    setor: 'Separação',
    quantidade: '21 un',
    validadeEmDias: 5,
    responsavel: 'Expedição',
  },
  {
    produtoIndex: 90,
    lote: 'CAM-8102',
    setor: 'Câmara fria',
    quantidade: '14,6 kg',
    validadeEmDias: 11,
    responsavel: 'Equipe tarde',
  },
  {
    produtoIndex: 116,
    lote: 'EXP-5531',
    setor: 'Exposição',
    quantidade: '9 un',
    validadeEmDias: 16,
    responsavel: 'Reposição',
  },
];

function normalizarBase() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

const basePath = normalizarBase();

function resolverRota(pathname) {
  let path = decodeURIComponent(pathname || '/');

  if (basePath && basePath !== '/' && path === basePath) {
    path = '/';
  } else if (basePath && basePath !== '/' && path.startsWith(`${basePath}/`)) {
    path = path.slice(basePath.length);
  }

  if (!path || path === '') {
    return '/';
  }

  const aliases = {
    '/dashboard': '/',
    '/pesquisa': '/pesquisa-plu',
    '/pesquisa-de-plu': '/pesquisa-plu',
    '/pesquisa de plu': '/pesquisa-plu',
  };

  return aliases[path] || path;
}

function criarHref(path) {
  if (!basePath || basePath === '/') {
    return path;
  }

  return `${basePath}${path === '/' ? '/' : path}`;
}

function criarDataRelativa(dias) {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function criarValidadesIniciais() {
  return validadeSeed.map((item, index) => {
    const produto = produtos[item.produtoIndex] || produtos[index] || produtos[0];

    return {
      id: `validade-${index + 1}`,
      produto: produto.descricao,
      plu: produto.plu,
      categoria: produto.categoria,
      lote: item.lote,
      setor: item.setor,
      quantidade: item.quantidade,
      fabricacao: criarDataRelativa(item.validadeEmDias - 5),
      validade: criarDataRelativa(item.validadeEmDias),
      responsavel: item.responsavel,
      revisado: item.validadeEmDias > 7,
    };
  });
}

function lerStorageJson(chave, fallback) {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : fallback;
  } catch (error) {
    console.warn(`Nao foi possivel ler ${chave}`, error);
    return fallback;
  }
}

function salvarStorageJson(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch (error) {
    console.warn(`Nao foi possivel salvar ${chave}`, error);
  }
}

function carregarFotosPorPlu() {
  return lerStorageJson(storageKeys.fotosPorPlu, {});
}

function aplicarFotosSalvas(itens, fotosPorPlu) {
  return itens.map((item) => {
    const codigo = somenteNumeros(item.plu);

    return {
      ...item,
      imagem: item.imagem || fotosPorPlu[codigo] || '',
    };
  });
}

function carregarValidadesSalvas(fotosPorPlu) {
  const salvas = lerStorageJson(storageKeys.validades, null);
  const itens = Array.isArray(salvas) && salvas.length > 0 ? salvas : criarValidadesIniciais();
  return aplicarFotosSalvas(itens, fotosPorPlu);
}

function formatarData(dataISO) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${dataISO}T00:00:00`));
}

function diferencaEmDias(dataISO) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataISO}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function classificarValidade(dias) {
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoje';
  if (dias <= 3) return 'critico';
  if (dias <= 7) return 'alerta';
  return 'ok';
}

function textoPrazo(dias) {
  if (dias < 0) return `${Math.abs(dias)} dia(s) vencido`;
  if (dias === 0) return 'vence hoje';
  return `vence em ${dias} dia(s)`;
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function encontrarProdutosProvaveis(listaProdutos, nome, codigo, limite = 12) {
  const termoNome = normalizarTexto(nome);
  const termoCodigo = somenteNumeros(codigo);

  if (termoNome.length < 2 && termoCodigo.length < 2) {
    return [];
  }

  const palavras = termoNome.split(/\s+/).filter(Boolean);

  return listaProdutos
    .map((produto) => {
      const descricao = normalizarTexto(produto.descricao);
      let score = 0;

      if (termoCodigo) {
        if (produto.plu === termoCodigo) {
          score += 1000;
        } else if (produto.plu.startsWith(termoCodigo)) {
          score += 450 + termoCodigo.length;
        } else if (produto.plu.includes(termoCodigo)) {
          score += 220 + termoCodigo.length;
        }
      }

      if (termoNome.length >= 2) {
        if (descricao === termoNome) {
          score += 700;
        } else if (descricao.startsWith(termoNome)) {
          score += 420 + termoNome.length;
        } else if (descricao.includes(termoNome)) {
          score += 260 + termoNome.length;
        }

        const palavrasEncontradas = palavras.filter((palavra) => descricao.includes(palavra));
        score += palavrasEncontradas.length * 85;
      }

      return { produto, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.produto.descricao.localeCompare(b.produto.descricao))
    .slice(0, limite)
    .map((item) => item.produto);
}

function carregarImagemProduto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const imagem = new Image();

      imagem.onload = () => {
        const maxSize = 900;
        const escala = Math.min(1, maxSize / Math.max(imagem.width, imagem.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(imagem.width * escala);
        canvas.height = Math.round(imagem.height * escala);

        const context = canvas.getContext('2d');
        context.drawImage(imagem, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };

      imagem.onerror = reject;
      imagem.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function App() {
  const [rotaAtual, setRotaAtual] = useState(() => resolverRota(window.location.pathname));
  const [pluBase, setPluBase] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [copiado, setCopiado] = useState(false);
  const [visualizacao, setVisualizacao] = useState(() => (window.innerWidth < 768 ? 'cards' : 'tabela'));
  const [fotosPorPlu, setFotosPorPlu] = useState(carregarFotosPorPlu);
  const [validades, setValidades] = useState(() => carregarValidadesSalvas(fotosPorPlu));
  const [filtroValidade, setFiltroValidade] = useState('todos');
  const [buscaValidade, setBuscaValidade] = useState('');
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cadastroEdicaoId, setCadastroEdicaoId] = useState(null);
  const [produtoDetalhe, setProdutoDetalhe] = useState(null);
  const [novoItem, setNovoItem] = useState({
    produto: '',
    plu: '',
    setor: 'Área de venda',
    quantidade: '',
    validade: criarDataRelativa(5),
    imagem: '',
  });

  useEffect(() => {
    const handleResize = () => {
      setVisualizacao(window.innerWidth < 768 ? 'cards' : 'tabela');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRotaAtual(resolverRota(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!cadastroAberto && !produtoDetalhe) {
      return undefined;
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [cadastroAberto, produtoDetalhe]);

  useEffect(() => {
    salvarStorageJson(storageKeys.validades, validades);
  }, [validades]);

  useEffect(() => {
    salvarStorageJson(storageKeys.fotosPorPlu, fotosPorPlu);
  }, [fotosPorPlu]);

  const baseLimpa = somenteNumeros(pluBase);
  const ultimoDigito = calcularUltimoDigito(baseLimpa);
  const pluCompleto = montarPluCompleto(baseLimpa);
  const produtoCalculado = buscarProdutoExato(produtos, pluCompleto);

  const resultados = useMemo(() => {
    return buscarProdutos(produtos, termoPesquisa, categoria).slice(0, 80);
  }, [termoPesquisa, categoria]);

  const validadesTratadas = useMemo(() => {
    return validades
      .map((item) => {
        const dias = diferencaEmDias(item.validade);
        const status = classificarValidade(dias);
        const codigo = somenteNumeros(item.plu);

        return {
          ...item,
          imagem: item.imagem || fotosPorPlu[codigo] || '',
          dias,
          status,
          prazo: textoPrazo(dias),
        };
      })
      .sort((a, b) => a.dias - b.dias || a.produto.localeCompare(b.produto));
  }, [fotosPorPlu, validades]);

  const resumoValidades = useMemo(() => {
    const resumo = {
      vencido: 0,
      hoje: 0,
      critico: 0,
      alerta: 0,
      ok: 0,
      total: validadesTratadas.length,
    };

    validadesTratadas.forEach((item) => {
      resumo[item.status] += 1;
    });

    return resumo;
  }, [validadesTratadas]);

  const validadesFiltradas = useMemo(() => {
    const termo = buscaValidade.trim().toLowerCase();

    return validadesTratadas.filter((item) => {
      const combinaStatus = filtroValidade === 'todos' || item.status === filtroValidade;
      const combinaBusca =
        !termo ||
        item.produto.toLowerCase().includes(termo) ||
        item.plu.includes(somenteNumeros(termo)) ||
        item.lote.toLowerCase().includes(termo);

      return combinaStatus && combinaBusca;
    });
  }, [buscaValidade, filtroValidade, validadesTratadas]);

  const dadosPorSetor = useMemo(() => {
    return setores.map((setor) => {
      const itens = validadesTratadas.filter((item) => item.setor === setor);
      const pendentes = itens.filter((item) => ['vencido', 'hoje', 'critico', 'alerta'].includes(item.status)).length;

      return {
        setor,
        total: itens.length,
        pendentes,
      };
    });
  }, [validadesTratadas]);

  const categoriasResumo = useMemo(() => {
    return produtos.reduce((acc, produto) => {
      acc[produto.categoria] = (acc[produto.categoria] || 0) + 1;
      return acc;
    }, {});
  }, []);

  async function copiarPlu() {
    if (!pluCompleto) return;
    await navigator.clipboard.writeText(pluCompleto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  function navegar(event, path) {
    event.preventDefault();
    window.history.pushState({}, '', criarHref(path));
    setRotaAtual(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function executarAcaoNavegacao(action) {
    if (action === 'cadastro') {
      abrirCadastroProduto();
    }
  }

  function atualizarNovoItem(campo, valor) {
    setNovoItem((itemAtual) => ({
      ...itemAtual,
      [campo]: valor,
    }));
  }

  function salvarFotoDoPlu(plu, imagem) {
    const codigo = somenteNumeros(plu);

    if (!codigo || !imagem) {
      return;
    }

    setFotosPorPlu((fotosAtuais) => {
      if (fotosAtuais[codigo] === imagem) {
        return fotosAtuais;
      }

      return {
        ...fotosAtuais,
        [codigo]: imagem,
      };
    });
  }

  function limparCadastro() {
    setNovoItem({
      produto: '',
      plu: '',
      setor: 'Área de venda',
      quantidade: '',
      validade: criarDataRelativa(5),
      imagem: '',
    });
    setCadastroEdicaoId(null);
  }

  function abrirCadastroProduto() {
    limparCadastro();
    setCadastroAberto(true);
  }

  function fecharCadastroProduto() {
    setCadastroAberto(false);
    limparCadastro();
  }

  function abrirEdicaoProduto(item) {
    const codigo = somenteNumeros(item.plu);

    setNovoItem({
      produto: item.produto,
      plu: item.plu === 'Sem PLU' ? '' : item.plu,
      setor: item.setor.includes('Câmara') ? 'Câmara' : 'Área de venda',
      quantidade: item.quantidade,
      validade: item.validade,
      imagem: item.imagem || fotosPorPlu[codigo] || '',
    });
    setCadastroEdicaoId(item.id);
    setCadastroAberto(true);
  }

  function adicionarValidade(event) {
    event.preventDefault();

    if (!novoItem.produto.trim() || !novoItem.validade) {
      return;
    }

    const codigoLimpo = somenteNumeros(novoItem.plu);
    const pluFinal = codigoLimpo || 'Sem PLU';
    const imagemFinal = novoItem.imagem || fotosPorPlu[codigoLimpo] || '';
    salvarFotoDoPlu(codigoLimpo, imagemFinal);

    if (cadastroEdicaoId) {
      setValidades((itens) =>
        itens.map((item) =>
          item.id === cadastroEdicaoId
            ? {
                ...item,
                produto: novoItem.produto.trim(),
                plu: pluFinal,
                setor: novoItem.setor,
                quantidade: novoItem.quantidade.trim() || '1 un',
                validade: novoItem.validade,
                imagem: imagemFinal,
              }
            : item,
        ),
      );
      setCadastroAberto(false);
      limparCadastro();
      return;
    }

    setValidades((itens) => [
      {
        id: `validade-${Date.now()}`,
        produto: novoItem.produto.trim(),
        plu: pluFinal,
        categoria: 'Cadastro',
        setor: novoItem.setor,
        lote: 'Cadastro manual',
        quantidade: novoItem.quantidade.trim() || '1 un',
        fabricacao: criarDataRelativa(-1),
        validade: novoItem.validade,
        imagem: imagemFinal,
        responsavel: 'Cadastro mobile',
        revisado: false,
      },
      ...itens,
    ]);

    setCadastroAberto(false);
    limparCadastro();
  }

  function excluirProduto(id) {
    setValidades((itens) => itens.filter((item) => item.id !== id));
  }

  const pageProps = {
    resumoValidades,
    validadesTratadas,
    validadesFiltradas,
    dadosPorSetor,
    categoriasResumo,
    produtos,
    categorias,
    pluBase,
    setPluBase,
    baseLimpa,
    ultimoDigito,
    pluCompleto,
    produtoCalculado,
    copiado,
    copiarPlu,
    termoPesquisa,
    setTermoPesquisa,
    categoria,
    setCategoria,
    resultados,
    visualizacao,
    setVisualizacao,
    filtroValidade,
    setFiltroValidade,
    buscaValidade,
    setBuscaValidade,
    novoItem,
    atualizarNovoItem,
    adicionarValidade,
    cadastroAberto,
    cadastroEdicaoId,
    abrirCadastroProduto,
    fecharCadastroProduto,
    abrirEdicaoProduto,
    excluirProduto,
    produtoDetalhe,
    setProdutoDetalhe,
    navegar,
  };

  const rotaRenderizada = ['/plu', '/pesquisa-plu', '/validades'].includes(rotaAtual) ? rotaAtual : '/';

  return (
    <main className="app-shell">
      <Header
        navItems={navegacao}
        activePath={rotaRenderizada}
        buildHref={criarHref}
        onNavigate={navegar}
        onAction={executarAcaoNavegacao}
      />

      <section className="page-shell">
        {rotaRenderizada === '/' && <DashboardPage {...pageProps} />}
        {rotaRenderizada === '/plu' && <PluPage {...pageProps} />}
        {rotaRenderizada === '/pesquisa-plu' && <PesquisaPluPage {...pageProps} />}
        {rotaRenderizada === '/validades' && <ValidadesPage {...pageProps} />}
      </section>

      {cadastroAberto && (
        <CadastroProdutoSheet
          novoItem={novoItem}
          cadastroEdicaoId={cadastroEdicaoId}
          fotosPorPlu={fotosPorPlu}
          atualizarNovoItem={atualizarNovoItem}
          salvarFotoDoPlu={salvarFotoDoPlu}
          adicionarValidade={adicionarValidade}
          fecharCadastroProduto={fecharCadastroProduto}
        />
      )}

      <Footer />
    </main>
  );
}

function PageTitle({ eyebrow, title, description, icon: Icon }) {
  return (
    <div className="page-title">
      <div className="title-icon">
        <Icon size={22} />
      </div>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function DashboardPage({
  resumoValidades,
  validadesTratadas,
  dadosPorSetor,
  categoriasResumo,
  produtos,
  navegar,
}) {
  const prioridade = validadesTratadas.slice(0, 5);
  const totalCritico = resumoValidades.vencido + resumoValidades.hoje + resumoValidades.critico;
  const cobertura = resumoValidades.total
    ? Math.round(((resumoValidades.ok + resumoValidades.alerta) / resumoValidades.total) * 100)
    : 0;

  return (
    <div className="page-grid">
      <PageTitle
        eyebrow="Painel inicial"
        title="Dashboard de validades"
        description="Visão diária de risco, prioridade por lote, setores e base de PLUs monitorada."
        icon={LayoutDashboard}
      />

      <div className="metrics-grid">
        <MetricCard status="vencido" value={resumoValidades.vencido} />
        <MetricCard status="hoje" value={resumoValidades.hoje} />
        <MetricCard status="critico" value={resumoValidades.critico} />
        <MetricCard status="ok" value={`${cobertura}%`} label="Cobertura em dia" />
      </div>

      <div className="dashboard-layout">
        <section className="work-panel">
          <div className="section-heading">
            <div>
              <span>Fila operacional</span>
              <h3>Prioridade de hoje</h3>
            </div>
            <strong>{totalCritico} lote(s) críticos</strong>
          </div>

          <div className="priority-list">
            {prioridade.map((item) => (
              <ValidadeRow key={item.id} item={item} compact />
            ))}
          </div>
        </section>

        <section className="work-panel">
          <div className="section-heading">
            <div>
              <span>Rotina PVPS</span>
              <h3>Checklist de controle</h3>
            </div>
            <ClipboardList size={22} />
          </div>

          <div className="checklist">
            <ChecklistItem text="Separar vencidos e bloquear venda" urgent={resumoValidades.vencido > 0} />
            <ChecklistItem text="Conferir etiquetas que vencem hoje" urgent={resumoValidades.hoje > 0} />
            <ChecklistItem text="Revisar exposição dos próximos 3 dias" urgent={resumoValidades.critico > 0} />
            <ChecklistItem text="Atualizar novos lotes recebidos" />
          </div>
        </section>
      </div>

      <div className="dashboard-layout secondary">
        <section className="work-panel">
          <div className="section-heading">
            <div>
              <span>Setores</span>
              <h3>Mapa de validade</h3>
            </div>
            <Archive size={22} />
          </div>

          <div className="sector-grid">
            {dadosPorSetor.map((item) => (
              <article className="sector-card" key={item.setor}>
                <span>{item.setor}</span>
                <strong>{item.total}</strong>
                <p>{item.pendentes} pendente(s)</p>
              </article>
            ))}
          </div>
        </section>

        <section className="work-panel">
          <div className="section-heading">
            <div>
              <span>Base PLU</span>
              <h3>Produtos cadastrados</h3>
            </div>
            <TrendingUp size={22} />
          </div>

          <div className="stock-summary">
            <div>
              <strong>{produtos.length}</strong>
              <span>PLUs no banco local</span>
            </div>
            <div>
              <strong>{Object.keys(categoriasResumo).length}</strong>
              <span>categorias</span>
            </div>
          </div>

          <div className="category-bars">
            {Object.entries(categoriasResumo)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([categoria, total]) => (
                <div className="bar-row" key={categoria}>
                  <span>{categoria}</span>
                  <div>
                    <i style={{ width: `${Math.max(12, (total / produtos.length) * 100)}%` }} />
                  </div>
                  <strong>{total}</strong>
                </div>
              ))}
          </div>
        </section>
      </div>

      <div className="quick-actions">
        <a href={criarHref('/plu')} onClick={(event) => navegar(event, '/plu')}>
          <Calculator size={20} />
          <span>Calcular PLU</span>
        </a>
        <a href={criarHref('/pesquisa-plu')} onClick={(event) => navegar(event, '/pesquisa-plu')}>
          <Search size={20} />
          <span>Pesquisar PLU</span>
        </a>
        <a href={criarHref('/validades')} onClick={(event) => navegar(event, '/validades')}>
          <CalendarCheck size={20} />
          <span>Gerenciar validades</span>
        </a>
      </div>
    </div>
  );
}

function MetricCard({ status, value, label }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <article className={`metric-card tone-${config.tone}`}>
      <div>
        <span>{label || config.label}</span>
        <strong>{value}</strong>
      </div>
      <Icon size={24} />
    </article>
  );
}

function ChecklistItem({ text, urgent }) {
  return (
    <div className={urgent ? 'check-item urgent' : 'check-item'}>
      {urgent ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      <span>{text}</span>
    </div>
  );
}

function PluPage({
  pluBase,
  setPluBase,
  baseLimpa,
  ultimoDigito,
  pluCompleto,
  produtoCalculado,
  copiado,
  copiarPlu,
}) {
  return (
    <div className="page-grid">
      <PageTitle
        eyebrow="Cálculo"
        title="PLU"
        description="Calculadora de último dígito e validação direta no banco local de produtos."
        icon={Calculator}
      />

      <section className="tool-layout">
        <div className="tool-panel">
          <div className="section-heading">
            <div>
              <span>Entrada</span>
              <h3>PLU sem o último dígito</h3>
            </div>
            <PackageSearch size={22} />
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
            <p className="field-alert">Digite pelo menos 2 números para calcular.</p>
          )}
        </div>

        <div className="result-panel">
          {ultimoDigito !== null ? (
            <>
              <span>Último dígito</span>
              <strong>{ultimoDigito}</strong>
              <p>
                PLU completo <b>{pluCompleto}</b>
              </p>
              <button className="primary-button" onClick={copiarPlu}>
                {copiado ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </>
          ) : (
            <div className="empty-result">
              <Calculator size={32} />
              <strong>Aguardando PLU</strong>
              <span>O dígito aparece assim que a base tiver números suficientes.</span>
            </div>
          )}
        </div>
      </section>

      {ultimoDigito !== null && (
        <section className="work-panel">
          <div className="section-heading">
            <div>
              <span>Conferência</span>
              <h3>Produto localizado</h3>
            </div>
            <PackageCheck size={22} />
          </div>

          {produtoCalculado ? (
            <ProdutoCard produto={produtoCalculado} />
          ) : (
            <div className="empty-state">Nenhum produto encontrado com o PLU completo {pluCompleto}.</div>
          )}
        </section>
      )}
    </div>
  );
}

function PesquisaPluPage({
  termoPesquisa,
  setTermoPesquisa,
  categoria,
  setCategoria,
  categorias,
  resultados,
  visualizacao,
  setVisualizacao,
}) {
  return (
    <div className="page-grid">
      <PageTitle
        eyebrow="Consulta"
        title="Pesquisa de PLU"
        description="Busca por código, descrição ou categoria dentro da base de carnes e aves."
        icon={Search}
      />

      <section className="work-panel">
        <div className="search-row">
          <div className="search-field">
            <Search size={20} />
            <input
              value={termoPesquisa}
              placeholder="Ex: frango, 789, carne moída"
              onChange={(event) => setTermoPesquisa(event.target.value)}
            />
          </div>

          <div className="view-toggle">
            <button
              className={visualizacao === 'cards' ? 'active' : ''}
              onClick={() => setVisualizacao('cards')}
              title="Visualizar como cards"
            >
              <Grid3x3 size={18} />
            </button>
            <button
              className={visualizacao === 'tabela' ? 'active' : ''}
              onClick={() => setVisualizacao('tabela')}
              title="Visualizar como tabela"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <div className="filter-row">
          <Filter size={18} />
          {categorias.map((item) => (
            <button
              key={item}
              className={categoria === item ? 'active' : ''}
              onClick={() => setCategoria(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="work-panel">
        <div className="section-heading">
          <div>
            <span>Resultados</span>
            <h3>{resultados.length} item(ns) encontrados</h3>
          </div>
          <strong>{resultados.length === 80 ? 'Limite visual de 80' : 'Base local'}</strong>
        </div>

        {resultados.length > 0 ? (
          visualizacao === 'cards' ? (
            <ResultadoCards produtos={resultados} />
          ) : (
            <ResultadoTabela produtos={resultados} />
          )
        ) : (
          <div className="empty-state">Nenhum PLU encontrado nessa pesquisa.</div>
        )}
      </section>
    </div>
  );
}

function ValidadesPage({
  resumoValidades,
  validadesFiltradas,
  abrirEdicaoProduto,
  excluirProduto,
  produtoDetalhe,
  setProdutoDetalhe,
}) {
  return (
    <div className="page-grid">
      <PageTitle
        eyebrow="Controle"
        title="Validades"
        description="Cadastro e conferência dos lotes com vencimento, setor, quantidade e revisão."
        icon={CalendarCheck}
      />

      <div className="metrics-grid compact">
        <MetricCard status="vencido" value={resumoValidades.vencido} />
        <MetricCard status="hoje" value={resumoValidades.hoje} />
        <MetricCard status="critico" value={resumoValidades.critico} />
        <MetricCard status="alerta" value={resumoValidades.alerta} />
        <MetricCard status="ok" value={resumoValidades.ok} />
      </div>

      <section className="work-panel">
        <div className="section-heading">
          <div>
            <span>Produtos</span>
            <h3>Cadastrados</h3>
          </div>
          <strong>{validadesFiltradas.length} registro(s)</strong>
        </div>

        <div className="validade-list">
          {validadesFiltradas.map((item) => (
            <ProdutoCadastroCard
              key={item.id}
              item={item}
              onView={setProdutoDetalhe}
              onEdit={abrirEdicaoProduto}
              onDelete={excluirProduto}
            />
          ))}
        </div>
      </section>

      {produtoDetalhe && <ProdutoDetalheSheet item={produtoDetalhe} onClose={() => setProdutoDetalhe(null)} />}
    </div>
  );
}

function CadastroProdutoSheet({
  novoItem,
  cadastroEdicaoId,
  fotosPorPlu,
  atualizarNovoItem,
  salvarFotoDoPlu,
  adicionarValidade,
  fecharCadastroProduto,
}) {
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const produtosProvaveis = useMemo(
    () => encontrarProdutosProvaveis(produtos, novoItem.produto, novoItem.plu),
    [novoItem.produto, novoItem.plu],
  );

  async function selecionarFoto(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imagem = await carregarImagemProduto(file);
    atualizarNovoItem('imagem', imagem);
    salvarFotoDoPlu(novoItem.plu, imagem);
    event.target.value = '';
  }

  function usarProdutoProvavel(produto) {
    if (!produto) {
      return;
    }

    atualizarNovoItem('produto', produto.descricao);
    atualizarNovoItem('plu', produto.plu);
    if (!novoItem.imagem && fotosPorPlu[produto.plu]) {
      atualizarNovoItem('imagem', fotosPorPlu[produto.plu]);
    }
    setMostrarSugestoes(false);
  }

  return (
    <div className="bottom-sheet-backdrop" role="presentation" onClick={fecharCadastroProduto}>
      <section
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadastro-produto-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <span>Cadastro rápido</span>
            <h3 id="cadastro-produto-titulo">{cadastroEdicaoId ? 'Editar produto' : 'Novo produto'}</h3>
          </div>
          <button className="sheet-close" onClick={fecharCadastroProduto} aria-label="Fechar cadastro">
            <X size={20} />
          </button>
        </div>

        <form className="sheet-form" onSubmit={adicionarValidade}>
          <div className="photo-capture">
            <div className={novoItem.imagem ? 'photo-preview has-image' : 'photo-preview'}>
              {novoItem.imagem ? (
                <img src={novoItem.imagem} alt="Foto do produto" />
              ) : (
                <>
                  <Camera size={26} />
                  <span>Sem foto</span>
                </>
              )}
            </div>

            <label className="photo-button" htmlFor="produto-foto-input">
              <Camera size={18} />
              {novoItem.imagem ? 'Trocar foto' : 'Tirar foto'}
            </label>
            <input
              id="produto-foto-input"
              className="photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={selecionarFoto}
            />
          </div>

          <label>
            PLU / EAN
            <input
              value={novoItem.plu}
              inputMode="numeric"
              placeholder="Código de barras ou PLU"
              onChange={(event) => {
                const codigo = somenteNumeros(event.target.value);
                atualizarNovoItem('plu', codigo);
                if (novoItem.imagem) {
                  salvarFotoDoPlu(codigo, novoItem.imagem);
                } else if (fotosPorPlu[codigo]) {
                  atualizarNovoItem('imagem', fotosPorPlu[codigo]);
                }
                setMostrarSugestoes(true);
              }}
            />
          </label>

          <label>
            Nome
            <input
              value={novoItem.produto}
              placeholder="Nome do produto"
              onChange={(event) => {
                atualizarNovoItem('produto', event.target.value);
                setMostrarSugestoes(true);
              }}
            />
          </label>

          {mostrarSugestoes && produtosProvaveis.length > 0 && (
            <div className="produto-sugestoes">
              <div className="sugestoes-header">
                <span>Produtos prováveis</span>
                <strong>{produtosProvaveis.length}</strong>
              </div>

              <div className="sugestoes-scroll">
                {produtosProvaveis.map((produto) => (
                  <button
                    className="produto-sugestao"
                    key={produto.plu}
                    type="button"
                    onClick={() => usarProdutoProvavel(produto)}
                  >
                    <div>
                      <strong>{produto.descricao}</strong>
                      <p>
                        PLU {produto.plu} · {produto.categoria}
                      </p>
                    </div>
                    <CheckCircle2 size={20} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sheet-form-grid">
            <label>
              Validade
              <input
                type="date"
                value={novoItem.validade}
                onChange={(event) => atualizarNovoItem('validade', event.target.value)}
              />
            </label>

            <label>
              Quantidade
              <input
                value={novoItem.quantidade}
                placeholder="Ex: 12 un"
                onChange={(event) => atualizarNovoItem('quantidade', event.target.value)}
              />
            </label>
          </div>

          <label>
            Local
            <div className="local-toggle">
              {['Área de venda', 'Câmara'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={novoItem.setor === item ? 'active' : ''}
                  onClick={() => atualizarNovoItem('setor', item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </label>

          <button className="primary-button sheet-submit" type="submit">
            <CheckCircle2 size={18} />
            {cadastroEdicaoId ? 'Salvar alterações' : 'Salvar produto'}
          </button>
        </form>
      </section>
    </div>
  );
}

function ProdutoCadastroCard({ item, onView, onEdit, onDelete }) {
  const config = statusConfig[item.status];

  return (
    <article className="produto-cadastro-card">
      <div className="produto-image-box">
        {item.imagem ? (
          <img className="produto-foto" src={item.imagem} alt={`Foto de ${item.produto}`} />
        ) : (
          <>
            <PackageCheck size={40} />
            <span>Produto</span>
          </>
        )}
      </div>

      <div className="produto-card-content">
        <div className="produto-name-box">
          <span className={`produto-status tone-${config.tone}`}>{config.badge}</span>
          <h3>{item.produto}</h3>
        </div>

        <div className="produto-info-grid">
          <InfoBox label="Código" value={item.plu} />
          <InfoBox label="Qtd." value={item.quantidade} />
          <InfoBox label="Local" value={item.setor} />
          <InfoBox label="Validade" value={formatarData(item.validade)} />
        </div>

        <div className="produto-actions">
          <button className="produto-action-btn view" onClick={() => onView(item)} title="Visualizar produto">
            <Eye size={20} />
          </button>
          <button className="produto-action-btn edit" onClick={() => onEdit(item)} title="Editar produto">
            <Pencil size={20} />
          </button>
          <button className="produto-action-btn delete" onClick={() => onDelete(item.id)} title="Excluir produto">
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="produto-info-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProdutoDetalheSheet({ item, onClose }) {
  return (
    <div className="bottom-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="bottom-sheet detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="produto-detalhe-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <span>Produto cadastrado</span>
            <h3 id="produto-detalhe-titulo">{item.produto}</h3>
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Fechar detalhes">
            <X size={20} />
          </button>
        </div>

        <div className="detail-grid">
          {item.imagem && (
            <div className="detail-photo">
              <img src={item.imagem} alt={`Foto de ${item.produto}`} />
            </div>
          )}
          <InfoBox label="PLU / EAN" value={item.plu} />
          <InfoBox label="Quantidade" value={item.quantidade} />
          <InfoBox label="Local" value={item.setor} />
          <InfoBox label="Validade" value={formatarData(item.validade)} />
        </div>
      </section>
    </div>
  );
}

function ValidadeRow({ item, compact, onToggle }) {
  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <article className={`validade-row tone-${config.tone}`}>
      <div className="status-icon">
        <Icon size={18} />
      </div>
      <div className="validade-main">
        <div>
          <span className="status-badge">{config.badge}</span>
          <strong>{item.produto}</strong>
        </div>
        <p>
          PLU {item.plu} · lote {item.lote} · {item.setor}
        </p>
      </div>
      <div className="validade-meta">
        <strong>{formatarData(item.validade)}</strong>
        <span>{item.prazo}</span>
      </div>
      {!compact && (
        <button className={item.revisado ? 'review-button done' : 'review-button'} onClick={() => onToggle(item.id)}>
          <CheckCircle2 size={17} />
          {item.revisado ? 'Revisado' : 'Revisar'}
        </button>
      )}
    </article>
  );
}

export default App;
