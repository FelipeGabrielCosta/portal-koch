require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Product data fallback
const PRODUCT_DATA_FALLBACK = {
  '9737': {
    descricao: 'Detergente Ypê Clear Frasco 500ml',
    preco: 'R$ 2,99'
  },
  '72829': {
    descricao: 'Amaciante de Roupas Concentrado Downy Frescor da Primavera 1L',
    preco: 'R$ 15,90'
  },
  '5465': {
    descricao: 'Água Sanitária Ypê Frasco 2L',
    preco: 'R$ 6,49'
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
    const produtosInvalidos = produtos.filter(p => !p.sku || !p.descricao || !p.preco || !p.imagem);
    if (produtosInvalidos.length > 0) {
      throw new Error('Todos os produtos devem ter SKU, descrição, preço e imagem');
    }

    projetos[nome] = {
      produtos,
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

// Nova rota para exclusão de projetos
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

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});