 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
index 70824ebbf22622c300e9727b5b0e76e6277e1e55..7052a20cb407e73c5f80a1b53810656597cff16d 100644
--- a/app.js
+++ b/app.js
@@ -1,141 +1,290 @@
 /**
  * @file app.js
  * @description Script principal para o e-commerce Arenza, com sistema de autenticação Supabase.
  * @version 3.0 (Fluxo de inicialização corrigido para ambiente local e de produção)
  */
 
 document.addEventListener('DOMContentLoaded', () => {
 
     // --------------------------------------------------
     // ---- 1. SELETORES DO DOM E ESTADO INICIAL
     // --------------------------------------------------
     let dbClient;
     let currentUser = null;
     let productsCache = [];
     const testimonials = [
         { quote: "As peças são ainda mais bonitas pessoalmente. Qualidade impecável e caimento perfeito!", author: "Juliana S." },
         { quote: "Recebi minha encomenda super rápido e amei a embalagem. Me senti especial. Recomendo!", author: "Fernanda L." },
         { quote: "Nunca me senti tão confiante. A Arenza entende o corpo feminino como ninguém. Virou minha marca preferida.", author: "Carla M." }
     ];
     let ADMIN_EMAIL;
+    const VARIANT_FIELD_KEY = 'size_variants';
 
     // Seletores do DOM
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
+    const productVariantsInput = document.getElementById('product-variants');
+    const editVariantsInput = document.getElementById('edit-product-variants');
     const loginForm = document.getElementById('login-form');
     const signupForm = document.getElementById('signup-form');
     const authErrorMessage = document.getElementById('auth-error');
     const tabLinks = document.querySelectorAll('.tab-link');
     const tabContents = document.querySelectorAll('.tab-content');
     const cancelEditBtn = document.getElementById('btn-cancel-edit');
 
     // --------------------------------------------------
     // ---- 2. FUNÇÕES DE RENDERIZAÇÃO E UI
     // --------------------------------------------------
     const observer = new IntersectionObserver((entries) => {
         entries.forEach(entry => {
             if (entry.isIntersecting) entry.target.classList.add('visible');
         });
     }, { threshold: 0.1 });
 
+    const escapeHtml = (value) => {
+        return String(value)
+            .replace(/&/g, '&amp;')
+            .replace(/</g, '&lt;')
+            .replace(/>/g, '&gt;')
+            .replace(/"/g, '&quot;')
+            .replace(/'/g, '&#39;');
+    };
+
+    const normalizeVariantEntry = (entry) => {
+        if (!entry) return null;
+        const size = (entry.size || entry.tamanho || '').toString().trim();
+        if (!size) return null;
+        let prints = entry.prints || entry.estampas || entry.options || entry.value;
+        if (typeof prints === 'string') {
+            prints = prints.split(',');
+        }
+        if (!Array.isArray(prints)) {
+            prints = Object.values(prints || {});
+        }
+        const sanitizedPrints = prints
+            .map(print => (print ?? '').toString().trim())
+            .filter(Boolean);
+        if (sanitizedPrints.length === 0) return null;
+        return { size, prints: sanitizedPrints };
+    };
+
+    const parseVariantField = (raw) => {
+        if (!raw) return [];
+        if (Array.isArray(raw)) {
+            return raw.map(normalizeVariantEntry).filter(Boolean);
+        }
+        if (typeof raw === 'string') {
+            try {
+                const parsed = JSON.parse(raw);
+                return parseVariantField(parsed);
+            } catch (error) {
+                console.warn('Não foi possível interpretar as variantes (JSON inválido).');
+                return [];
+            }
+        }
+        if (typeof raw === 'object') {
+            if ('size' in raw || 'tamanho' in raw) {
+                const single = normalizeVariantEntry(raw);
+                return single ? [single] : [];
+            }
+            return Object.entries(raw)
+                .map(([size, prints]) => normalizeVariantEntry({ size, prints }))
+                .filter(Boolean);
+        }
+        return [];
+    };
+
+    const parseVariantTextareaInput = (value) => {
+        if (!value || !value.trim()) return [];
+        const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
+        const variants = [];
+        lines.forEach((line) => {
+            const [sizePart, printsPart] = line.split(':');
+            if (!printsPart) {
+                throw new Error(`Formato inválido na linha: "${line}". Use "Tamanho: Estampa 1, Estampa 2".`);
+            }
+            const size = sizePart.trim();
+            if (!size) {
+                throw new Error(`Informe o tamanho antes dos dois pontos na linha: "${line}".`);
+            }
+            const prints = printsPart.split(',').map(item => item.trim()).filter(Boolean);
+            if (prints.length === 0) {
+                throw new Error(`Adicione ao menos uma estampa para o tamanho "${size}".`);
+            }
+            variants.push({ size, prints });
+        });
+        return variants;
+    };
+
+    const formatVariantsForTextarea = (variants) => {
+        if (!variants || variants.length === 0) return '';
+        return variants.map(variant => `${variant.size}: ${variant.prints.join(', ')}`).join('\n');
+    };
+
+    const getProductVariants = (product) => {
+        if (!product) return [];
+        const raw = product[VARIANT_FIELD_KEY] || product.variants || product.variant_options;
+        return parseVariantField(raw);
+    };
+
+    const initializeVariantControls = () => {
+        if (!productGrid) return;
+        productGrid.querySelectorAll('.size-select').forEach((select) => {
+            const productId = parseInt(select.dataset.productId, 10);
+            if (Number.isNaN(productId)) return;
+            const product = productsCache.find(item => item.id === productId);
+            const variants = product?.variantOptions || [];
+            const printsContainer = productGrid.querySelector(`.print-options[data-product-id="${productId}"]`);
+            if (!printsContainer) return;
+
+            const renderPrints = (size) => {
+                const variant = variants.find(item => item.size === size);
+                if (!variant) {
+                    printsContainer.innerHTML = '<p class="print-empty">Estampas indisponíveis para este tamanho.</p>';
+                    return;
+                }
+                const badges = variant.prints
+                    .map(print => `<span class="print-badge">${escapeHtml(print)}</span>`)
+                    .join('');
+                printsContainer.innerHTML = `
+                    <p>Estampas disponíveis:</p>
+                    <div class="print-list">${badges}</div>
+                `;
+            };
+
+            select.addEventListener('change', (event) => {
+                renderPrints(event.target.value);
+            });
+
+            if (variants.length > 0) {
+                renderPrints(select.value);
+            } else {
+                printsContainer.innerHTML = '';
+            }
+        });
+    };
+
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
+        const variants = product.variantOptions || [];
+        const hasVariants = variants.length > 0;
+        const selectId = `size-select-${product.id}`;
+        const optionsMarkup = variants.map((variant, index) => {
+            const sizeLabel = escapeHtml(variant.size);
+            return `<option value="${sizeLabel}" ${index === 0 ? 'selected' : ''}>${sizeLabel}</option>`;
+        }).join('');
+        const variantMarkup = hasVariants ? `
+                <div class="card-variants">
+                    <div class="variant-selector">
+                        <label for="${selectId}">Selecione o tamanho</label>
+                        <select id="${selectId}" class="size-select" data-product-id="${product.id}">
+                            ${optionsMarkup}
+                        </select>
+                    </div>
+                    <div class="print-options" data-product-id="${product.id}"></div>
+                </div>` : '';
+
         return `
             <div class="product-card fade-in">
                 ${isAdmin ? adminActions : ''}
                 <img src="${product.image}" alt="${product.name}">
                 <div class="card-content">
                     <h3>${product.name}</h3>
                     <p class="price">R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}</p>
                     <p>${product.description}</p>
+                    ${variantMarkup}
                 </div>
             </div>`;
     };
 
     const renderProducts = () => {
         if (!productGrid) return;
         if (!productsCache || productsCache.length === 0) {
             productGrid.innerHTML = "<p>Nenhum produto encontrado na coleção.</p>";
             return;
         }
         productGrid.innerHTML = productsCache.map(createProductCard).join('');
         productGrid.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
+        initializeVariantControls();
     };
     
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
     // ---- 3. FUNÇÕES DE DADOS (CRUD e Auth)
     // --------------------------------------------------
     async function fetchProducts() {
         try {
             const { data, error } = await dbClient.from('products').select('*').order('id', { ascending: true });
             if (error) throw error;
-            productsCache = data;
+            productsCache = data.map(product => ({
+                ...product,
+                variantOptions: getProductVariants(product)
+            }));
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
@@ -171,85 +320,116 @@ document.addEventListener('DOMContentLoaded', () => {
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
     // ---- 4. MODAIS E EVENTOS
     // --------------------------------------------------
     const openEditModal = (product) => {
         editModal.querySelector('#edit-product-id').value = product.id;
         editModal.querySelector('#edit-product-name').value = product.name;
         editModal.querySelector('#edit-product-price').value = product.price;
         editModal.querySelector('#edit-product-description').value = product.description;
         editModal.querySelector('#edit-product-image').value = product.image;
+        if (editVariantsInput) {
+            editVariantsInput.value = formatVariantsForTextarea(product.variantOptions || []);
+        }
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
 
     function setupEventListeners() {
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
-            addProduct({ name: document.getElementById('product-name').value, price: document.getElementById('product-price').value, description: document.getElementById('product-description').value, image: document.getElementById('product-image').value });
+            let variantPayload = null;
+            try {
+                const variants = parseVariantTextareaInput(productVariantsInput?.value || '');
+                variantPayload = variants.length > 0 ? JSON.stringify(variants) : null;
+            } catch (error) {
+                alert(error.message);
+                return;
+            }
+            addProduct({
+                name: document.getElementById('product-name').value,
+                price: document.getElementById('product-price').value,
+                description: document.getElementById('product-description').value,
+                image: document.getElementById('product-image').value,
+                [VARIANT_FIELD_KEY]: variantPayload
+            });
         });
         editForm.addEventListener('submit', (e) => {
             e.preventDefault();
             const id = editForm.querySelector('#edit-product-id').value;
-            updateProduct(id, { name: editForm.querySelector('#edit-product-name').value, price: editForm.querySelector('#edit-product-price').value, description: editForm.querySelector('#edit-product-description').value, image: editForm.querySelector('#edit-product-image').value });
+            let variantPayload = null;
+            try {
+                const variants = parseVariantTextareaInput(editVariantsInput?.value || '');
+                variantPayload = variants.length > 0 ? JSON.stringify(variants) : null;
+            } catch (error) {
+                alert(error.message);
+                return;
+            }
+            updateProduct(id, {
+                name: editForm.querySelector('#edit-product-name').value,
+                price: editForm.querySelector('#edit-product-price').value,
+                description: editForm.querySelector('#edit-product-description').value,
+                image: editForm.querySelector('#edit-product-image').value,
+                [VARIANT_FIELD_KEY]: variantPayload
+            });
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
@@ -276,26 +456,26 @@ document.addEventListener('DOMContentLoaded', () => {
                 dbClient = supabase.createClient(config.url, config.anonKey);
             } catch (error) {
                 console.error('Erro Crítico - Falha ao inicializar o Supabase:', error.message);
                 alert(`ERRO: Não foi possível conectar ao banco de dados. Verifique o console.`);
                 return; // Encerra a execução se não conseguir conectar
             }
         }
 
         // --- Código que roda APÓS a conexão ser estabelecida com sucesso ---
         setupEventListeners();
         renderTestimonials();
         setInterval(nextTestimonial, 5000);
         
         // Ativa o listener de autenticação que, por sua vez, irá buscar os produtos
         dbClient.auth.onAuthStateChange((event, session) => {
             currentUser = session?.user || null;
             updateUserInterface();
             fetchProducts(); // Busca os produtos assim que o estado do usuário é conhecido
         });
         
         // Ativa as animações de fade-in para os elementos que já existem na página
         document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
     }
 
     main(); // Ponto de partida da aplicação
-});
\ No newline at end of file
+});
 
EOF
)