require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const app = express();

// Configuração para a Vercel
const isVercel = process.env.VERCEL === '1';
const PORT = process.env.PORT || 3000;

// Configuração CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Declaração única da variável DATA_FILE
const DATA_FILE = (() => {
  if (isVercel) {
    return path.join('/tmp', 'data.json');
  }
  return path.join(__dirname, 'data.json');
})();

// Criar arquivo de dados se não existir
if (isVercel && !fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

const PRODUCT_DATA_FALLBACK = {
  '9737': {
    descricao: 'Detergente Ypê Clear Frasco 500ml',
    preco: '2,99'
  },
  '72829': {
    descricao: 'Amaciante de Roupas Concentrado Downy Frescor da Primavera 1L',
    preco: '15,90'
  },
  '5465': {
    descricao: 'Água Sanitária Ypê Frasco 2L',
    preco: '6,49'
  }
};

const PRODUCT_URLS = {
  '9737': 'https://www.superkoch.com.br/detergente-ype-clear-frasco-500ml-9737',
  '72829': 'https://www.superkoch.com.br/amaciante-de-roupas-concentrado-downy-frescor-da-primavera-1l-72829',
  '5465': 'https://www.superkoch.com.br/agua-sanitaria-ype-frasco-2l-5465',
};

let projetos = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    projetos = JSON.parse(fs.readFileSync(DATA_FILE));
    console.log('Dados carregados do arquivo:', Object.keys(projetos));
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
  }
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
    res.json({ 
      success: true,
      data: produto
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/projetos', (req, res) => {
  res.json(projetos);
});

app.post('/api/projetos', async (req, res) => {
  const { nome, produtos } = req.body;
  
  if (!nome || !nome.trim()) {
    return res.status(400).json({
      success: false,
      error: 'O nome do projeto é obrigatório'
    });
  }

  if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'A lista de produtos não pode estar vazia'
    });
  }

  try {
    const produtosInvalidos = produtos.filter(p => {
      if (!p.sku || !p.descricao || !p.preco || !p.imagem) return true;
      if (!p.imagem.startsWith('data:image/png')) {
        return true;
      }
      return false;
    });

    if (produtosInvalidos.length > 0) {
      throw new Error('Todos os produtos devem ter SKU, descrição, preço e imagem PNG com fundo transparente');
    }

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

    fs.writeFileSync(DATA_FILE, JSON.stringify(projetos, null, 2));
    
    res.json({
      success: true,
      data: projetos[nome]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/projetos/:nome', (req, res) => {
  const { nome } = req.params;

  if (!projetos[nome]) {
    return res.status(404).json({
      success: false,
      error: 'Projeto não encontrado'
    });
  }

  try {
    delete projetos[nome];
    fs.writeFileSync(DATA_FILE, JSON.stringify(projetos, null, 2));
    
    res.json({
      success: true,
      message: `Projeto "${nome}" excluído com sucesso`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../public')));

// Rota para o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

if (!isVercel) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;