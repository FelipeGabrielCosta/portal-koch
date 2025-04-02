document.addEventListener('DOMContentLoaded', function () {
    const projetosAnimacao = JSON.parse(sessionStorage.getItem('projetosAnimacao'));
    
    if (!projetosAnimacao || projetosAnimacao.length === 0) {
        console.error('Nenhum projeto encontrado para animação');
        window.location.href = 'verProjetos.html';
        return;
    }

    const produtos = projetosAnimacao.reduce((acc, projeto) => {
        return acc.concat(projeto.produtos.map(prod => ({
            descricao: prod.descricao,
            imagem: prod.imagem,
            preco: prod.preco,
            unidade: prod.unidade || "UNID."
        })));
    }, []);

    function formatarPreco(preco) {
        let precoStr = typeof preco === 'string' ? preco : String(preco);
        precoStr = precoStr.replace(/[^\d,.]/g, '').replace(',', '.');
        const valor = parseFloat(precoStr);
        
        if (isNaN(valor)) {
            return { reais: '0', centavos: '00' };
        }
        
        const valorFormatado = valor.toFixed(2);
        const partes = valorFormatado.split('.');
        
        return {
            reais: partes[0],
            centavos: partes[1] || '00'
        };
    }

    let indiceProdutoAtual = 0;
    let intervaloAnimacao;
    let timelineAtual;

    function limparAnimacoes() {
        if (timelineAtual) {
            timelineAtual.kill();
        }
        gsap.globalTimeline.getChildren().forEach(anim => anim.kill());
    }

    function atualizarProdutoComAnimacao() {
        limparAnimacoes();
        
        const produto = produtos[indiceProdutoAtual];
        const precoFormatado = formatarPreco(produto.preco);
        const valorNumerico = parseInt(precoFormatado.reais);
        const posicaoX = valorNumerico < 10 ? -240 : -210;
        
        // Timeline principal com controle frame a frame
        timelineAtual = gsap.timeline({
            smoothChildTiming: true,
            onComplete: () => {
                indiceProdutoAtual = (indiceProdutoAtual + 1) % produtos.length;
            }
        });
    
        // FASE 1 - SAÍDA PERFEITA (0.5s exatos)
        const saida = gsap.timeline();
        saida.to(".product-description, .product-image, .product-image2, .star2, .price-elements", {
            duration: 0.5,
            opacity: 0,
            y: 30,
            ease: "power1.in",
            stagger: 0 // Zerado para sincronia absoluta
        }, 0);
    
        // Ponto exato de troca (50% da animação de saída)
        saida.add(() => {
            document.querySelector('.product-description').textContent = produto.descricao;
            document.querySelector('.product-image').src = produto.imagem;
            document.querySelector('.product-image2').src = produto.imagem;
            document.querySelector('.value').textContent = precoFormatado.reais;
            document.querySelector('.cents').textContent = `,${precoFormatado.centavos}`;
            document.querySelector('.unit').textContent = produto.unidade;
        }, 0.25);
    
        timelineAtual.add(saida);
    
        // FASE 2 - ENTRADA SINCRONIZADA AO PIXEL (0.75s)
        const entrada = gsap.timeline();
    
        // Grupo MESTRE (todos elementos principais)
        entrada.fromTo(
            ".product-description, .star2, .price-elements",
            {
                y: 20,
                opacity: 0,
                scale: 0.98
            },
            {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.75,
                ease: "back.out(1.4)",
                stagger: 0 // Sincronia absoluta
            },
            0
        );

        entrada.fromTo(
            ".product-image",
            {
                y: 20,
                x: 20,
                opacity: 0,
                scale: 0.98
            },
            {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.75,
                ease: "back.out(1.4)",
                stagger: 0 // Sincronia absoluta
            },
            0
        );

        entrada.fromTo(
            ".product-image2",
            {
                y: 35,
                x: -230,
                opacity: 0,
                scale: 0.98
            },
            {
                y: 15,
                opacity: 1,
                scale: 1,
                duration: 0.75,
                ease: "back.out(1.4)",
                stagger: 0 // Sincronia absoluta
            },
            0
        );


    
        // Elementos do preço com micro-ajustes
        entrada.fromTo(".currency",
            { x: posicaoX === -240 ? 60 : 105, y: posicaoX === -240 ? -120 : -130 },
            { x: posicaoX === -240 ? 65 : 100, duration: 0.5 },
            0.5
        );
        
        entrada.fromTo(".value",
            { y: 5, x: posicaoX === -240 ? 45 : 20},
            { y: 10, duration: 0.6 },
            0.5
        );
        
        entrada.fromTo(".cents",
            { y: posicaoX === -240 ? -65 : -65, x: posicaoX === -240 ? 60 : 25 },
            { 
                y: posicaoX === -240 ? -55 : -55,
                duration: 0.5,
            },
            0.6
        );

        entrada.fromTo(".unit",
            { y: -7, x: posicaoX === -240 ? -55 : -85 },
            { 
                y: 3,
                duration: 0.5,
                onComplete: function() {
                    gsap.to(".product-image", { y: "+=5", duration: 3, repeat: -1, yoyo: true });
                    gsap.to(".product-image2", { y: "+=8", duration: 3.5, repeat: -1, yoyo: true, delay: 0.3 });
                }
            },
            0.6
        );
    
        timelineAtual.add(entrada, 0.5); // Inicia imediatamente após a saída
    
        // Controle de tempo TOTAL (4s)
        timelineAtual.addPause(4); // Garante o tempo exato do ciclo
    }

    function iniciarAnimacao() {
        limparAnimacoes();
        
        // Animação inicial da estrela
        gsap.to(".star", {
            duration: 2.5,
            scale: 1.05,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });

        const initTl = gsap.timeline({
            onComplete: () => {
                // Inicia o ciclo com intervalo de 4s
                atualizarProdutoComAnimacao();
                intervaloAnimacao = setInterval(atualizarProdutoComAnimacao, 4000);
            }
        });

        initTl.to(".star-container", {
            duration: 0.8,
            scale: 1.15,
            ease: "elastic.out(1, 0.3)",
            yoyo: true,
            repeat: 1
        });

        initTl.to(".star-container", {
            duration: 1.2,
            x: "+=70%",
            y: "+=65%",
            scale: 0.35,
            ease: "back.out(1.7)"
        }, ">");

        initTl.to(".yellow-rectangle", {
            duration: 0.8,
            height: "80%",
            opacity: 1,
            ease: "elastic.out(1, 0.3)",
            onComplete: function() {
                const yellowRect = document.querySelector('.yellow-rectangle');
                const star2 = document.querySelector('.star2');
                document.documentElement.style.setProperty('--yellow-height', `${yellowRect.offsetHeight}px`);
                document.documentElement.style.setProperty('--star2-width', `${star2.offsetWidth}px`);
            }
        }, ">");
    }

    window.addEventListener('resize', function() {
        limparAnimacoes();
        if (intervaloAnimacao) clearInterval(intervaloAnimacao);
        
        const container = document.querySelector('.container');
        const starContainer = document.querySelector('.star-container');
        
        gsap.set(".star-container", {
            x: container.offsetWidth * 0.37,
            y: container.offsetHeight * 0.36,
            scale: 0.35
        });
        
        iniciarAnimacao();
    });

    iniciarAnimacao();

    window.addEventListener('beforeunload', function() {
        limparAnimacoes();
        clearInterval(intervaloAnimacao);
    });
});