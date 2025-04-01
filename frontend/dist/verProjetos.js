document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = 'http://localhost:3000';
  const listaProjetos = document.getElementById('lista-projetos');
  const loadingMessage = document.getElementById('loading-message');
  const noProjectsMessage = document.getElementById('no-projects-message');
  const fazerAnimacaoBtn = document.getElementById('fazer-animacao');
  const buscaInput = document.getElementById('busca-projetos');
  
  let projetosSelecionados = new Set();
  let todosProjetos = {};

  // Mostrar skeleton loading
  function showSkeletonLoading(count = 3) {
    listaProjetos.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'projeto-card';
      skeleton.innerHTML = `
        <div class="projeto-header skeleton" style="height: 60px;"></div>
        <div class="product-grid">
          <div class="product-card skeleton" style="height: 200px;"></div>
        </div>
      `;
      listaProjetos.appendChild(skeleton);
    }
  }

  // Mostrar alerta personalizado
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

  async function carregarProjetos() {
    loadingMessage.style.display = 'flex';
    noProjectsMessage.style.display = 'none';
    showSkeletonLoading();
    projetosSelecionados.clear();
    fazerAnimacaoBtn.disabled = true;
    
    try {
      const response = await fetch(`${API_URL}/api/projetos`);
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      
      todosProjetos = await response.json();
      
      if (!todosProjetos || Object.keys(todosProjetos).length === 0) {
        noProjectsMessage.style.display = 'flex';
        return;
      }
      
      exibirProjetos(todosProjetos);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      showAlert(`Erro ao carregar projetos: ${error.message}`);
    } finally {
      loadingMessage.style.display = 'none';
    }
  }

  function exibirProjetos(projetos) {
    listaProjetos.innerHTML = '';
    
    if (Object.keys(projetos).length === 0) {
      noProjectsMessage.style.display = 'flex';
      return;
    }
    
    Object.entries(projetos).forEach(([nome, dados]) => {
      const projetoDiv = document.createElement('div');
      projetoDiv.className = 'projeto-card';
      projetoDiv.innerHTML = `
        <div class="projeto-header">
          <div class="projeto-seletor">
            <input type="checkbox" id="seletor-${nome}" class="seletor-projeto">
            <label for="seletor-${nome}"></label>
          </div>
          <h2 class="projeto-titulo">${nome}</h2>
          <div class="projeto-acoes">
            <span class="projeto-data">${formatarData(dados.data)}</span>
            <button class="excluir-projeto" data-nome="${nome}">
              <i class="fas fa-trash-alt"></i> Excluir
            </button>
          </div>
        </div>
        <div class="product-grid">
          ${dados.produtos.map(prod => `
            <div class="product-card">
              ${prod.imagem ? `<img src="${prod.imagem}" alt="${prod.descricao}" class="product-image" loading="lazy">` : ''}
              <div class="product-details">
                <p class="product-sku"><strong>SKU:</strong> ${prod.sku}</p>
                <p class="product-description">${prod.descricao}</p>
                <p class="product-price"><strong>Preço:</strong> ${prod.preco}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      listaProjetos.appendChild(projetoDiv);
    });

    // Atualizar seletores
    document.querySelectorAll('.seletor-projeto').forEach(seletor => {
      seletor.addEventListener('change', function() {
        const projetoNome = this.id.replace('seletor-', '');
        if (this.checked) {
          projetosSelecionados.add(projetoNome);
        } else {
          projetosSelecionados.delete(projetoNome);
        }
        fazerAnimacaoBtn.disabled = projetosSelecionados.size === 0;
        fazerAnimacaoBtn.innerHTML = projetosSelecionados.size > 1 ?
          `<i class="fas fa-film"></i> Gerar ${projetosSelecionados.size} Animações` :
          `<i class="fas fa-film"></i> Gerar Animação`;
      });
    });

    // Event listeners para exclusão
    document.querySelectorAll('.excluir-projeto').forEach(botao => {
      botao.addEventListener('click', function() {
        const nomeProjeto = this.getAttribute('data-nome');
        excluirProjeto(nomeProjeto);
      });
    });
  }

  function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function excluirProjeto(nomeProjeto) {
    try {
      const confirmado = await Swal.fire({
        title: 'Tem certeza?',
        text: `O projeto "${nomeProjeto}" será excluído permanentemente!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
      });
      
      if (!confirmado.isConfirmed) return;

      const response = await fetch(`${API_URL}/api/projetos/${encodeURIComponent(nomeProjeto)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir projeto');
      }

      showAlert('Projeto excluído com sucesso', true);
      carregarProjetos();
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      showAlert(`Erro ao excluir projeto: ${error.message}`);
    }
  }

  fazerAnimacaoBtn.addEventListener('click', function() {
    if (projetosSelecionados.size === 0) {
      showAlert('Selecione pelo menos um projeto para gerar a animação!');
      return;
    }
    
    showAlert(`Animação(s) gerada(s) com sucesso para ${projetosSelecionados.size} projeto(s)!`, true);
    
    // Simular processamento
    fazerAnimacaoBtn.disabled = true;
    fazerAnimacaoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    
    setTimeout(() => {
      fazerAnimacaoBtn.disabled = false;
      fazerAnimacaoBtn.innerHTML = '<i class="fas fa-film"></i> Animação Gerada!';
      
      setTimeout(() => {
        fazerAnimacaoBtn.innerHTML = projetosSelecionados.size > 1 ?
          `<i class="fas fa-film"></i> Gerar ${projetosSelecionados.size} Animações` :
          `<i class="fas fa-film"></i> Gerar Animação`;
      }, 2000);
    }, 2000);
  });

  buscaInput.addEventListener('input', function() {
    const termo = this.value.toLowerCase().trim();
    
    if (!termo) {
      exibirProjetos(todosProjetos);
      return;
    }
    
    const projetosFiltrados = Object.entries(todosProjetos)
      .filter(([nome]) => nome.toLowerCase().includes(termo))
      .reduce((obj, [nome, dados]) => ({ ...obj, [nome]: dados }), {});
    
    exibirProjetos(projetosFiltrados);
  });

  // Configurar ano no footer
  document.getElementById('ano').textContent = new Date().getFullYear();
  
  // Carregar projetos inicialmente
  carregarProjetos();
});