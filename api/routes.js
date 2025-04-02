//update
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const app = express();

// Configuração do CORS para produção/desenvolvimento
const allowedOrigins = [
  'https://portal-koch.vercel.app',
  'https://portal-koch-*.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.some(allowed => 
      origin === allowed || 
      origin.includes(allowed.replace('*', '')))
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // Para navegadores antigos
};

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Configuração do caminho do arquivo de dados
const DATA_FILE = process.env.VERCEL_ENV 
  ? '/tmp/data.json' 
  : path.join(__dirname, 'data.json');

// Garantir que o arquivo de dados exista
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

const PRODUCT_DATA_FALLBACK = {
  '9737': { descricao: 'Detergente Ypê Clear Frasco 500ml', preco: '2,99' },
  '72829': { descricao: 'Amaciante de Roupas Concentrado Downy Frescor da Primavera 1L', preco: '15,90' },
  '5465': { descricao: 'Água Sanitária Ypê Frasco 2L', preco: '6,49' }
};

const PRODUCT_URLS = {
  '9737': 'https://www.superkoch.com.br/detergente-ype-clear-frasco-500ml-9737',
  '72829': 'https://www.superkoch.com.br/amaciante-de-roupas-concentrado-downy-frescor-da-primavera-1l-72829',
  '5465': 'https://www.superkoch.com.br/agua-sanitaria-ype-frasco-2l-5465'
};

let projetos = {};

// Carregar dados existentes
try {
  projetos = JSON.parse(fs.readFileSync(DATA_FILE));
  console.log('Dados carregados do arquivo:', Object.keys(projetos));
} catch (error) {
  console.error('Erro ao carregar dados:', error);
}

// Função para salvar dados
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projetos, null, 2));
}

async function fetchProductData(sku) {
  console.log(`Buscando dados para SKU: ${sku}`);
  const url = PRODUCT_URLS[sku];
  
  if (!url) {
    throw new Error(`SKU ${sku} não encontrada em nosso catálogo`);
  }

  try {
    const { data } = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 10000
    });

    const dom = new JSDOM(data);
    const doc = dom.window.document;

    const skuElement = doc.querySelector('div.value[itemprop="sku"], .sku-value, .product-sku');
    if (!skuElement || !skuElement.textContent.includes(sku)) {
      throw new Error(`SKU ${sku} não encontrada na página do produto`);
    }

    const descricao = doc.querySelector('span.base[data-ui-id="page-title-wrapper"], h1.product-name, .product-title')?.textContent.trim();
    const preco = doc.querySelector('span.price, .product-price, .price-box')?.textContent.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\d,.]/g, '');

    if (!descricao || !preco) {
      throw new Error('Não foi possível obter todos os dados do produto');
    }

    console.log('Dados encontrados:', { sku, descricao, preco });
    return { sku, descricao, preco };
  } catch (error) {
    console.error(`Erro ao buscar produto SKU ${sku}:`, error.message);
    throw new Error(`Não foi possível obter dados para o produto SKU ${sku}: ${error.message}`);
  }
}

// Rotas da API
app.get('/api/produto/:sku', async (req, res) => {
  const { sku } = req.params;
  
  if (PRODUCT_DATA_FALLBACK[sku]) {
    return res.json({ 
      success: true,
      data: { sku, ...PRODUCT_DATA_FALLBACK[sku] }
    });
  }
  
  try {
    const produto = await fetchProductData(sku);
    res.json({ success: true, data: produto });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.get('/api/projetos', (req, res) => {
  res.json(projetos);
});

app.post('/api/projetos', async (req, res) => {
  try {
    const { nome, produtos } = req.body;
    
    // Validações
    if (!nome?.trim()) {
      return res.status(400).json({ success: false, error: 'O nome do projeto é obrigatório' });
    }

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ success: false, error: 'A lista de produtos não pode estar vazia' });
    }

    const produtosInvalidos = produtos.filter(p => 
      !p.sku || !p.descricao || !p.preco || !p.imagem?.startsWith('data:image/png')
    );

    if (produtosInvalidos.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Todos os produtos devem ter SKU, descrição, preço e imagem PNG com fundo transparente'
      });
    }

    // Salvar projeto
    projetos[nome] = {
      produtos: produtos.map(p => ({
        sku: p.sku,
        descricao: p.descricao,
        preco: p.preco,
        imagem: p.imagem,
        unidade: p.unidade || "UNID.",
      })),
      data: new Date().toISOString(),
      ultimaAtualizacao: new Date().toISOString()
    };

    saveData();
    
    res.json({ success: true, data: projetos[nome] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/projetos/:nome', (req, res) => {
  try {
    const { nome } = req.params;

    if (!projetos[nome]) {
      return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
    }

    delete projetos[nome];
    saveData();
    
    res.json({ success: true, message: `Projeto "${nome}" excluído com sucesso` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir arquivos estáticos na Vercel
if (process.env.VERCEL_ENV) {
  app.use(express.static(path.join(__dirname, '../public')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// Exportar o app para a Vercel
module.exports = app;

// Iniciar servidor local se não estiver na Vercel
if (!process.env.VERCEL_ENV) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}