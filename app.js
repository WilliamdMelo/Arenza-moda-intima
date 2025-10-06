/**
 * @file app.js
 * @description Script principal para o e-commerce Arenza, com sistema de autenticação Supabase.
 * @version 2.0 (Atualizado para garantir carregamento seguro das configurações, fazendo teste de up in github)
 */

document.addEventListener('DOMContentLoaded', () => {

    // --------------------------------------------------
    // ---- 1. INICIALIZAÇÃO E VARIÁVEIS GLOBAIS
    // --------------------------------------------------
    let dbClient;
    let currentUser = null;
    let productsCache = [];
    const testimonials = [
        { quote: "As peças são ainda mais bonitas pessoalmente. Qualidade impecável e caimento perfeito!", author: "Juliana S." },
        { quote: "Recebi minha encomenda super rápido e amei a embalagem. Me senti especial. Recomendo!", author: "Fernanda L." },
        { quote: "Nunca me senti tão confiante. A Arenza entende o corpo feminino como ninguém. Virou minha marca preferida.", author: "Carla M." }
    ];

    // --------------------------------------------------
// ---- 2. CONFIGURAÇÃO E INICIALIZAÇÃO DO SUPABASE
// --------------------------------------------------
let ADMIN_EMAIL; 

// Função assíncrona para buscar as chaves da Netlify Function e iniciar o Supabase
async function initializeSupabase() {
    try {
        // Chama a nossa função segura no Netlify
        const response = await fetch('/.netlify/functions/get-config');
        if (!response.ok) {
            throw new Error('Falha ao buscar a configuração do servidor.');
        }
        const config = await response.json();

        if (!config.url || !config.anonKey) {
            throw new Error('As chaves do Supabase retornadas pelo servidor estão vazias.');
        }

        ADMIN_EMAIL = config.adminEmail;
        dbClient = supabase.createClient(config.url, config.anonKey);

        // Se a inicialização for bem-sucedida, inicie o resto da aplicação
        initializeApp();

    } catch (error) {
        console.error('Erro Crítico - Falha ao inicializar o Supabase:', error.message);
        alert(`ERRO: Não foi possível conectar ao banco de dados. Verifique o console para mais detalhes.`);
    }
}


    // --------------------------------------------------
    // ---- 3. SELETORES DO DOM
    // --------------------------------------------------
    const navAdminLink = document.getElementById('nav-admin-link');
    const navLoginLink = document.getElementById('nav-login-link');
    const navLogoutLink = document.getElementById('nav-logout-link');
    const header = document.getElementById('header');
    const productGrid = document.getElementById('product-grid');
    const adminPanelSection = document.getElementById('admin-panel');
    const testimonialCarousel = document.getElementById('testimonial-carousel');
    const editModal = document.getElementById('edit-modal');
    const authModal = document.getElementById('auth-modal');
    const productForm = document.getElementById('product-form');
    const editForm = document.getElementById('edit-product-form');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authErrorMessage = document.getElementById('auth-error');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const cancelEditBtn = document.getElementById('btn-cancel-edit');


    // --------------------------------------------------
    // ---- 4. LÓGICA DE AUTENTICAÇÃO
    // --------------------------------------------------
    async function listenToAuthStateChanges() {
        dbClient.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            updateUserInterface();
            fetchProducts(); // Recarrega produtos para mostrar/ocultar botões de admin
        });
    }

    async function signUpNewUser(email, password) {
        const { error } = await dbClient.auth.signUp({ email, password });
        if (error) {
            showAuthError(error.message);
            return;
        }
        alert('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
        closeAuthModal();
    }

    async function signInUser(email, password) {
        const { error } = await dbClient.auth.signInWithPassword({ email, password });
        if (error) {
            showAuthError('E-mail ou senha inválidos.');
            return;
        }
        closeAuthModal();
    }

    async function signOutUser() {
        const { error } = await dbClient.auth.signOut();
        if (error) {
            alert('Erro ao fazer logout: ' + error.message);
        }
    }

    // --------------------------------------------------
    // ---- 5. ATUALIZAÇÃO DA INTERFACE (UI)
    // --------------------------------------------------
    function updateUserInterface() {
        const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
        navLoginLink.classList.toggle('hidden', !!currentUser);
        navLogoutLink.classList.toggle('hidden', !currentUser);
        navAdminLink.classList.toggle('hidden', !isAdmin);
        adminPanelSection.classList.toggle('hidden', !isAdmin);
    }

    const createProductCard = (product) => {
        const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
        const adminActions = `
            <div class="card-actions">
                <button class="action-btn edit-btn" data-id="${product.id}" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
                </button>
                <button class="action-btn delete-btn" data-id="${product.id}" title="Excluir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>
                </button>
            </div>`;

        return `
            <div class="product-card fade-in">
                ${isAdmin ? adminActions : ''}
                <img src="${product.image}" alt="${product.name}">
                <div class="card-content">
                    <h3>${product.name}</h3>
                    <p class="price">R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}</p>
                    <p>${product.description}</p>
                </div>
            </div>`;
    };

    const renderProducts = () => {
        if (!productGrid) return;
        if (!productsCache || productsCache.length === 0) {
            productGrid.innerHTML = "<p>Nenhum produto encontrado.</p>";
            return;
        }
        productGrid.innerHTML = productsCache.map(createProductCard).join('');
        document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    };

    // --------------------------------------------------
    // ---- 6. FUNÇÕES DE DADOS (CRUD com Supabase)
    // --------------------------------------------------
    async function fetchProducts() {
        try {
            const { data, error } = await dbClient.from('products').select('*').order('id', { ascending: true });
            if (error) throw error;
            productsCache = data;
            renderProducts();
        } catch (error) {
            console.error('Erro ao buscar produtos:', error.message);
        }
    }

    async function addProduct(productData) {
        try {
            const { error } = await dbClient.from('products').insert([productData]);
            if (error) throw error;
            alert('Produto adicionado com sucesso!');
            productForm.reset();
            await fetchProducts();
        } catch (error) {
            console.error('Erro ao adicionar produto:', error.message);
            alert('Falha ao adicionar o produto.');
        }
    }

    async function updateProduct(productId, productData) {
        try {
            const { error } = await dbClient.from('products').update(productData).eq('id', productId);
            if (error) throw error;
            alert('Produto atualizado com sucesso!');
            closeEditModal();
            await fetchProducts();
        } catch (error) {
            console.error('Erro ao atualizar produto:', error.message);
            alert('Falha ao atualizar o produto.');
        }
    }

    async function deleteProduct(productId) {
        try {
            const { error } = await dbClient.from('products').delete().eq('id', productId);
            if (error) throw error;
            alert('Produto deletado com sucesso!');
            await fetchProducts();
        } catch (error) {
            console.error('Erro ao deletar produto:', error.message);
            alert('Falha ao deletar o produto.');
        }
    }

    // --------------------------------------------------
    // ---- 7. MODAIS E OUTROS COMPONENTES
    // --------------------------------------------------
    const openEditModal = (product) => {
        editModal.querySelector('#edit-product-id').value = product.id;
        editModal.querySelector('#edit-product-name').value = product.name;
        editModal.querySelector('#edit-product-price').value = product.price;
        editModal.querySelector('#edit-product-description').value = product.description;
        editModal.querySelector('#edit-product-image').value = product.image;
        editModal.classList.add('active');
    };
    const closeEditModal = () => editModal.classList.remove('active');

    const openAuthModal = () => authModal.classList.add('active');
    const closeAuthModal = () => authModal.classList.remove('active');
    const showAuthError = (message) => {
        authErrorMessage.textContent = message;
        authErrorMessage.classList.remove('hidden');
    };
    const hideAuthError = () => {
        authErrorMessage.textContent = '';
        authErrorMessage.classList.add('hidden');
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    let currentTestimonial = 0;
    const renderTestimonials = () => {
        if (!testimonialCarousel) return;
        testimonialCarousel.innerHTML = testimonials.map((t, index) => `
            <div class="testimonial-slide ${index === 0 ? 'active' : ''}">
                <blockquote>${t.quote}</blockquote>
                <footer>— ${t.author}</footer>
            </div>
        `).join('');
    };
    const nextTestimonial = () => {
        const slides = testimonialCarousel.querySelectorAll('.testimonial-slide');
        if (slides.length === 0) return;
        slides[currentTestimonial].classList.remove('active');
        currentTestimonial = (currentTestimonial + 1) % slides.length;
        slides[currentTestimonial].classList.add('active');
    };

    // --------------------------------------------------
    // ---- 8. "OUVINTES" DE EVENTOS (EVENT LISTENERS)
    // --------------------------------------------------
    navLoginLink.addEventListener('click', (e) => { e.preventDefault(); openAuthModal(); });
    navLogoutLink.addEventListener('click', (e) => { e.preventDefault(); signOutUser(); });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        hideAuthError();
        signInUser(loginForm.querySelector('#login-email').value, loginForm.querySelector('#login-password').value);
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        hideAuthError();
        signUpNewUser(signupForm.querySelector('#signup-email').value, signupForm.querySelector('#signup-password').value);
    });

    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addProduct({
            name: document.getElementById('product-name').value,
            price: document.getElementById('product-price').value,
            description: document.getElementById('product-description').value,
            image: document.getElementById('product-image').value
        });
    });

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = editForm.querySelector('#edit-product-id').value;
        updateProduct(id, {
            name: editForm.querySelector('#edit-product-name').value,
            price: editForm.querySelector('#edit-product-price').value,
            description: editForm.querySelector('#edit-product-description').value,
            image: editForm.querySelector('#edit-product-image').value,
        });
    });

    productGrid.addEventListener('click', (event) => {
        const btn = event.target.closest('.action-btn');
        if (!btn) return;
        const id = parseInt(btn.dataset.id);
        if (btn.classList.contains('delete-btn')) {
            if (confirm('Tem certeza que deseja excluir este produto?')) deleteProduct(id);
        } else if (btn.classList.contains('edit-btn')) {
            const productToEdit = productsCache.find(p => p.id === id);
            if (productToEdit) openEditModal(productToEdit);
        }
    });

    tabLinks.forEach(tab => {
        tab.addEventListener('click', () => {
            hideAuthError();
            tabLinks.forEach(item => item.classList.remove('active'));
            tabContents.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });
    cancelEditBtn.addEventListener('click', closeEditModal);

    window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 50));

    // --------------------------------------------------
// ---- 9. INICIALIZAÇÃO DA APLICAÇÃO
// --------------------------------------------------
function initializeApp() {
    // Esta função contém tudo o que precisa acontecer APÓS a conexão com o banco de dados
    renderTestimonials();
    setInterval(nextTestimonial, 5000);
    listenToAuthStateChanges();
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

});