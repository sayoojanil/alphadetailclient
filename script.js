(function () {
  'use strict';


  const API_BASE = (window.ENV && window.ENV.API_BASE);



  // ══ LOADER HELPERS ══
  window.toggleLoader = (show, text) => {
    const l = document.getElementById('loader');
    if (l) {
      if (show) l.classList.remove('hide');
      else l.classList.add('hide');
    }
  };

  window.addEventListener('load', function () {
    setTimeout(function () {
      toggleLoader(false);
    }, 2200);
  });

  // ══ HEADER SCROLL ══
  window.addEventListener('scroll', () => {
    const h = document.querySelector('header');
    if (h) {
      if (window.scrollY > 50) h.classList.add('scrolled');
      else h.classList.remove('scrolled');
    }
  });

  // ══ STATE ══
  let cart = JSON.parse(localStorage.getItem('alphaCart') || '[]');
  let currentUser = null, redirectAfterAuth = null;
  let PRODS = [];
  let KITS = { starter: null, pro: null };
  let filteredProds = [];
  let cartBundleDiscount = 0;
  let cartBundleLabel = '';
  let couponDiscountRate = 0;
  const PRO_BUNDLE_ITEMS = []; // No longer needed, using PRODS dynamically
  const BUSINESS_PHONE = '917025225245'; // Centralized business phone number

  // ══ API HELPERS ══
  async function apiReq(path, opt = {}) {
    if (currentUser && currentUser.token) {
      opt.headers = { ...opt.headers, 'Authorization': `Bearer ${currentUser.token}` };
    }
    try {
      const res = await fetch(API_BASE + path, opt);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Request failed');
        err.data = data;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.data && err.data.retryAfter) {
        // Don't toast here, handle in caller for specific UI
      } else {
        toast(err.message || 'Network error', { type: 'error' });
      }
      throw err;
    }
  }

  async function fetchProducts() {
    const loaderHTML = '<div class="grid-loader"><div class="spinner"></div><div class="spinner-text">Updating Collection</div></div>';
    const hg = document.getElementById('homeFeatured'), sg = document.getElementById('shopGrid');
    if (hg) hg.innerHTML = loaderHTML;
    if (sg) sg.innerHTML = loaderHTML;

    try {
      const list = await apiReq('/products');
      if (list && list.length > 0) {
        PRODS = list;
        filteredProds = [...PRODS];
        updateFilterCounts();
        renderFeatured();
        renderShop(filteredProds);
      } else {
        const emptyHTML = `<div class="grid-loader"><div class="spinner-text" style="color:var(--muted);"> No products found in the database.</div></div>`;
        if (hg) hg.innerHTML = emptyHTML;
        if (sg) sg.innerHTML = emptyHTML;
      }
    } catch (e) {
      const errorHTML = `<div class="grid-loader"><div class="spinner-text" style="color:var(--red);"> Collection unavailable. Check back soon.</div></div>`;
      if (hg) hg.innerHTML = errorHTML;
      if (sg) sg.innerHTML = errorHTML;
      console.error('Failed to sync products from server');
    }
  }

  // ══ FETCH & RENDER BUNDLE KITS FROM BACKEND ══
  function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  async function fetchKits() {
    try {
      const data = await apiReq('/products/kits');
      if (!data || !data.starter || !data.pro) return;
      KITS = data;

      // ── Render Starter Kit ──
      const sName = document.getElementById('starterKitName');
      const sTagline = document.getElementById('starterKitTagline');
      const sItems = document.getElementById('starterKitItems');
      const sOriginal = document.getElementById('starterKitOriginal');
      const sDiscTag = document.getElementById('starterKitDiscTag');
      const sPrice = document.getElementById('starterKitPrice');
      const sSave = document.getElementById('starterKitSave');

      if (sName) sName.textContent = data.starter.name;
      if (sTagline) sTagline.textContent = data.starter.tagline;
      if (sItems) {
        sItems.innerHTML = data.starter.items.map(item =>
          `<li>${item.name} — ${item.sub} · ${item.ml} <span class="kit-item-price">${fmt(item.price)}</span></li>`
        ).join('');
      }
      if (sOriginal) sOriginal.textContent = fmt(data.starter.subtotal);
      if (sDiscTag) sDiscTag.textContent = data.starter.discountTag;
      if (sPrice) sPrice.textContent = fmt(data.starter.total);
      if (sSave) sSave.textContent = `You save ${fmt(data.starter.discount)} automatically`;

      // ── Render Pro Kit ──
      const pName = document.getElementById('proKitName');
      const pTagline = document.getElementById('proKitTagline');
      const pItems = document.getElementById('proKitItems');
      const pOriginal = document.getElementById('proKitOriginal');
      const pDiscTag = document.getElementById('proKitDiscTag');
      const pPrice = document.getElementById('proKitPrice');
      const pSave = document.getElementById('proKitSave');

      if (pName) pName.textContent = data.pro.name;
      if (pTagline) pTagline.textContent = data.pro.tagline;
      if (pItems) {
        pItems.innerHTML = data.pro.items.map(item =>
          `<li>${item.name} — ${item.sub} · ${item.ml} <span class="kit-item-price">${fmt(item.price)}</span></li>`
        ).join('');
      }
      if (pOriginal) pOriginal.textContent = fmt(data.pro.subtotal);
      if (pDiscTag) pDiscTag.textContent = data.pro.discountTag;
      if (pPrice) pPrice.textContent = fmt(data.pro.total);
      if (pSave) pSave.textContent = `You save ${fmt(data.pro.discount)} automatically`;

    } catch (e) {
      console.error('Failed to fetch kit data from server', e);
    }
  }

  function updateFilterCounts() {
    const tabs = document.querySelectorAll('.ftab');
    tabs.forEach(tab => {
      const onclick = tab.getAttribute('onclick');
      if (!onclick) return;
      const cat = onclick.match(/'([^']+)'/)[1];
      const count = cat === 'all' ? PRODS.length : PRODS.filter(p => p.cat === cat).length;

      // Update text node while preserving child elements if any
      let label = cat === 'all' ? 'All' : (cat.charAt(0).toUpperCase() + cat.slice(1).replace('tyre', 'Tyre & Trim'));
      if (cat === 'tyre') label = 'Tyre & Trim';
      tab.textContent = `${label} (${count})`;
    });
  }
  window.togglePassword = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn ? btn.querySelector("i") : null;

    if (input.type === "password") {
      input.type = "text";
      if (icon) {
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      }
    } else {
      input.type = "password";
      if (icon) {
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    }
  };
  // ══ IMAGE HELPERS ══
  function makeImgHTML(prodId, alt, style) {
    const p = PRODS.find(x => x.id === prodId);
    if (p && p.imgs && p.imgs.length > 0) {
      return `<img src="${p.imgs[0]}" alt="${alt}" style="${style || 'width:100%;height:100%;object-fit:cover;'}">`;
    }
    const bg = p ? p.grad : '#1a1a1a';
    return `<div style="width:100%;height:100%;background:${bg};display:flex;align-items:center;justify-content:center;"><span style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.1);">${alt}</span></div>`;
  }

  // ══ PAGE ROUTING ══
  window.showPage = function (id, pushHash = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
   const pg =
    document.getElementById("page-" + id) ||
    document.getElementById(id);

if (!pg) {
    console.error("Page not found:", id);
    return;
}
    
    pg.classList.add('active'); 
    window.scrollTo(0, 0);
    
    if (pushHash) {
      window.location.hash = id;
    }

    document.querySelectorAll('.nav-item[data-pg]').forEach(n => n.classList.remove('act'));
    const an = document.querySelector(`.nav-item[data-pg="${id}"]`);
    if (an) an.classList.add('act');
    
    if (id === 'shop') renderShop(filteredProds);
    if (id === 'cart') renderCart();
    if (id === 'checkout') initCheckout();
    if (id === 'home') renderFeatured();
    if (id === 'profile') renderProfile();

    setTimeout(() => {
      pg.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach(el => el.classList.add('visible'));
      observeReveal();
    }, 50);
  };

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.substring(1);
    if (h) showPage(h, false);
  });

  window.toggleMob = () => {
    const isOpen = document.getElementById('mobMenu').classList.toggle('open');
    document.querySelector('.hamburger').classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };
  window.closeMob = () => {
    document.getElementById('mobMenu').classList.remove('open');
    document.querySelector('.hamburger').classList.remove('open');
    document.body.style.overflow = '';
  };

  // ══ RENDER FEATURED ══
  function renderFeatured() {
    const el = document.getElementById('homeFeatured');
    if (!el || PRODS.length === 0) return;
    const feat = PRODS.slice(0, 4);
    el.innerHTML = feat.map(p => `
    <div class="hf-card reveal" onclick="openPD('${p.id}')">
      <div class="hf-img">${makeImgHTML(p.id, p.name, 'width:100%;height:100%;object-fit:cover;transition:transform .6s;')}<div class="hf-ov"></div></div>
      <div class="hf-body"><div class="hf-code">${p.code}</div><div class="hf-name">${p.name}</div><div class="pc-sub">${p.sub}</div><div class="hf-price">₹${p.price.toLocaleString('en-IN')}</div></div>
    </div>`).join('');

    // 4th column View All card - rendered for mobile view (matching reference image)
    el.insertAdjacentHTML('beforeend', `
      <div class="hf-view-all reveal" onclick="showPage('shop')">
        <svg class="hf-va-top-svg" viewBox="0 0 300 140" preserveAspectRatio="none">
          <defs>
            <pattern id="hfVaStripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.035)" stroke-width="2" />
            </pattern>
            <linearGradient id="hfVaGoldLine" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#b38f2a" />
              <stop offset="50%" stop-color="#f4d03f" />
              <stop offset="100%" stop-color="#d4af37" />
            </linearGradient>
          </defs>
          <polygon points="0,0 300,0 300,18 0,105" fill="url(#hfVaStripes)" />
          <line x1="0" y1="105" x2="300" y2="18" stroke="url(#hfVaGoldLine)" stroke-width="2.5" />
        </svg>

        <div class="hf-va-icon-wrap">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#d4af37" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </div>

        <div class="hf-va-content">
          <div class="hf-va-eyebrow">EXPLORE MORE</div>
          <h3 class="hf-va-main-title">VIEW ALL</h3>
          <p class="hf-va-desc">DISCOVER OUR FULL<br>PRODUCT RANGE</p>
        </div>

        <div class="hf-va-gold-banner">
          <span>VIEW ALL &rarr;</span>
        </div>
      </div>
    `);
    observeReveal();
  }

  // ══ RENDER SHOP ══
  function renderShop(list) {
    const g = document.getElementById('shopGrid');
    if (!g) return;
    if (list.length === 0) {
      g.innerHTML = `
      <div class="grid-loader" style="padding: 80px 0; grid-column: 1/-1;">
        <div class="ce-icon" style="font-size: 40px; margin-bottom: 15px;"><i class="fa-solid fa-magnifying-glass"></i></div>
        <div class="ce-title" style="font-size: 20px; color: var(--muted); letter-spacing: 2px;">No Products Found</div>
        <div style="font-size: 12px; color: #555; margin-bottom: 20px;">Try adjusting your filters or search criteria.</div>
        <button class="btn-o" onclick="filterP('all', document.querySelector('.ftab'))">Clear All Filters</button>
      </div>`;
      return;
    }
    g.innerHTML = list.map(p => `
    <div class="pcard reveal">
      <div class="pc-img" onclick="openPD('${p.id}')" style="background:${p.grad || '#1a1a1a'};">
        ${makeImgHTML(p.id, p.name, 'width:100%;height:100%;object-fit:cover;transition:transform .6s,filter .4s;')}
        <div class="pc-ov"></div>
        <div class="pc-badge ${p.inStock !== false ? 'badge-in-stock' : 'badge-out-stock'}">
          <span class="badge-dot"></span>
          ${p.inStock !== false ? 'In Stock' : 'Out of Stock'}
          <span style="opacity:0.5; font-weight:normal; letter-spacing:0; margin-left:4px;">· 473ml</span>
        </div>
        <button class="pc-qv" onclick="event.stopPropagation();openPD('${p.id}')">Quick View</button>
      </div>
      <div class="pc-body">
        <div class="pc-code">${p.code || ''}</div>
        <div class="pc-name" onclick="openPD('${p.id}')">${p.name}</div>
        <div class="pc-sub">${p.sub || ''}</div>
        <div class="pc-ml">473ml</div>
        <p class="pc-hook">"${p.hook || ''}"</p>
        <div class="pc-bot">
          <div><div class="pc-mrp">MRP</div><div class="pc-price">₹${(p.price || 0).toLocaleString('en-IN')}</div></div>
        </div>
        <div class="pc-tags">${(p.tags || []).map((t, i) => `<span class="tag${i < 1 ? ' tag-g' : ''}">${t}</span>`).join('')}</div>
          <button class="pc-atc" ${p.inStock === false ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="addToCart('${p.id}')">${p.inStock === false ? 'Sold Out' : '+ Add to Cart'}</button>
      </div>
      
    </div>`).join('');

    // Re-observe for reveal animations
    observeReveal();
  }

  // ══ FILTER & SORT ══
  window.filterP = function (cat, btn) {
    document.querySelectorAll('.ftab').forEach(t => t.classList.remove('act'));
    btn.classList.add('act');
    filteredProds = cat === 'all' ? [...PRODS] : PRODS.filter(p => p.cat === cat);
    renderShop(filteredProds);
  };
  window.sortP = function (val) {
    let list = [...filteredProds];
    if (val === 'low') list.sort((a, b) => a.price - b.price);
    if (val === 'high') list.sort((a, b) => b.price - a.price);
    renderShop(list);
  };

  // ══ PRODUCT DETAIL MODAL ══
  window.openPD = function (id) {
    const p = PRODS.find(x => x.id === id);
    if (!p) return;
    document.getElementById('pdCode').textContent = p.code || 'Series AL-S1';
    document.getElementById('pdName').textContent = p.name;
    document.getElementById('pdSub').textContent = p.sub || '';
    document.getElementById('pdHook').textContent = p.hook ? '"' + p.hook + '"' : '';
    document.getElementById('pdDesc').innerHTML = p.desc || '';
    document.getElementById('pdAdv').innerHTML = p.advantage || 'Performance details coming soon.';
    document.getElementById('pdPrice').textContent = '₹' + p.price.toLocaleString('en-IN');

    if (p.inStock === false) {
      document.getElementById('pdPrice').innerHTML += '<span class="badge-out-stock" style="margin-left: 14px; font-size: 13px;"><span class="badge-dot"></span>Out of Stock</span>';
    }

    // Key Benefits (Features)
    document.getElementById('pdFeats').innerHTML = (p.feats || []).map(f => {
      const html = f.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      return `<li><i class="fa-solid fa-minus" style="color:var(--gold); font-size:10px; margin-right:12px; opacity:0.5;"></i> ${html}</li>`;
    }).join('');

    // Tags
    document.getElementById('pdTags').innerHTML = (p.tags || []).map(t => `<div class="pd-tag">${t}</div>`).join('');

    const mw = document.getElementById('pdMainWrap');
    mw.innerHTML = makeImgHTML(p.id, p.name);

    const pdQtyInput = document.getElementById('pdQtyInput');
    if (pdQtyInput) pdQtyInput.value = 1;

    const addBtn = document.getElementById('pdAddBtn');
    if (p.inStock === false) {
      addBtn.textContent = 'Sold Out';
      addBtn.style.opacity = '0.5';
      addBtn.style.cursor = 'not-allowed';
      addBtn.onclick = null;
    } else {
      addBtn.textContent = 'Add to Cart';
      addBtn.style.opacity = '1';
      addBtn.style.cursor = 'pointer';
      addBtn.onclick = () => {
        const qtyVal = parseInt(document.getElementById('pdQtyInput')?.value, 10) || 1;
        addToCart(p.id, qtyVal);
      };
    }

    document.getElementById('pdUsage').innerHTML = (p.howToUse && p.howToUse.length > 0) ?
      `<div class="usage-steps">${p.howToUse.map((s, i) => `<div class="usage-step"><div class="us-num">STEP ${i + 1}</div><div class="us-text">${s}</div></div>`).join('')}</div>` :
      '<p>Detailed instructions coming soon.</p>';

    showPage('product');
  };

  window.changePdQty = function (delta) {
    const input = document.getElementById('pdQtyInput');
    if (!input) return;
    let current = parseInt(input.value, 10) || 1;
    current = Math.max(1, current + delta);
    input.value = current;
  };

  // ══ CART ══
  window.addToCart = function (id, qtyToAdd = 1) {
    const p = PRODS.find(x => x.id === id);
    if (!p) return;
    if (p.inStock === false) {
      return toast(p.name + ' is Out of Stock', { type: 'error', icon: 'fa-solid fa-circle-xmark' });
    }
    const quantity = Math.max(1, parseInt(qtyToAdd, 10) || 1);
    const ex = cart.find(c => c.id === id);
    if (ex) {
      ex.qty += quantity;
    } else {
      cart.push({ id: p.id, name: p.name, sub: p.sub, price: p.price, img: p.id, qty: quantity });
    }
    updateBadge();
    const msg = quantity > 1 ? `${quantity}x ${p.name} added to cart` : `${p.name} added to cart`;
    toast(msg, {
      type: 'success', icon: 'fa-solid fa-circle-check',
      action: { label: 'View Cart →', onClick: "showPage('cart')" }
    });
  };

  window.clearCart = function () {
    cart = [];
    localStorage.removeItem('alphaCart');
    cartBundleDiscount = 0;
    cartBundleLabel = '';
    couponDiscountRate = 0;
    updateBadge();
    const cba = document.getElementById('cartBundleActive');
    if (cba) cba.remove();
  };

  window.addBundleToCart = function (type) {
    let bundleItems = [];
    if (type === 'starter') {
      // Use fetched kit data if available, fall back to static IDs
      bundleItems = KITS.starter ? KITS.starter.items.map(i => i.id) : ['nano', 'gleam', 'cabin', 'surface'];
      cartBundleDiscount = KITS.starter ? KITS.starter.discountRate : 0.05;
      cartBundleLabel = KITS.starter ? KITS.starter.discountLabel : 'Starter Kit Discount (5%)';
    } else if (type === 'pro') {
      bundleItems = KITS.pro ? KITS.pro.items.map(i => i.id) : PRODS.map(p => p.id);
      cartBundleDiscount = KITS.pro ? KITS.pro.discountRate : 0.10;
      cartBundleLabel = KITS.pro ? KITS.pro.discountLabel : 'Pro Kit Discount (10%)';
    }

    for (const id of bundleItems) {
      const p = PRODS.find(x => x.id === id);
      if (!p) {
        return toast(`Error: Product "${id}" not found in our collection. Please contact support.`, { type: 'error' });
      }
      if (p.inStock === false) {
        return toast(`Sorry, "${p.name}" is currently Out of Stock, so the bundle cannot be added.`, { type: 'error' });
      }
    }

    bundleItems.forEach(id => {
      const p = PRODS.find(x => x.id === id);
      if (p) {
        const ex = cart.find(c => c.id === id);
        if (ex) ex.qty++;
        else cart.push({ id: p.id, name: p.name, sub: p.sub, price: p.price, img: p.id, qty: 1 });
      }
    });
    updateBadge();
    toast(`${type.toUpperCase()} Kit added to cart!`, { type: 'success', icon: 'fa-solid fa-plus-minus' });
    showPage('cart');
  };

  function updateBadge() {
    localStorage.setItem('alphaCart', JSON.stringify(cart));
    const count = cart.reduce((s, c) => s + c.qty, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) badge.textContent = count;
    const mBadge = document.getElementById('mobCartBadge');
    if (mBadge) mBadge.textContent = count;
    if (currentUser) syncCart();
  }

  async function syncCart() {
    try {
      await apiReq('/users/me/cart', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart })
      });
    } catch (e) { }
  }
  function getSubtotal() { return cart.reduce((s, c) => s + c.price * c.qty, 0); }
  function getCouponDiscount() { return getSubtotal() * couponDiscountRate; }
  function getBundleDiscount() { return getSubtotal() * cartBundleDiscount; }
  function isProKitCart() {
    if (PRODS.length === 0) return false;
    return PRODS.every(p => cart.some(c => c.id === p.id));
  }
  const STARTER_IDS = ['nano', 'gleam', 'cabin', 'surface']; // fallback if KITS not loaded
  function getStarterIds() { return KITS.starter ? KITS.starter.items.map(i => i.id) : STARTER_IDS; }
  function isStarterKitCart() {
    return getStarterIds().every(id => cart.some(c => c.id === id)) && !isProKitCart();
  }
