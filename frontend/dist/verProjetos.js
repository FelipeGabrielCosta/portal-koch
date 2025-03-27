document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://portal-koch.onrender.com';

    const listaProjetos = document.getElementById('lista-projetos');
    const anoFooter = document.getElementById('ano');

    anoFooter.textContent = new Date().getFullYear();

    async function carregarProjetos() {
        try {
            const response = await fetch(`${API_URL}/api/projetos`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const { data: projetos } = await response.json();
            
            listaProjetos.innerHTML = '';
            
            if (!projetos || Object.keys(projetos).length === 0) {
                listaProjetos.innerHTML = '<p class="no-projects">Nenhum projeto encontrado.</p>';
                return;
            }
            
            for (const [nome, dados] of Object.entries(projetos)) {
                const projetoElement = criarProjetoElement(nome, dados);
                listaProjetos.appendChild(projetoElement);
            }
            
        } catch (error) {
            console.error('Erro ao carregar projetos:', error);
            listaProjetos.innerHTML = `
                <p class="error">
                    Erro ao carregar projetos: ${error.message}
                    <button onclick="window.location.reload()">Tentar novamente</button>
                </p>
            `;
        }
    }

    function criarProjetoElement(nome, dados) {
        const projetoDiv = document.createElement('div');
        projetoDiv.className = 'projeto-card';
        
        projetoDiv.innerHTML = `
            <h2>${nome}</h2>
            <p class="project-date">Criado em: ${new Date(dados.data).toLocaleString()}</p>
            
            <div class="project-section">
                <h3>Produtos</h3>
                <div class="product-grid">
                    ${dados.produtos?.map((prod, i) => `
                        <div class="product-card">
                            ${dados.imagens[i] ? `<img src="${API_URL}${dados.imagens[i]}" alt="Imagem do produto" class="product-image">` : ''}
                            <div class="product-details">
                                <p class="product-description">${prod.descricao}</p>
                                <p class="product-price">${prod.preco}</p>
                            </div>
                        </div>
                    `).join('') || '<p>Nenhum produto disponível</p>'}
                </div>
            </div>
        `;
        
        return projetoDiv;
    }

    carregarProjetos();
});