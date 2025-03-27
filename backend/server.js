require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();

// Configurações básicas de segurança e performance
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : '*'
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting para evitar abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});
app.use('/api/', limiter);

// Configurações do servidor
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Garante que a pasta de uploads existe
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuração segura do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Apenas imagens são permitidas.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Cache de produtos
const productCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Banco de dados em memória
const projetos = {};

// URLs dos produtos
const PRODUCT_URLS = {
  '9737': 'https://www.superkoch.com.br/detergente-ype-clear-frasco-500ml-9737',
  '72829': 'https://www.superkoch.com.br/amaciante-de-roupas-concentrado-downy-frescor-da-primavera-1l-72829',
  '5465': 'https://www.superkoch.com.br/agua-sanitaria-ype-frasco-2l-5465',
};

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rotas da API
const apiRouter = express.Router();
app.use('/api', apiRouter);

// Upload de imagens
apiRouter.post('/upload', upload.single('imagem'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false,
      error: 'Nenhuma imagem enviada ou tipo não suportado' 
    });
  }
  
  res.json({ 
    success: true,
    path: `/uploads/${req.file.filename}`,
    filename: req.file.filename
  });
});

// Busca de produtos
apiRouter.post('/produtos', async (req, res) => {
  try {
    const { skus } = req.body;
    
    if (!skus || !Array.isArray(skus)) {
      return res.status(400).json({
        success: false,
        error: 'Lista de SKUs inválida'
      });
    }

    const results = await Promise.allSettled(
      skus.map(sku => fetchProductData(sku))
    );

    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => r.reason.message);

    if (successful.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum produto encontrado',
        details: failed
      });
    }

    res.json({
      success: true,
      data: {
        produtos: successful,
        descricoes: successful.map(p => p.descricao),
        precos: successful.map(p => p.preco)
      },
      errors: failed.length > 0 ? failed : undefined
    });

  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao processar produtos'
    });
  }
});

// Gerenciamento de projetos
apiRouter.post('/projetos', (req, res) => {
  const { nome, imagens, descricoes, precos } = req.body;
  
  if (!nome || !descricoes || !precos) {
    return res.status(400).json({
      success: false,
      error: 'Dados do projeto incompletos'
    });
  }

  projetos[nome] = { 
    imagens: imagens || [],
    descricoes,
    precos,
    data: new Date(),
    lastUpdated: new Date()
  };

  res.json({ success: true });
});

apiRouter.get('/projetos', (req, res) => {
  const sortedProjects = Object.entries(projetos)
    .sort(([,a], [,b]) => b.data - a.data)
    .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

  res.json({
    success: true,
    data: sortedProjects
  });
});

// Servir arquivos estáticos
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '../dist')));

// Rota para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Middleware de erro
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Algo deu errado!'
  });
});

// Função auxiliar para buscar dados do produto
async function fetchProductData(sku) {
  // Verifica cache primeiro
  if (productCache.has(sku)) {
    const cached = productCache.get(sku);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  const url = PRODUCT_URLS[sku];
  if (!url) throw new Error(`SKU ${sku} não encontrada`);

  const { data } = await axios.get(url, {
    timeout: 5000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  const dom = new JSDOM(data);
  const doc = dom.window.document;

  const descricao = doc.querySelector('span.base[data-ui-id="page-title-wrapper"]')?.textContent.trim();
  const preco = doc.querySelector('span.price')?.textContent.trim();

  if (!descricao || !preco) throw new Error('Dados do produto incompletos');

  const result = { sku, descricao, preco };
  
  // Atualiza cache
  productCache.set(sku, {
    timestamp: Date.now(),
    data: result
  });

  return result;
}

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
});