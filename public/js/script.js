document.addEventListener('DOMContentLoaded', function() {
  // Configuração dinâmica da URL da API
  const API_URL = window.location.host.includes('vercel.app')
    ? 'https://portal-koch.vercel.app/api' 
    : 'http://localhost:3000/api';
  
  const REMOVE_BG_API_KEY = 'ZFuErdLpDeJEJwdD2NEk7JEp';
  const tituloInput = document.getElementById('titulo');
  const quantidadeInput = document.getElementById('quantidade');
  const skusContainer = document.getElementById('skus-container');
  const adicionarSkuBtn = document.getElementById('adicionar-sku');
  
  // Constantes globais
  const VALID_SKUS = ['9737', '72829', '5465'];
  const PRODUCT_FALLBACK = {
    '9737': { 
      sku: '9737',
      descricao: 'Detergente Ypê Clear 500ml', 
      preco: '2.99' 
    },
    '72829': { 
      sku: '72829',
      descricao: 'Amaciante Downy 1L', 
      preco: '15.90' 
    },
    '5465': { 
      sku: '5465',
      descricao: 'Água Sanitária Ypê 2L', 
      preco: '6.49' 
    }
  };
  
  const estado = {
    produtos: [],
    carregando: false
  };

  // Função para mostrar alertas
  function showAlert(message, isSuccess = false) {
    const alert = document.createElement('div');
    alert.className = `alert ${isSuccess ? 'success' : ''}`;
    
    const icon = document.createElement('i');
    icon.className = isSuccess ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    
    const text = document.createElement('span');
    text.textContent = message;
    
    alert.appendChild(icon);
    alert.appendChild(text);
    document.body.appendChild(alert);
    
    setTimeout(() => alert.classList.add('show'), 10);
    
    setTimeout(() => {
      alert.classList.remove('show');
      setTimeout(() => alert.remove(), 300);
    }, 3000);
  }

  // Atualiza os campos de SKU dinamicamente
  function atualizarCamposSKU() {
    let qtd = parseInt(quantidadeInput.value) || 1;
    qtd = Math.max(1, Math.min(qtd, 3));
    quantidadeInput.value = qtd;
    skusContainer.innerHTML = '';
    
    const skuInfo = document.createElement('div');
    skuInfo.className = 'valid-skus';
    skuInfo.innerHTML = `SKUs válidas: <span>${VALID_SKUS.join(', ')}</span>`;
    skusContainer.appendChild(skuInfo);
    
    for (let i = 0; i < qtd; i++) {
      const div = document.createElement('div');
      div.className = 'form-group sku-group';
      div.innerHTML = `
        <label>SKU do Produto ${i+1}:</label>
        <div style="display: flex; align-items: center;">
          <input type="text" placeholder="Digite a SKU" class="produto-sku" required>
          <div class="tooltip">ℹ️
            <span class="tooltiptext">Digite uma das SKUs válidas: ${VALID_SKUS.join(', ')}</span>
          </div>
        </div>
        <label>Imagem do Produto ${i+1}:</label>
        <input type="file" accept="image/*" class="produto-imagem" required>
        <div class="imagem-container">
          <img class="imagem-preview" style="display:none;">
          <div class="loading-imagem" style="display:none;">Processando imagem...</div>
          <div class="error-imagem" style="display:none; color:red;"></div>
        </div>
      `;
      skusContainer.appendChild(div);
    }
  }

  // Remove o fundo da imagem usando a API Remove.bg
  async function removeImageBackground(imageDataUrl) {
    try {
      const blob = await (await fetch(imageDataUrl)).blob();
      const formData = new FormData();
      formData.append('image_file', blob);
      
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_API_KEY
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Erro na API Remove.bg: ${response.status}`);
      }

      const resultBlob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(resultBlob);
      });
    } catch (error) {
      console.error('Erro ao remover fundo:', error);
      throw new Error('Falha ao remover fundo da imagem');
    }
  }

  // Comprime a imagem para otimização
  async function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const scale = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = event.target.result;
      };
      
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  // Processa a imagem (compressão + remoção de fundo)
  async function processImage(file) {
    try {
      const compressedImage = await compressImage(file);
      const imageWithoutBg = await removeImageBackground(compressedImage);
      return imageWithoutBg;
    } catch (error) {
      console.error('Erro no processamento da imagem:', error);
      throw error;
    }
  }

  // Formata o preço para o padrão numérico
  function formatPrice(price) {
    if (typeof price === 'number') {
      return price.toFixed(2);
    }
    
    if (typeof price === 'string') {
      const cleaned = price.replace(/[^\d,.]/g, '');
      return cleaned.replace(',', '.');
    }
    
    return '0.00';
  }

  // Busca os dados do produto com tentativas de retry
  async function fetchProductWithRetry(sku, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Tentativa ${attempt} para SKU ${sku}`);
        const response = await fetch(`${API_URL}/produto/${sku}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn(`Resposta não-OK para SKU ${sku}: ${response.status}`);
          throw new Error(`HTTP status ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || !data.success || !data.data || typeof data.data.preco === 'undefined') {
          console.warn('Dados incompletos da API, usando fallback', data);
          throw new Error('Dados incompletos da API');
        }

        return {
          success: true,
          data: {
            sku: data.data.sku || sku,
            descricao: data.data.descricao || PRODUCT_FALLBACK[sku]?.descricao || 'Produto não encontrado',
            preco: formatPrice(data.data.preco) || PRODUCT_FALLBACK[sku]?.preco || '0.00'
          }
        };

      } catch (error) {
        console.warn(`Tentativa ${attempt} falhou:`, error);
        if (attempt === retries) {
          console.log('Usando fallback para SKU:', sku);
          if (PRODUCT_FALLBACK[sku]) {
            return {
              success: true,
              data: PRODUCT_FALLBACK[sku]
            };
          }
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Event listeners
  quantidadeInput.addEventListener('input', atualizarCamposSKU);
  quantidadeInput.addEventListener('change', function() {
    if (this.value < 1) this.value = 1;
    if (this.value > 3) this.value = 3;
    atualizarCamposSKU();
  });

  // Handler para o botão de adicionar SKU
  adicionarSkuBtn.addEventListener('click', async function() {
    if (estado.carregando) return;
    
    try {
      estado.carregando = true;
      adicionarSkuBtn.disabled = true;
      adicionarSkuBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

      const titulo = tituloInput.value.trim();
      if (!titulo) throw new Error('Digite um título válido para o projeto!');

      const skuInputs = document.querySelectorAll('.produto-sku');
      const imagemInputs = document.querySelectorAll('.produto-imagem');
      
      if (skuInputs.length === 0) throw new Error('Selecione pelo menos um produto!');

      estado.produtos = [];
      const productsData = [];

      for (let i = 0; i < skuInputs.length; i++) {
        const sku = skuInputs[i].value.trim();
        const imagemInput = imagemInputs[i];
        const errorElement = imagemInput.nextElementSibling.querySelector('.error-imagem');
        const loader = imagemInput.nextElementSibling.querySelector('.loading-imagem');
        
        errorElement.style.display = 'none';
        loader.style.display = 'block';

        try {
          if (!sku) throw new Error(`Preencha a SKU do Produto ${i+1}!`);
          if (!VALID_SKUS.includes(sku)) throw new Error(`SKU inválida! Use uma das seguintes: ${VALID_SKUS.join(', ')}`);
          if (!imagemInput.files[0]) throw new Error(`Adicione uma imagem para o Produto ${i+1}!`);
          
          const produto = await fetchProductWithRetry(sku);
          const imagemProcessada = await processImage(imagemInput.files[0]);
          
          productsData.push({
            sku: produto.data.sku,
            descricao: produto.data.descricao,
            preco: produto.data.preco,
            imagem: imagemProcessada,
            unidade: "UNID."
          });
        } catch (error) {
          errorElement.textContent = error.message;
          errorElement.style.display = 'block';
          throw error;
        } finally {
          loader.style.display = 'none';
        }
      }

      // Envio dos dados para a API com tratamento de erro melhorado
      const response = await fetch(`${API_URL}/projetos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nome: titulo,
          produtos: productsData 
        })
      });

      let responseData;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          const text = await response.text();
          throw new Error(text || 'Erro desconhecido ao salvar projeto');
        }
      } catch (error) {
        console.error('Erro ao analisar resposta:', error);
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        throw new Error(responseData?.error || 'Erro ao salvar projeto');
      }

      showAlert('Produtos adicionados com sucesso!', true);
      setTimeout(() => {
        window.location.href = 'verProjetos.html';
      }, 1500);
    } catch (error) {
      console.error('Erro:', error);
      showAlert(`Erro: ${error.message}`);
    } finally {
      estado.carregando = false;
      adicionarSkuBtn.disabled = false;
      adicionarSkuBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Produto';
    }
  });
  
  // Handler para upload de imagens
  skusContainer.addEventListener('change', async function(e) {
    if (e.target.classList.contains('produto-imagem') && e.target.files[0]) {
      const file = e.target.files[0];
      const container = e.target.nextElementSibling;
      const preview = container.querySelector('.imagem-preview');
      const loader = container.querySelector('.loading-imagem');
      const errorElement = container.querySelector('.error-imagem');
      
      preview.style.display = 'none';
      errorElement.style.display = 'none';
      loader.style.display = 'block';
      
      try {
        if (!file.type.match('image.*')) {
          throw new Error('Tipo de arquivo inválido. Use apenas imagens.');
        }

        const processedImage = await processImage(file);
        preview.src = processedImage;
        preview.style.display = 'block';
        preview.style.backgroundColor = 'transparent';
      } catch (error) {
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
        e.target.value = '';
      } finally {
        loader.style.display = 'none';
      }
    }
  });

  // Inicialização
  document.getElementById('ano').textContent = new Date().getFullYear();
  atualizarCamposSKU();
});