function getShipping() {
  return 0;
}
  
  window.removeProKit = function() {
    const proIds = PRODS.map(p => p.id);
    cart = cart.filter(c => !proIds.includes(c.id));
    updateBadge(); renderCart();
    toast('Alpha Pro Kit removed', { type: 'info' });
  };
  window.removeStarterKit = function() {
    cart = cart.filter(c => !getStarterIds().includes(c.id));
    updateBadge(); renderCart();
    toast('Alpha Starter Kit removed', { type: 'info' });
  };
  function getFinalTotal() {
    const sub = getSubtotal();
    const disc = getCouponDiscount() + getBundleDiscount();
    const ship = getShipping();
    return sub - disc + ship;
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    const empty = document.getElementById('cartEmpty');
    if (!list) return;
    if (cart.length === 0) {
      list.innerHTML = ''; empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      const isPro = isProKitCart();
      const isStart = isStarterKitCart();
      
      let cartHtml = '';
      if (isPro) {
        cartHtml += `
        <div class="cart-bundle-active">
          <div class="cba-info">
            <span class="cba-icon"><i class="fa-solid fa-box-open"></i></span>
            <div>
              <div class="cba-title">Alpha Pro Kit Bundle Active</div>
              <div class="cba-text">Individual kit items are locked. Remove the full kit to modify.</div>
            </div>
          </div>
          <button class="cba-remove-btn" onclick="removeProKit()">Remove Full Kit <i class="fa-solid fa-trash-can"></i></button>
        </div>`;
      } else if (isStart) {
        cartHtml += `
        <div class="cart-bundle-active" style="border-bottom-color:var(--white);">
          <div class="cba-info">
            <span class="cba-icon" style="color:var(--white); border-color:rgba(255,255,255,0.2);"><i class="fa-solid fa-kit-medical"></i></span>
            <div>
              <div class="cba-title" style="color:var(--white);">Alpha Starter Kit Active</div>
              <div class="cba-text">Bundle protection enabled for starter items.</div>
            </div>
          </div>
          <button class="cba-remove-btn" onclick="removeStarterKit()">Remove Starter Kit <i class="fa-solid fa-trash-can"></i></button>
        </div>`;
      }

      cartHtml += cart.map(c => {
        const isInPro = isPro && PRODS.some(p => p.id === c.id);
        const isInStart = isStart && STARTER_IDS.includes(c.id);
        const locked = isInPro || isInStart;

        return `
        <div class="cart-row ${locked ? 'cart-row-locked' : ''}">
          <div class="ci-prod"><div class="ci-img-ph">${makeImgHTML(c.id, '')}</div><div><div class="ci-name">${c.name}</div><div class="ci-sub">${c.sub}</div></div></div>
          <div class="ci-pval">₹${c.price.toLocaleString('en-IN')}</div>
          <div>
            <div class="qty-ctrl ${locked ? 'locked' : ''}">
              <button class="qty-b" onclick="changeQty('${c.id}',-1)" ${locked ? 'disabled' : ''}>−</button>
              <input class="qty-n" value="${c.qty}" readonly>
              <button class="qty-b" onclick="changeQty('${c.id}',1)" ${locked ? 'disabled' : ''}>+</button>
            </div>
          </div>
          <div class="ci-tval">₹${(c.price * c.qty).toLocaleString('en-IN')}</div>
          <div class="ci-remove">
            ${locked ? 
              `<span class="item-locked" title="Bundle Item Locked"><i class="fa-solid fa-lock"></i></span>` : 
              `<button class="rm-btn" onclick="removeFromCart('${c.id}')"><i class="fa-solid fa-trash-can"></i></button>`
            }
          </div>
        </div>`;
      }).join('');
      
      list.innerHTML = cartHtml;
    }
    const sub = getSubtotal(), total = getFinalTotal(), ship = getShipping();
    const bd = getBundleDiscount(), cd = getCouponDiscount();
    const td = bd + cd;

    document.getElementById('sumSub').textContent = '₹' + sub.toLocaleString('en-IN');
    document.getElementById('sumShip').textContent = ship === 0 ? 'FREE' : '₹' + ship;

    const sdr = document.getElementById('sumDiscRow');
    if (td > 0) {
      sdr.classList.add('show');
      document.getElementById('sumDisc').textContent = '-₹' + Math.round(td).toLocaleString('en-IN');
      document.getElementById('sumDiscLabel').textContent = (cd > 0 && bd > 0) ? 'Total Discounts' : (cd > 0 ? 'Coupon Discount' : cartBundleLabel);
    } else {
      sdr.classList.remove('show');
    }

    document.getElementById('sumTotal').textContent = '₹' + Math.round(total).toLocaleString('en-IN');
  }

  window.changeQty = (id, delta) => {
    const item = cart.find(c => c.id === id);
    if (item) {
      if (item.qty === 1 && delta === -1) {
        return removeFromCart(id);
      }
      const p = PRODS.find(x => x.id === id);
      if (delta > 0 && p && p.inStock === false) {
        return toast('Item is now out of stock', { type: 'error' });
      }
      item.qty = Math.max(1, item.qty + delta);
      updateBadge(); renderCart();
    }
  };

  window.removeFromCart = (id) => {
    cart = cart.filter(c => c.id !== id);
    updateBadge();
    renderCart();
    toast('Item removed from cart', { type: 'info', icon: 'fa-solid fa-trash-can' });
  };

  window.applyCoupon = function () {
    const code = document.getElementById('coupInp').value.toUpperCase();
    if (code === 'ALPHA10') {
      couponDiscountRate = 0.10;
      toast('Coupon applied: 10% OFF', { type: 'success', icon: 'fa-solid fa-ticket' });
      renderCart();
    } else {
      couponDiscountRate = 0;
      toast('Invalid coupon code', { type: 'error', icon: 'fa-solid fa-circle-xmark' });
      renderCart();
    }
  };

  // ══ AUTH ══
  window.doLogin = async function () {
    const email = document.getElementById('lEmail').value.trim();
    const password = document.getElementById('lPass').value;
    const btn = document.getElementById('loginBtn');
    const ogText = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...'; btn.disabled = true; }

    try {
      const data = await apiReq('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      currentUser = data;
      localStorage.setItem('alphaUser', JSON.stringify(data));
      // Merge cart on login
      if (data.cart && data.cart.length > 0) {
        data.cart.forEach(dbItem => {
          const ex = cart.find(c => c.id === dbItem.id);
          if (ex) ex.qty = Math.max(ex.qty, dbItem.qty);
          else cart.push(dbItem);
        });
      }
      updateBadge();
      updateNavUser();
      toast('Welcome back, ' + data.firstName + '!', { type: 'success' });
      if (btn) { btn.innerHTML = ogText; btn.disabled = false; }
      showPage(redirectAfterAuth || 'home');
    } catch (e) {
      if (e.data && e.data.retryAfter) {
        let remaining = Math.ceil(e.data.retryAfter / 1000);
        toast(e.data.error, { type: 'error' });

        const updateBtn = () => {
          if (remaining <= 0) {
            if (btn) { btn.innerHTML = ogText; btn.disabled = false; }
            return;
          }
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          if (btn) btn.innerHTML = `<i class="fa-solid fa-clock"></i> Try in ${m}m ${s}s`;
          remaining--;
          setTimeout(updateBtn, 1000);
        };
        updateBtn();
      } else {
        if (btn) { btn.innerHTML = ogText; btn.disabled = false; }
        const errEl = document.getElementById('loginErr');
        if (errEl) {
          errEl.textContent = e.message;
          errEl.classList.add('show');
          setTimeout(() => errEl.classList.remove('show'), 5000);
        }
      }
    }
  };

  window.doRegister = async function () {
    const firstName = document.getElementById('rFirst').value.trim();
    const lastName = document.getElementById('rLast').value.trim();
    const email = document.getElementById('rEmail').value.trim();
    const phone = document.getElementById('rPhone').value.trim();
    const password = document.getElementById('rPass').value;
    const btn = document.getElementById('regBtn');
    const ogText = btn ? btn.innerHTML : '';
    
    // Reset errors
    document.querySelectorAll('#page-register .fe').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#page-register .fi').forEach(e => e.classList.remove('error'));

    let isValid = true;
    if (firstName.length < 2) {
      const err = document.getElementById('rFirstE');
      if(err) { err.textContent = "Min 2 chars required"; err.classList.add('show'); }
      document.getElementById('rFirst').classList.add('error');
      isValid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = document.getElementById('rEmailE');
      if(err) { err.textContent = "Valid email required"; err.classList.add('show'); }
      document.getElementById('rEmail').classList.add('error');
      isValid = false;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      const err = document.getElementById('rPhoneE');
      if(err) { err.textContent = "Exactly 10 digits required"; err.classList.add('show'); }
      document.getElementById('rPhone').classList.add('error');
      isValid = false;
    }
    if (password.length < 6) {
      const err = document.getElementById('rPassE');
      if(err) { err.textContent = "Min 6 characters required"; err.classList.add('show'); }
      document.getElementById('rPass').classList.add('error');
      isValid = false;
    }
    if (password !== document.getElementById('rConf').value) {
      const err = document.getElementById('rConfE');
      if(err) { err.textContent = "Passwords do not match"; err.classList.add('show'); }
      document.getElementById('rConf').classList.add('error');
      isValid = false;
    }
    if (!document.getElementById('rTerms').checked) {
      const err = document.getElementById('rTermsE');
      if(err) err.classList.add('show');
      isValid = false;
    }

    if (!isValid) return toast('Please check the registration form', { type: 'error' });

    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...'; btn.disabled = true; }

    try {
      const data = await apiReq('/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone: phoneDigits, password })
      });
      currentUser = data;
      localStorage.setItem('alphaUser', JSON.stringify(data));
      updateBadge(); // Sync local cart to new account
      updateNavUser();
      toast('Welcome, ' + firstName + '! Account created', { type: 'success' });
      showPage('home');
    } catch (e) {
      // Error is already toasted by apiReq
    } finally {
      if (btn) { btn.innerHTML = ogText; btn.disabled = false; }
    }
  };

  window.doLogout = function () {
    currentUser = null;
    localStorage.removeItem('alphaUser');
    localStorage.removeItem('alphaCart');
    cart = [];
    updateBadge();
    updateNavUser();
    showPage('home');
    toast('Signed out successfully! See you soon.', { type: 'success', icon: 'fa-solid fa-right-from-bracket' });
  };

  function updateNavUser() {
    const ae = document.getElementById('navAuth'), ue = document.getElementById('navUser');
    const ml = document.getElementById('mobLogin'), mr = document.getElementById('mobReg');
    const mp = document.getElementById('mobProfile'), mo = document.getElementById('mobLogout');
    // Footer IDs
    const fl = document.getElementById('ftLogin'), fr = document.getElementById('ftReg'), fp = document.getElementById('ftProfile'), fo = document.getElementById('ftLogout');

    if (currentUser) {
      if (ae) ae.style.display = 'none';
      if (ue) ue.style.display = 'flex';
      if (ml) ml.style.display = 'none';
      if (mr) mr.style.display = 'none';
      if (mp) mp.style.display = 'block';
      if (mo) mo.style.display = 'block';
      // Footer
      if (fl) fl.style.display = 'none';
      if (fr) fr.style.display = 'none';
      if (fp) fp.style.display = 'block';
      if (fo) fo.style.display = 'block';

      document.getElementById('navUname').textContent = currentUser.firstName + (currentUser.lastName ? ' ' + currentUser.lastName : '');

      if (currentUser.role === 'admin') {
        const existingAdmin = document.querySelector('.nav-admin');
        if (!existingAdmin) {
          const b = document.createElement('button');
          b.className = 'nav-item nav-admin'; b.textContent = 'Admin Console'; b.onclick = () => window.location.href = 'admin.html';
          document.querySelector('.nav-right').prepend(b);
        }
      }
    } else {
      if (ae) ae.style.display = 'flex';
      if (ue) ue.style.display = 'none';
      if (ml) ml.style.display = 'block';
      if (mr) mr.style.display = 'block';
      if (mp) mp.style.display = 'none';
      if (mo) mo.style.display = 'none';
      // Footer
      if (fl) fl.style.display = 'block';
      if (fr) fr.style.display = 'block';
      if (fp) fp.style.display = 'none';
      if (fo) fo.style.display = 'none';

      const existingAdmin = document.querySelector('.nav-admin');
      if (existingAdmin) existingAdmin.remove();
    }
  }

  window.switchProfileTab = function (tabName) {
    document.querySelectorAll('.prof-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.prof-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    const targetId = tabName === 'orders' ? 'profTabOrders' : 'profTabDetails';
    const activeTab = document.getElementById(targetId);
    if (activeTab) {
      activeTab.classList.add('active');
    }
  };

  window.showProfileTab = function (tabName) {
    showPage('profile');
    switchProfileTab(tabName);
    const profMain = document.querySelector('.prof-main');
    if (profMain) {
      profMain.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  async function renderProfile() {
    if (!currentUser) return showPage('login');
    document.getElementById('profName').textContent = currentUser.firstName + (currentUser.lastName ? ' ' + currentUser.lastName : '');
    document.getElementById('profEmail').textContent = currentUser.email;
    const pPhone = document.getElementById('profPhone');
    if (pPhone) pPhone.textContent = currentUser.phone || 'No phone added';
    const pJoined = document.getElementById('profJoined');
    if (pJoined) pJoined.textContent = new Date(currentUser.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const ad = 'https://ui-avatars.com/api/?name=' + currentUser.firstName + '&background=d4af37&color=000&bold=true';
    document.getElementById('profAvatar').src = currentUser.avatar || ad;

    // Fill edit fields
      document.getElementById('pFirst').value = currentUser.firstName || '';
      document.getElementById('pLast').value = currentUser.lastName || '';
      document.getElementById('pEmail').value = currentUser.email || '';
      document.getElementById('pPhoneCode').value = currentUser.phoneCode || '+91';
      document.getElementById('pPhone').value = currentUser.phone || '';
      document.getElementById('pSecondaryPhone').value = currentUser.secondaryPhone || '';
      document.getElementById('pCountry').value = currentUser.country || 'India';
      document.getElementById('pState').value = currentUser.state || 'Kerala';
      document.getElementById('pHouse').value = currentUser.houseNo || '';
      document.getElementById('pAddr').value = currentUser.address || '';
      document.getElementById('pLandmark').value = currentUser.landmark || '';
      document.getElementById('pCity').value = currentUser.city || '';

      document.getElementById('pDistrict').value = currentUser.district || '';
      document.getElementById('pPin').value = currentUser.pin || '';


    const list = document.getElementById('profOrdersList');
    const loaderHTML = '<div class="grid-loader"><div class="spinner"></div><div class="spinner-text">Syncing History</div></div>';
    if (list) list.innerHTML = loaderHTML;

    try {
      const orders = await apiReq('/orders/my-orders');
      document.getElementById('profOrderCount').textContent = orders.length;

      window.userOrdersCache = {};
      orders.forEach(o => { if (o.orderNum) window.userOrdersCache[o.orderNum] = o; });

      if (orders.length === 0) {
        list.innerHTML = `<div class="cart-empty" style="padding:40px 0;"><div class="ce-icon" style="font-size:30px;"><i class="fa-solid fa-box-open"></i></div><div class="ce-title" style="font-size:18px;">No orders yet</div><button class="btn-o" onclick="showPage('shop')">Start Shopping</button></div>`;
        return;
      }

      const groups = {
        'upi': { name: 'UPI PAYMENTS',list: [] },
        'nb': { name: 'NET BANKING', icon: 'fa-building-columns', list: [] },
        'card': { name: 'CARD PAYMENTS', list: [] },
        'cod': { name: 'CASH ON DELIVERY', list: [] },
        'razorpay': { name: 'RAZORPAY ORDERS', icon: 'fa-credit-card', list: [] }
      };

      orders.forEach(o => {
        const pm = o.paymentMethod || 'other';
        if (groups[pm]) groups[pm].list.push(o);
        else {
          if (!groups['other']) groups['other'] = { name: 'OTHER PAYMENTS', icon: 'fa-box', list: [] };
          groups['other'].list.push(o);
        }
      });

      let html = '';
      const renderOrder = (o) => {
        const statuses = ['pending', 'confirmed', 'shipped', 'delivered'];
        const currentIdx = statuses.indexOf(o.status);
        const isCancelled = o.status === 'cancelled';
        const progressWidth = isCancelled ? 100 : Math.max(0, currentIdx) * (100 / (statuses.length - 1));

        const addr = o.address || {};
        const fullName = `${addr.first || ''} ${addr.last || ''}`.trim() || 'Customer';
        const fullAddrStr = [addr.houseNo, addr.addr, addr.landmark, addr.city, addr.district, addr.state, addr.pin ? `- ${addr.pin}` : '']
          .filter(Boolean).join(', ');

        const payStatus = o.paymentStatus || 'pending';
        const subtotal = o.subtotal || o.items.reduce((acc, i) => acc + (i.price * i.qty), 0);
        const shipping = o.shipping || 0;
        const bundleDisc = o.bundleDiscount || 0;
        const couponDisc = o.couponDiscount || o.discount || 0;

        const invoiceButtonHTML = `
          <button class="poi-btn-invoice" onclick="downloadInvoice('${o.orderNum}')">
            <i class="fa-solid fa-file-invoice"></i> Download Invoice
          </button>
        `;

        return `
        <div class="prof-order-item">
          <div class="poi-head">
            <div>
              <div class="poi-num">Order #${o.orderNum}</div>
              <div class="poi-date"><i class="fa-regular fa-calendar"></i> Placed on ${new Date(o.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            ${invoiceButtonHTML}
          </div>
          
          <div class="order-progress-wrap">
            <div class="order-progress ${isCancelled ? 'cancelled' : ''}">
              <div class="progress-track" style="width: ${progressWidth}%"></div>
              <div class="p-step ${isCancelled || currentIdx >= 0 ? 'active' : ''}">
                <div class="p-dot"></div>
                <div class="p-label">${isCancelled ? 'Cancelled' : 'Placed'}</div>
              </div>
              <div class="p-step ${!isCancelled && currentIdx >= 1 ? 'active' : ''}">
                <div class="p-dot"></div>
                <div class="p-label">Confirmed</div>
              </div>
              <div class="p-step ${!isCancelled && currentIdx >= 2 ? 'active' : ''}">
                <div class="p-dot"></div>
                <div class="p-label">Shipped</div>
              </div>
              <div class="p-step ${!isCancelled && currentIdx >= 3 ? 'active' : ''}">
                <div class="p-dot"></div>
                <div class="p-label">Delivered</div>
              </div>
            </div>
          </div>

          <!-- DETAILED INFO GRID (Address & Payment) -->
          <div class="poi-meta-grid">
            <div class="poi-info-box">
              <div class="poi-info-title"><i class="fa-solid fa-location-dot"></i> Delivery Address</div>
              <div class="poi-info-text">
                <strong>${fullName}</strong><br>
                ${fullAddrStr || 'N/A'}<br>
                Phone: ${addr.phone || 'N/A'} ${addr.secondaryPhone ? `/ ${addr.secondaryPhone}` : ''}<br>
                Email: ${addr.email || 'N/A'}
              </div>
            </div>

            <div class="poi-info-box">
              <div class="poi-info-title"><i class="fa-solid fa-credit-card"></i> Payment & Order Info</div>
              <div class="poi-info-text">
                Method: <strong>${(o.paymentMethod || 'COD').toUpperCase()}</strong> 
                <span class="poi-pay-tag ${payStatus}">${payStatus.toUpperCase()}</span><br>
                ${o.razorpayPaymentId ? `Payment ID: <strong>${o.razorpayPaymentId}</strong><br>` : ''}
                ${o.razorpayOrderId ? `Razorpay Order ID: <strong>${o.razorpayOrderId}</strong><br>` : ''}
                Order Status: <strong style="color:var(--gold);">${o.status.toUpperCase()}</strong>
              </div>
            </div>
          </div>

          <!-- ITEMS LIST -->
          <div style="font-size:12px; font-weight:700; color:#fff; margin-bottom:8px;"><i class="fa-solid fa-boxes-packing"></i> ORDERED ITEMS</div>
          <div class="poi-items">
            ${o.items.map(i => `
              <div class="poi-item">
                <span>${i.name} &times; ${i.qty}</span>
                <span>₹${(i.price * i.qty).toLocaleString('en-IN')}</span>
              </div>
            `).join('')}
          </div>

          <!-- PRICE BREAKDOWN -->
          <div class="poi-price-breakdown">
            <div class="poi-pb-row">
              <span>Subtotal:</span>
              <span>₹${subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div class="poi-pb-row">
              <span>Shipping:</span>
              <span>${shipping === 0 ? 'FREE' : `₹${shipping.toLocaleString('en-IN')}`}</span>
            </div>
            ${bundleDisc > 0 ? `
              <div class="poi-pb-row discount">
                <span>${o.bundleLabel || 'Bundle Savings'}:</span>
                <span>- ₹${bundleDisc.toLocaleString('en-IN')}</span>
              </div>
            ` : ''}
            ${couponDisc > 0 ? `
              <div class="poi-pb-row discount">
                <span>Coupon Discount:</span>
                <span>- ₹${couponDisc.toLocaleString('en-IN')}</span>
              </div>
            ` : ''}
            <div class="poi-pb-row total-row">
              <span>Grand Total:</span>
              <span>₹${o.total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div class="poi-footer">
            <div class="poi-status" style="border-color:${o.status === 'delivered' ? 'var(--green)' : (isCancelled ? 'var(--red)' : 'var(--gold)')};color:${o.status === 'delivered' ? 'var(--green)' : (isCancelled ? 'var(--red)' : 'var(--gold)')}">${o.status.toUpperCase()}</div>
            <div class="poi-total">Total: ₹${o.total.toLocaleString('en-IN')}</div>
          </div>
        </div>`;
      };

      Object.keys(groups).forEach(key => {
        const g = groups[key];
        if (g.list.length > 0) {
          html += `<div class="prof-sec-h"><i class="fa-solid ${g.icon}"></i> ${g.name} (${g.list.length})</div>`;
          html += g.list.map(renderOrder).join('');
        }
      });

      list.innerHTML = html;
    } catch (e) { }
  }

  window.previewAvatar = async (inp) => {
    if (inp.files && inp.files[0]) {
      const file = inp.files[0];
      // Immediate preview
      const r = new FileReader();
      r.onload = (e) => document.getElementById('profAvatar').src = e.target.result;
      r.readAsDataURL(file);

      // Immediate upload
      const ov = document.querySelector('.pa-ov');
      const avWrap = document.querySelector('.prof-avatar-wrap');
      if (ov) { ov.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; ov.style.opacity = '1'; }
      avWrap.style.pointerEvents = 'none';

      try {
        const fd = new FormData();
        fd.append('avatar', file);
        const data = await apiReq('/users/me', { method: 'POST', body: fd });
        currentUser = { ...currentUser, ...data };
        localStorage.setItem('alphaUser', JSON.stringify(currentUser));
        updateNavUser();
        toast('Profile picture uploaded!', { type: 'success' });
      } catch (e) {
        // Error handled by apiReq
      } finally {
        if (ov) { ov.innerHTML = '<i class="fa-solid fa-camera"></i>'; ov.style.opacity = ''; }
        avWrap.style.pointerEvents = '';
        inp.value = '';
      }
    }
  };

  window.updateProfile = async function () {
    const btn = document.getElementById('profUpdateBtn');
    const fields = ['pFirst', 'pLast', 'pPhone', 'pPhoneCode', 'pSecondaryPhone', 'pCountry', 'pState', 'pHouse', 'pAddr', 'pLandmark', 'pCity', 'pDistrict', 'pPin'];
    let valid = true;

    // Reset errors
    document.querySelectorAll('.prof-main .fe').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('.prof-main .fi').forEach(e => e.classList.remove('error'));

    // Mandatory checks
    fields.forEach(f => {
      const el = document.getElementById(f);
      const errEl = document.getElementById(f + 'E');
      if (!el || !el.value.trim()) {
        if (errEl) { errEl.textContent = "This field is required"; errEl.classList.add('show'); }
        if (el) el.classList.add('error');
        valid = false;
      }
    });

    // Specific validations
    const phoneEl = document.getElementById('pPhone');
    const phoneValue = phoneEl.value.trim().replace(/\D/g, '');
    if (phoneValue && !/^[6-9]\d{9}$/.test(phoneValue)) {
      const errEl = document.getElementById('pPhoneE');
      if (errEl) {
        errEl.textContent = "Invalid phone (10 digits starting with 6-9)";
        errEl.classList.add('show');
      }
      phoneEl.classList.add('error');
      valid = false;
    }

    const pinEl = document.getElementById('pPin');
    const pinValue = pinEl.value.trim().replace(/\D/g, '');
    if (pinValue && !/^\d{6}$/.test(pinValue)) {
      const errEl = document.getElementById('pPinE');
      if (errEl) {
        errEl.textContent = "Invalid PIN Code (6 digits)";
        errEl.classList.add('show');
      }
      pinEl.classList.add('error');
      valid = false;
    }

    const firstEl = document.getElementById('pFirst');
    if (firstEl.value.trim().length < 2) {
      const errEl = document.getElementById('pFirstE');
      if (errEl) { errEl.textContent = "Minimum 2 characters required"; errEl.classList.add('show'); }
      firstEl.classList.add('error');
      valid = false;
    }

    if (!valid) return toast('Please fix the errors in your profile', { type: 'error' });

    const ogText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    btn.disabled = true;

    try {
      const fd = new FormData();
      fd.append('firstName', document.getElementById('pFirst').value.trim());
      fd.append('lastName', document.getElementById('pLast').value.trim());
      fd.append('phone', document.getElementById('pPhone').value.trim());
      fd.append('phoneCode', document.getElementById('pPhoneCode').value.trim());
      fd.append('secondaryPhone', document.getElementById('pSecondaryPhone').value.trim());
      fd.append('country', document.getElementById('pCountry').value.trim());
      fd.append('state', document.getElementById('pState').value.trim());
      fd.append('houseNo', document.getElementById('pHouse').value.trim());
      fd.append('address', document.getElementById('pAddr').value.trim());
      fd.append('landmark', document.getElementById('pLandmark').value.trim());
      fd.append('city', document.getElementById('pCity').value.trim());

      fd.append('district', document.getElementById('pDistrict').value.trim());
      fd.append('pin', document.getElementById('pPin').value.trim());

      const data = await apiReq('/users/me', {
        method: 'POST',
        body: fd
        // apiReq will handle auth header and omit Content-Type for FormData
      });
      currentUser = { ...currentUser, ...data };
      localStorage.setItem('alphaUser', JSON.stringify(currentUser));
      updateNavUser();
      renderProfile(); // Refresh UI with new avatar

      toast('Profile updated successfully!', { type: 'success' });
    } catch (err) {
      // Error toasted by apiReq
    } finally {
      btn.innerHTML = ogText;
      btn.disabled = false;
    }
  };

  // ══ CHECKOUT & RAZORPAY ══
  window.proceedCheckout = function () {
    if (cart.length === 0) return toast('Cart is empty!', { type: 'error', icon: 'fa-solid fa-cart-shopping' });
    if (!currentUser) {
      redirectAfterAuth = 'checkout';
      showPage('login');
      toast('Please sign in to checkout', { type: 'info', icon: 'fa-solid fa-user-lock' });
      return;
    }
    showPage('checkout');
  };

  function initCheckout() {
    const main = document.getElementById('checkoutMain');
    if (main) main.style.display = 'block';
    const succ = document.getElementById('page-orderSuccess');
    if (succ) succ.classList.remove('active');

    const sub = getSubtotal(), total = getFinalTotal(), ship = getShipping();
    const disc = getCouponDiscount() + getBundleDiscount();

    document.getElementById('osSub').textContent = '₹' + sub.toLocaleString('en-IN');
    document.getElementById('osShip').textContent = ship === 0 ? 'FREE' : '₹' + ship;

    const odr = document.getElementById('osDiscRow');
    if (disc > 0) {
      odr.style.display = 'flex';
      document.getElementById('osDisc').textContent = '-₹' + Math.round(disc).toLocaleString('en-IN');
      document.getElementById('osDiscLabel').textContent = (getCouponDiscount() > 0 && getBundleDiscount() > 0) ? 'Total Discounts' : (getCouponDiscount() > 0 ? 'Coupon Discount' : cartBundleLabel);
    } else {
      odr.style.display = 'none';
    }

    document.getElementById('osTotal').textContent = '₹' + Math.round(total).toLocaleString('en-IN');
    document.getElementById('osItems').innerHTML = cart.map(c => `
      <div class="os-item">
        <div style="width:46px; height:46px; flex-shrink:0; background:var(--mid); overflow:hidden; border-radius:4px;">
          ${makeImgHTML(c.id, '')}
        </div>
        <div style="flex:1;">
          <div class="os-name" style="font-size:13px; font-weight:500; color:var(--white);">${c.name}</div>
          <div class="os-qty" style="font-size:11px; color:var(--muted); margin-top:2px;">Qty: ${c.qty}</div>
        </div>
        <div class="os-price" style="font-weight:600; color:var(--white);">₹${(c.price * c.qty).toLocaleString('en-IN')}</div>
      </div>`).join('');

    // Pre-fill from profile
    if (currentUser) {
      document.getElementById('cFirst').value = currentUser.firstName || '';
      document.getElementById('cLast').value = currentUser.lastName || '';
      const emailEl = document.getElementById('cEmail');
      emailEl.value = currentUser.email || '';
      emailEl.readOnly = true;
      emailEl.style.background = 'var(--mid)';
      emailEl.style.cursor = 'not-allowed';
      emailEl.style.opacity = '0.8';

      document.getElementById('cPhoneCode').value = currentUser.phoneCode || '+91';
      document.getElementById('cPhone').value = currentUser.phone || '';
      document.getElementById('cSecondaryPhone').value = currentUser.secondaryPhone || '';
      document.getElementById('cCountry').value = currentUser.country || 'India';
      document.getElementById('cHouse').value = currentUser.houseNo || '';
      document.getElementById('cAddr').value = currentUser.address || '';
      document.getElementById('cLandmark').value = currentUser.landmark || '';
      document.getElementById('cCity').value = currentUser.city || '';

      document.getElementById('cDistrict').value = currentUser.district || '';
      document.getElementById('cPin').value = currentUser.pin || '';
      document.getElementById('cState').value = currentUser.state || 'Kerala';

    }
  }

  window.selPM = function (el, method) {
    document.querySelectorAll('.pay-opt').forEach(opt => opt.classList.remove('sel'));
    el.classList.add('sel');
    const upif = document.getElementById('upiF');
    if (upif) upif.style.display = method === 'upi' ? 'block' : 'none';
    const cardf = document.getElementById('cardF');
    if (cardf) cardf.style.display = method === 'card' ? 'block' : 'none';
  };

  function validateCheckoutData() {
    const reqFields = ['cFirst', 'cEmail', 'cPhone', 'cPhoneCode', 'cCountry', 'cHouse', 'cAddr', 'cCity', 'cDistrict', 'cPin', 'cState'];
    let isValid = true;

    // Reset previous error states
    document.querySelectorAll('#page-checkout .fe').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#page-checkout .fi').forEach(e => e.classList.remove('error'));

    reqFields.forEach(f => {
      const el = document.getElementById(f);
      const errEl = document.getElementById(f + 'E');
      if (el && !el.value.trim()) {
        if (errEl) { errEl.textContent = "Required"; errEl.classList.add('show'); }
        el.classList.add('error');
        isValid = false;
      }
    });

    const firstEl = document.getElementById('cFirst');
    if (firstEl && firstEl.value.trim().length < 2) {
      const errEl = document.getElementById('cFirstE');
      if (errEl) { errEl.textContent = "Minimum 2 characters required"; errEl.classList.add('show'); }
      firstEl.classList.add('error');
      isValid = false;
    }

    const emailEl = document.getElementById('cEmail');
    if (emailEl) {
      const email = emailEl.value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const errEl = document.getElementById('cEmailE');
        if (errEl) { errEl.textContent = "Valid email required"; errEl.classList.add('show'); }
        emailEl.classList.add('error');
        isValid = false;
      }
    }

    const phoneEl = document.getElementById('cPhone');
    if (phoneEl) {
      const phone = phoneEl.value.trim().replace(/\D/g, '');
      if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        const errEl = document.getElementById('cPhoneE');
        if (errEl) { errEl.textContent = "10-digit number (starting with 6-9)"; errEl.classList.add('show'); }
        phoneEl.classList.add('error');
        isValid = false;
      }
    }

    const addrEl = document.getElementById('cAddr');
    if (addrEl && addrEl.value.trim().length < 5) {
      const errEl = document.getElementById('cAddrE');
      if (errEl) { errEl.textContent = "Please enter a more detailed address"; errEl.classList.add('show'); }
      addrEl.classList.add('error');
      isValid = false;
    }

    const pinEl = document.getElementById('cPin');
    if (pinEl) {
      const pin = pinEl.value.trim().replace(/\D/g, '');
      if (pin && !/^\d{6}$/.test(pin)) {
        const errEl = document.getElementById('cPinE');
        if (errEl) { errEl.textContent = "Valid 6-digit PIN required"; errEl.classList.add('show'); }
        pinEl.classList.add('error');
        isValid = false;
      }
    }

    if (!isValid) toast('Please check your delivery details', { type: 'error' });
    return isValid;
  }

  // ══ PLACE ORDER BUTTON LOADER ══
function setPlaceOrderLoading(loading) {
  const btn = document.querySelector('.place-btn');
  if (!btn) return;

  if (loading) {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.innerHTML;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
  } else {
    btn.innerHTML = btn.dataset.originalText || 'Place Order →';
    btn.disabled = false;
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
    btn.style.cursor = '';
    delete btn.dataset.originalText;
  }
}

  window.placeOrder = async function () {
  if (!currentUser) {
    redirectAfterAuth = 'checkout';
    showPage('login');
    toast('Please sign in to place your order', {
      type: 'info',
      icon: 'fa-solid fa-user-lock'
    });
    return;
  }

  // Validate BEFORE showing loading
  if (!validateCheckoutData()) return;

  // Start button loading
  setPlaceOrderLoading(true);

  const sub = getSubtotal();
  const total = getFinalTotal();

  const addr = {
    first: document.getElementById('cFirst').value,
    email: document.getElementById('cEmail').value,
    phone: document.getElementById('cPhone').value,
    phoneCode: document.getElementById('cPhoneCode').value,
    secondaryPhone: document.getElementById('cSecondaryPhone').value,
    country: document.getElementById('cCountry').value,
    houseNo: document.getElementById('cHouse').value,
    addr: document.getElementById('cAddr').value,
    landmark: document.getElementById('cLandmark').value,
    city: document.getElementById('cCity').value,
    district: document.getElementById('cDistrict').value,
    pin: document.getElementById('cPin').value,
    state: document.getElementById('cState').value
  };

  // Detect payment method
  const method =
    document.querySelector('input[name="pm"]:checked')
      ?.parentElement?.id?.split('-')[1] || 'cod';

  // COD
  if (method === 'cod') {
    try {
      await saveOrder(
        null,
        null,
        null,
        'cod',
        'pending',
        addr
      );
    } finally {
      setPlaceOrderLoading(false);
    }

    return;
  }

  const finalMethod = method;

  // Razorpay
  try {
    const rOrder = await apiReq('/payments/create-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        total: Number(total),
        customer: {
          name: addr.first,
          email: addr.email,
          phone: addr.phone
        }
      })
    });

    toggleLoader(true);

    const opt = {
      key: rOrder.key_id,
      amount: rOrder.amount,
      currency: "INR",
      name: "AlphaDetail",
      description: "Order Checkout",
      order_id: rOrder.id,

      handler: function (resp) {
        toggleLoader(true);

        apiReq('/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(resp)
        })
        .then(v => {
          if (v.success) {
            return saveOrder(
              null,
              rOrder.id,
              resp.razorpay_payment_id,
              finalMethod,
              'paid',
              addr
            );
          } else {
            toggleLoader(false);
            setPlaceOrderLoading(false);

            toast(
              'Payment verification failed. Please contact support.',
              { type: 'error' }
            );
          }
        })
        .catch(err => {
          toggleLoader(false);
          setPlaceOrderLoading(false);

          toast(
            'Verification error: ' + err.message,
            { type: 'error' }
          );
        })
        .finally(() => {
          setPlaceOrderLoading(false);
        });
      },

      modal: {
        ondismiss: function () {
          toggleLoader(false);
          setPlaceOrderLoading(false);

          toast('Payment cancelled', {
            type: 'info'
          });
        }
      },

      prefill: {
        name: addr.first,
        email: addr.email,
        contact: addr.phone
      },

      theme: {
        color: "#000000ff"
      }
    };

    const rzp = new Razorpay(opt);

    rzp.open();

    // Hide global loader after Razorpay opens
    setTimeout(() => toggleLoader(false), 2000);

  } catch (e) {
    toggleLoader(false);
    setPlaceOrderLoading(false);

    console.error('Payment Error:', e);

    toast(
      'Payment initialization failed: ' + e.message,
      {
        type: 'error',
        icon: 'fa-solid fa-circle-exclamation'
      }
    );
  }
};
  
  window.orderViaWhatsApp = function () {
    if (cart.length === 0) return toast('Cart is empty!', { type: 'error', icon: 'fa-solid fa-cart-shopping' });

    if (!currentUser) {
      // Intelligently redirect back to the current active page after login
      const activePg = document.querySelector('.page.active')?.id?.split('-')[1] || 'cart';
      redirectAfterAuth = activePg;
      showPage('login');
      toast('Please sign in to order through WhatsApp', { type: 'info', icon: 'fa-solid fa-user-lock' });
      return;
    }

    // NEW: Check if we are on the checkout page. If not, go there first for confirmation.
    if (!document.getElementById('page-checkout').classList.contains('active')) {
      showPage('checkout');
      toast('Please confirm your delivery address and details', { type: 'info', icon: 'fa-solid fa-map-location-dot' });
      return;
    }

    // Validate checkout form before proceeding
    if (!validateCheckoutData()) return;

    const customerName = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
    const customerEmail = currentUser.email;

    // Use current form values if present, otherwise fallback to profile, then N/A
    const getVal = (id, profVal) => {
      const el = document.getElementById(id);
      if (el && el.value.trim()) return el.value.trim();
      return profVal || 'N/A';
    };

    const customerPhone = getVal('cPhone', currentUser.phone);
    const phoneCode = getVal('cPhoneCode', currentUser.phoneCode || '+91');
    const secondaryPhone = getVal('cSecondaryPhone', currentUser.secondaryPhone);
    const country = getVal('cCountry', currentUser.country || 'India');
    const state = getVal('cState', currentUser.state || 'Kerala');
    
    const houseNo = getVal('cHouse', currentUser.houseNo);
    const address = getVal('cAddr', currentUser.address);
    const landmark = getVal('cLandmark', currentUser.landmark);
    const city = getVal('cCity', currentUser.city);
    const district = getVal('cDistrict', currentUser.district);
    const pin = getVal('cPin', currentUser.pin);



    let itemsText = '';
    cart.forEach((item, index) => {
      itemsText += `${index + 1}. *${item.name}* x ${item.qty} - ₹${(item.price * item.qty).toLocaleString('en-IN')}\n`;
    });

    const subtotal = getSubtotal();
    const shipping = getShipping();
    const bundleDiscount = getBundleDiscount();
    const couponDiscount = getCouponDiscount();
    const total = getFinalTotal();

    let summaryText = ` *NEW WHATSAPP ORDER*\n\n`;
    summaryText += ` *CUSTOMER DETAILS*\n`;
    summaryText += `Name: ${customerName}\n`;
    summaryText += `Email: ${customerEmail}\n\n`;

    summaryText += `*DELIVERY ADDRESS*\n`;
    summaryText += `House / Flat No: ${houseNo}\n`;
    summaryText += `Area / Street: ${address}\n`;
    if (landmark !== 'N/A') summaryText += `Landmark: ${landmark}\n`;
    summaryText += `City: ${city}\n`;
    summaryText += `District: ${district}\n`;
    summaryText += `State: ${state}\n`;
    summaryText += `Pincode: ${pin}\n`;
    summaryText += `Country: ${country}\n`;
    summaryText += `Phone No: ${phoneCode} ${customerPhone}\n`;
    if (secondaryPhone !== 'N/A') summaryText += `Secondary Phone: ${secondaryPhone}\n`;
    summaryText += `\n`;




    summaryText += ` *ORDER ITEMS*\n`;
    summaryText += itemsText + `\n`;

    summaryText += ` *ORDER SUMMARY*\n`;
    summaryText += `Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n`;
    summaryText += `Shipping: ${shipping === 0 ? 'FREE' : '₹' + shipping}\n`;
    
    if (bundleDiscount > 0) {
      summaryText += `${cartBundleLabel}: -₹${Math.round(bundleDiscount).toLocaleString('en-IN')}\n`;
    }
    
    if (couponDiscount > 0) {
      summaryText += `Coupon Applied: -₹${Math.round(couponDiscount).toLocaleString('en-IN')}\n`;
    }

    summaryText += `*TOTAL AMOUNT: ₹${Math.round(total).toLocaleString('en-IN')}*\n\n`;
    summaryText += `Please confirm my order. Thank you!`;

    const orderNum = 'AD' + Date.now().toString().slice(-6);
    const waLink = `https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(`🛒 *ORDER #${orderNum}*\n\n` + summaryText)}`;

    // Create address object for database
    const addrObj = {
      first: currentUser.firstName,
      last: currentUser.lastName || '',
      email: currentUser.email,
      phone: customerPhone,
      phoneCode: phoneCode,
      secondaryPhone: secondaryPhone === 'N/A' ? '' : secondaryPhone,
      country: country,
      houseNo: houseNo,
      addr: address,
      landmark: landmark === 'N/A' ? '' : landmark,
      city: city,
      district: district,
      pin: pin,
      state: state
    };

    // Save order, then open WhatsApp with delay
    saveOrder(orderNum, null, null, 'whatsapp', 'pending', addrObj).then(() => {
      toast('Redirecting to WhatsApp...', { type: 'info', duration: 2000 });
      setTimeout(() => {
        window.open(waLink, '_blank');
      }, 2000);
    });
  };




  let lastOrder = null;
  async function saveOrder(orderNum, rOrderId, rPayId, method, status, addr) {
    if (!orderNum) orderNum = 'AD' + Date.now().toString().slice(-6);

    const checkoutItems = [...cart];
    const orderData = {
      orderNum,
      items: checkoutItems,
      subtotal: getSubtotal(),
      total: getFinalTotal(),
      shipping: getShipping(),
      bundleDiscount: getBundleDiscount(),
      bundleLabel: cartBundleLabel,
      couponDiscount: getCouponDiscount(),
      paymentMethod: method,
      paymentStatus: status,
      razorpayOrderId: rOrderId,
      razorpayPaymentId: rPayId,
      address: addr,
      createdAt: new Date().toISOString()
    };

    toggleLoader(true);
    try {
      await apiReq('/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      lastOrder = orderData;
      cart = []; updateBadge();
      const main = document.getElementById('checkoutMain');
      if (main) main.style.display = 'none';
      // Remove active from all pages first, then activate success page
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const succ = document.getElementById('page-orderSuccess');
      if (succ) {
        succ.classList.add('active');
        window.scrollTo(0, 0);

        // Populate order number
        document.getElementById('orderNum').textContent = orderNum;

        // Render order summary details
        const detailsDiv = document.getElementById('orderDetails');
        if (detailsDiv && lastOrder) {
          const itemsHtml = lastOrder.items.map(i =>
            `<div style="margin-bottom:6px;">${i.name} &times; ${i.qty} &mdash; &#8377;${(i.price * i.qty).toLocaleString('en-IN')}</div>`
          ).join('');
          const subtotal = lastOrder.subtotal || 0;
          const shipping = lastOrder.shipping || 0;
          const discount = (lastOrder.couponDiscount || 0) + (lastOrder.bundleDiscount || 0);
          const total = lastOrder.total || 0;
          detailsDiv.innerHTML = `
            <div style="font-weight:600;margin-bottom:8px;">Items:</div>
            ${itemsHtml}
            <div style="margin-top:8px;">Subtotal: &#8377;${subtotal.toLocaleString('en-IN')}</div>
            <div>Shipping: ${shipping === 0 ? 'FREE' : `&#8377;${shipping.toLocaleString('en-IN')}`}</div>
            ${discount > 0 ? `<div>Discount: -&#8377;${discount.toLocaleString('en-IN')}</div>` : ''}
            <div style="font-weight:600;margin-top:6px;">Total: &#8377;${total.toLocaleString('en-IN')}</div>`;
        }

        // Set WhatsApp status button
        const waBtn = document.getElementById('waSuccessBtn');
        if (waBtn) {
          const waText = encodeURIComponent(`Hi Alpha Detail, I've placed an order (ID: ${orderNum}). Could you please confirm the shipping status?`);
          waBtn.onclick = () => window.open(`https://wa.me/${BUSINESS_PHONE}?text=${waText}`, '_blank');
        }

        toast('Order placed successfully!', { type: 'success', icon: 'fa-solid fa-circle-check' });
        sessionStorage.setItem('alphaLastOrder', JSON.stringify(lastOrder));
        
        setTimeout(() => {
          succ.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach(el => el.classList.add('visible'));
        }, 50);
      }
    } catch (err) {
      toast('Failed to save order. But payment was successful. Please contact support with ID: ' + rPayId, { type: 'error' });
    } finally {
      toggleLoader(false);
    }
  }

  window.downloadInvoice = function (orderNum) {
    let orderData = window.userOrdersCache && window.userOrdersCache[orderNum];
    if (!orderData && typeof lastOrder !== 'undefined' && lastOrder && lastOrder.orderNum === orderNum) {
      orderData = lastOrder;
    }
    if (!orderData) {
      return toast('Order details not found', { type: 'error' });
    }
    window.renderInvoicePage(orderData);
  };

  window.printOrder = function () {
    if (!lastOrder) return toast('No order details found to print', { type: 'error' });
    window.renderInvoicePage(lastOrder);
  };

  window.renderInvoicePage = function (o) {
    if (!o) return toast('No order data available for invoice', { type: 'error' });

    const w = window.open('', '_blank');
    if (!w) return toast('Pop-up blocked. Please allow pop-ups to view invoice.', { type: 'error' });

    const addr = o.address || {};
    const fullName = `${addr.first || ''} ${addr.last || ''}`.trim() || 'Customer';
    const items = Array.isArray(o.items) ? o.items : [];

    const subtotal = Number(o.subtotal ?? items.reduce(
      (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0
    ));
    const shipping = Number(o.shipping || 0);
    const bundleDisc = Number(o.bundleDiscount || 0);
    const couponDisc = Number(o.couponDiscount ?? o.discount ?? 0);
    const totalDiscount = bundleDisc + couponDisc;
    const grandTotal = Number(o.total ?? (subtotal + shipping - totalDiscount));

    const money = (value) => `&#8377;${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
    const safe = (value, fallback = '—') => {
      const text = String(value ?? '').trim();
      return text || fallback;
    };

    const itemsHTML = items.map((item, index) => {
      const qty = Number(item.qty) || 1;
      const unitPrice = Number(item.price) || 0;
      const gross = unitPrice * qty;
      const itemDiscount = Number(item.discount || 0);
      const taxableValue = item.taxableValue != null
        ? Number(item.taxableValue)
        : (itemDiscount ? gross - itemDiscount : null);
      const taxValue = item.tax != null ? Number(item.tax) : null;
      const itemTotal = item.total != null
        ? Number(item.total)
        : (taxableValue != null && taxValue != null
          ? taxableValue + taxValue
          : (gross - itemDiscount));

      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>
            <div class="product-title">${safe(item.name, 'Product')}</div>
            ${item.sub ? `<div class="product-sub">${safe(item.sub)}</div>` : ''}
            ${item.hsn ? `<div class="product-meta">HSN/SAC: ${safe(item.hsn)}</div>` : ''}
          </td>
          <td class="center">${qty}</td>
          <td class="amount">${money(gross)}</td>
          <td class="amount">${itemDiscount ? '-' + money(itemDiscount) : money(0)}</td>
          <td class="amount">${taxableValue != null ? money(taxableValue) : '—'}</td>
          <td class="amount">${taxValue != null ? money(taxValue) : '—'}</td>
          <td class="amount strong">${money(itemTotal)}</td>
        </tr>
      `;
    }).join('');

    const formattedDate = new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const formattedOrderDate = new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const payMethod = safe(o.paymentMethod, 'COD').toUpperCase();
    const payStatus = safe(o.paymentStatus, 'PENDING').toUpperCase();
    const sellerGSTIN = safe(o.sellerGSTIN || o.gstin, '—');
    const invoiceNumber = safe(o.invoiceNumber, `INV-${o.orderNum || Date.now()}`);
    const sellerName = safe(o.sellerName, 'AlphaDetail');
    const sellerAddress = safe(
      o.sellerAddress,
      'Kerala, India'
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice #${safe(o.orderNum)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #212121;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .print-bar {
      padding: 12px;
      text-align: center;
      border-bottom: 1px solid #ddd;
      background: #fff;
    }
    .print-btn {
      border: 0;
      background: #2874f0;
      color: #fff;
      padding: 9px 20px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 2px;
      cursor: pointer;
    }
    .invoice {
      width: 100%;
      max-width: 900px;
      margin: 20px auto;
      border: 1px solid #d6d6d6;
      background: #fff;
    }
    .top-note {
      padding: 7px 12px;
      border-bottom: 1px solid #d6d6d6;
      font-size: 10px;
      color: #555;
      text-align: right;
    }
    .seller-header {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
      padding: 18px 20px;
      border-bottom: 1px solid #d6d6d6;
    }
    .brand {
      font-size: 22px;
      font-weight: 700;
      color: #111;
      margin-bottom: 5px;
    }
    .seller-info {
      color: #444;
      line-height: 1.55;
    }
    .invoice-heading {
      text-align: right;
    }
    .invoice-heading h1 {
      margin: 0 0 10px;
      font-size: 22px;
      font-weight: 700;
      color: #111;
    }
    .invoice-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 14px;
      text-align: left;
      margin-left: auto;
      max-width: 290px;
    }
    .invoice-meta span:nth-child(odd) {
      color: #666;
    }
    .invoice-meta span:nth-child(even) {
      text-align: right;
      font-weight: 700;
      color: #111;
    }
    .address-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #d6d6d6;
    }
    .address-box {
      padding: 14px 20px;
      min-height: 130px;
    }
    .address-box + .address-box {
      border-left: 1px solid #d6d6d6;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #555;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .customer-name {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .items-wrap {
      padding: 18px 20px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .items-table th {
      background: #f2f2f2;
      border: 1px solid #cfcfcf;
      padding: 8px 6px;
      font-size: 10px;
      font-weight: 700;
      color: #333;
      text-transform: uppercase;
    }
    .items-table td {
      border: 1px solid #d8d8d8;
      padding: 9px 7px;
      vertical-align: top;
    }
    .center { text-align: center; }
    .amount { text-align: right; white-space: nowrap; }
    .strong { font-weight: 700; }
    .product-title { font-weight: 700; color: #111; }
    .product-sub { color: #666; font-size: 10px; margin-top: 2px; }
    .product-meta { color: #666; font-size: 9px; margin-top: 4px; }
    .summary-area {
      display: grid;
      grid-template-columns: 1fr 330px;
      gap: 20px;
      padding: 18px 20px;
    }
    .payment-box {
      border: 1px solid #d8d8d8;
      padding: 12px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }
    .summary-table td {
      padding: 6px 0;
    }
    .summary-table td:last-child {
      text-align: right;
      white-space: nowrap;
    }
    .discount-row td {
      color: #198754;
    }
    .grand-total td {
      border-top: 2px solid #222;
      padding-top: 10px;
      font-size: 15px;
      font-weight: 700;
      color: #111;
    }
    .amount-words {
      padding: 0 20px 16px;
      font-size: 11px;
      color: #444;
    }
    .footer {
      border-top: 1px solid #d6d6d6;
      padding: 14px 20px;
      font-size: 10px;
      color: #555;
    }
    .footer strong { color: #222; }
    @media (max-width: 700px) {
      .invoice { margin: 0; border-left: 0; border-right: 0; }
      .seller-header,
      .address-grid,
      .summary-area { grid-template-columns: 1fr; }
      .invoice-heading { text-align: left; }
      .invoice-meta { margin-left: 0; }
      .address-box + .address-box { border-left: 0; border-top: 1px solid #d6d6d6; }
      .items-wrap { overflow-x: auto; }
      .items-table { min-width: 760px; }
    }
    @media print {
      body { background: #fff; }
      .print-bar { display: none !important; }
      .invoice {
        max-width: none;
        margin: 0;
        border: 0;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="invoice">
    <div class="top-note">E. &amp; O.E.</div>

    <div class="seller-header">
      <div>
        <div class="brand">${sellerName}</div>
        <div class="seller-info">
          ${sellerAddress}<br>
          ${o.sellerPhone ? `Phone: ${safe(o.sellerPhone)}<br>` : 'Phone: +91 7025225245<br>'}
          ${o.sellerEmail ? `Email: ${safe(o.sellerEmail)}<br>` : 'Email: alphadetail2f@gmail.com<br>'}
          GSTIN: ${sellerGSTIN}
        </div>
      </div>

      <div class="invoice-heading">
        <h1>TAX INVOICE</h1>
        <div class="invoice-meta">
          <span>Invoice Number</span><span>${invoiceNumber}</span>
          <span>Invoice Date</span><span>${formattedDate}</span>
          <span>Order ID</span><span>${safe(o.orderNum)}</span>
          <span>Order Date</span><span>${formattedOrderDate}</span>
        </div>
      </div>
    </div>

    <div class="address-grid">
      <div class="address-box">
        <div class="section-title">Bill To</div>
        <div class="customer-name">${safe(fullName)}</div>
        ${addr.email ? `Email: ${safe(addr.email)}<br>` : ''}
        ${addr.phone ? `Phone: ${safe(addr.phone)}<br>` : ''}
        ${addr.houseNo || addr.addr ? `Address: ${safe(addr.houseNo ? `${addr.houseNo}, ` : '')}${safe(addr.addr, '')}<br>` : ''}
        ${addr.landmark ? `Landmark: ${safe(addr.landmark)}<br>` : ''}
        ${addr.city ? `${safe(addr.city)}, ` : ''}${addr.district ? `${safe(addr.district)}, ` : ''}${safe(addr.state, 'Kerala')} ${addr.pin ? `- ${safe(addr.pin)}` : ''}
      </div>

      <div class="address-box">
        <div class="section-title">Ship To</div>
        <div class="customer-name">${safe(fullName)}</div>
        ${addr.phone ? `Phone: ${safe(addr.phone)}<br>` : ''}
        ${addr.houseNo || addr.addr ? `Address: ${safe(addr.houseNo ? `${addr.houseNo}, ` : '')}${safe(addr.addr, '')}<br>` : ''}
        ${addr.landmark ? `Landmark: ${safe(addr.landmark)}<br>` : ''}
        ${addr.city ? `${safe(addr.city)}, ` : ''}${addr.district ? `${safe(addr.district)}, ` : ''}${safe(addr.state, 'Kerala')} ${addr.pin ? `- ${safe(addr.pin)}` : ''}
      </div>
    </div>

    <div class="items-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:34px;">#</th>
            <th style="width:32%;">Product Title / Description</th>
            <th style="width:55px;">Qty</th>
            <th>Gross Amount</th>
            <th>Discount</th>
            <th>Taxable Value</th>
            <th>Tax</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML || `<tr><td colspan="8" class="center">No products found</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="summary-area">
      <div class="payment-box">
        <div class="section-title">Payment &amp; Order Details</div>
        Payment Method: <strong>${payMethod}</strong><br>
        Payment Status: <strong>${payStatus}</strong><br>
        Order Status: <strong>${safe(o.status, 'ORDERED').toUpperCase()}</strong>
        ${o.razorpayPaymentId ? `<br>Payment ID: <strong>${safe(o.razorpayPaymentId)}</strong>` : ''}
        ${o.razorpayOrderId ? `<br>Razorpay Order ID: <strong>${safe(o.razorpayOrderId)}</strong>` : ''}
      </div>

      <table class="summary-table">
        <tr><td>Subtotal</td><td>${money(subtotal)}</td></tr>
        <tr><td>Shipping</td><td>${shipping === 0 ? 'FREE' : money(shipping)}</td></tr>
        ${bundleDisc > 0 ? `<tr class="discount-row"><td>${safe(o.bundleLabel, 'Bundle Discount')}</td><td>- ${money(bundleDisc)}</td></tr>` : ''}
        ${couponDisc > 0 ? `<tr class="discount-row"><td>Coupon Discount</td><td>- ${money(couponDisc)}</td></tr>` : ''}
        <tr class="grand-total"><td>Grand Total</td><td>${money(grandTotal)}</td></tr>
      </table>
    </div>

    <div class="amount-words">
      <strong>Amount Payable:</strong> ${money(grandTotal)}
      &nbsp; | &nbsp; Prices shown are based on the order data recorded by AlphaDetail.
    </div>

    <div class="footer">
      <strong>${sellerName}</strong><br>
      This is a computer-generated tax invoice and does not require a physical signature.<br>
      Please retain this invoice for your records.
    </div>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  window.toast = function (msg, opt = {}) {
    const container = document.getElementById('sonner');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'sonner-toast ' + (opt.type || '');
    t.innerHTML = `
    <div class="sonner-content">
      <div class="sonner-icon"><i class="${opt.icon || (opt.type === 'error' ? 'fa-solid fa-circle-xmark' : (opt.type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-info'))}"></i></div>
      <div class="sonner-msg">${msg}</div>
    </div>
    ${opt.action ? `<button class="sonner-action" onclick="${opt.action.onClick}">${opt.action.label}</button>` : ''}
    <button class="sonner-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
  `;
    container.prepend(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, opt.duration || 4000);
  };

  function observeReveal() {
    const obs = new IntersectionObserver((ents) => {
      ents.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          if (en.target.id === 'promise-sec' || en.target.classList.contains('promise-inner')) {
            document.querySelectorAll('.promise-inner > div').forEach(el => el.classList.add('vis'));
          }
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach(el => obs.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const u = localStorage.getItem('alphaUser');
    if (u) { 
      currentUser = JSON.parse(u); 
      updateNavUser(); 
      fetchMe(); // Refresh data from server
    }
    updateBadge();
    fetchProducts();
    fetchKits();
    observeReveal();

    // Recover last order for print if visible
    const savedOrder = sessionStorage.getItem('alphaLastOrder');
    if (savedOrder) {
      lastOrder = JSON.parse(savedOrder);
      const succEl = document.getElementById('page-orderSuccess');
      if (succEl && succEl.classList.contains('active')) {
        document.getElementById('orderNum').textContent = lastOrder.orderNum;
        succEl.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach(el => el.classList.add('visible'));
      }
    }
    // Handle hash routing on load
    const h = window.location.hash.substring(1);
    if (h) setTimeout(() => showPage(h, false), 100);
  });

  async function fetchMe() {
    try {
      const data = await apiReq('/users/me');
      currentUser = { ...currentUser, ...data };
      localStorage.setItem('alphaUser', JSON.stringify(currentUser));
      updateNavUser();
      // If we are currently on the profile page, refresh it
      if (document.getElementById('page-profile').classList.contains('active')) {
        renderProfile();
      }
    } catch (e) {
      console.error('Failed to sync user profile');
    }
  }

})();