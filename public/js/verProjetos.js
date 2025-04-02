document.addEventListener('DOMContentLoaded', async () => {
  const API_URL = 'http://localhost:3000';
  const listaProjetos = document.getElementById('lista-projetos');
  const loadingMessage = document.getElementById('loading-message');
  const noProjectsMessage = document.getElementById('no-projects-message');
  const fazerAnimacaoBtn = document.getElementById('fazer-animacao');
  const buscaInput = document.getElementById('busca-projetos');
  
  let projetoSelecionado = null;
  let todosProjetos = {};

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
    projetoSelecionado = null;
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

  function formatarPrecoParaExibicao(preco) {
    if (typeof preco === 'string') {
        return preco.replace('.', ',');
    } else if (typeof preco === 'number') {
        return preco.toFixed(2).replace('.', ',');
    }
    return "0,00";
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
            <input type="checkbox" id="seletor-${nome}" class="seletor-projeto" ${projetoSelecionado === nome ? 'checked' : ''}>
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
                <p class="product-price"><strong>Preço:</strong> R$ ${formatarPrecoParaExibicao(prod.preco)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      listaProjetos.appendChild(projetoDiv);
    });

    // Atualizar seletores - agora com seleção única
    document.querySelectorAll('.seletor-projeto').forEach(seletor => {
      seletor.addEventListener('change', function() {
        if (this.checked) {
          // Desmarca todos os outros checkboxes
          document.querySelectorAll('.seletor-projeto').forEach(cb => {
            if (cb !== this) cb.checked = false;
          });
          
          projetoSelecionado = this.id.replace('seletor-', '');
          fazerAnimacaoBtn.disabled = false;
          fazerAnimacaoBtn.innerHTML = '<i class="fas fa-film"></i> Gerar Animação';
        } else {
          projetoSelecionado = null;
          fazerAnimacaoBtn.disabled = true;
        }
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
      const confirmado = confirm(`Tem certeza que deseja excluir o projeto "${nomeProjeto}"?`);
      if (!confirmado) return;

      const response = await fetch(`${API_URL}/api/projetos/${encodeURIComponent(nomeProjeto)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir projeto');
      }

      showAlert('Projeto excluído com sucesso', true);
      carregarProjetos();
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      showAlert(`Erro ao excluir projeto: ${error.message}`);
    }
  }

  fazerAnimacaoBtn.addEventListener('click', function() {
    if (!projetoSelecionado) {
      showAlert('Selecione um projeto para gerar a animação!');
      return;
    }
    
    // Pegar os dados do projeto selecionado
    const projetoAnimacao = {
      nome: projetoSelecionado,
      produtos: todosProjetos[projetoSelecionado].produtos
    };

    // Salvar no sessionStorage para a animacao.html acessar
    sessionStorage.setItem('projetosAnimacao', JSON.stringify([projetoAnimacao]));
    
    // Redirecionar para a página de animação
    window.location.href = 'animacao.html';
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

  document.getElementById('ano').textContent = new Date().getFullYear();
  carregarProjetos();
});