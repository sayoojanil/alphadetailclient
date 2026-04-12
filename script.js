(function () {
  'use strict';

  // const API_BASE = 'http://localhost:5000/api';
  const API_BASE = 'https://alphadetailserver.vercel.app/api';


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
  window.showPage = function (id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById('page-' + id);
    if (pg) { pg.classList.add('active'); window.scrollTo(0, 0); }
    document.querySelectorAll('.nav-item[data-pg]').forEach(n => n.classList.remove('act'));
    const an = document.querySelector(`.nav-item[data-pg="${id}"]`);
    if (an) an.classList.add('act');
    if (id === 'shop') renderShop(filteredProds);
    if (id === 'cart') renderCart();
    if (id === 'checkout') initCheckout();
    if (id === 'home') renderFeatured();
    if (id === 'profile') renderProfile();
  };

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
    const feat = PRODS.slice(0, 3);
    el.innerHTML = feat.map(p => `
    <div class="hf-card reveal" onclick="openPD('${p.id}')">
      <div class="hf-img">${makeImgHTML(p.id, p.name, 'width:100%;height:100%;object-fit:cover;transition:transform .6s;')}<div class="hf-ov"></div></div>
      <div class="hf-body"><div class="hf-code">${p.code}</div><div class="hf-name">${p.name}</div><div class="hf-price">₹${p.price.toLocaleString('en-IN')}</div></div>
    </div>`).join('');
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
          <button class="pc-atc" ${p.inStock === false ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="addToCart('${p.id}')">${p.inStock === false ? 'Sold Out' : '+ Add to Cart'}</button>
        </div>
        <div class="pc-tags">${(p.tags || []).map((t, i) => `<span class="tag${i < 1 ? ' tag-g' : ''}">${t}</span>`).join('')}</div>
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
      addBtn.onclick = () => { addToCart(p.id); };
    }

    document.getElementById('pdUsage').innerHTML = (p.howToUse && p.howToUse.length > 0) ?
      `<div class="usage-steps">${p.howToUse.map((s, i) => `<div class="usage-step"><div class="us-num">STEP ${i + 1}</div><div class="us-text">${s}</div></div>`).join('')}</div>` :
      '<p>Detailed instructions coming soon.</p>';

    showPage('product');
  };

  // ══ CART ══
  window.addToCart = function (id) {
    const p = PRODS.find(x => x.id === id);
    if (!p) return;
    if (p.inStock === false) {
      return toast(p.name + ' is Out of Stock', { type: 'error', icon: 'fa-solid fa-circle-xmark' });
    }
    const ex = cart.find(c => c.id === id);
    if (ex) {
      ex.qty++;
    } else {
      cart.push({ id: p.id, name: p.name, sub: p.sub, price: p.price, img: p.id, qty: 1 });
    }
    updateBadge();
    toast(p.name + ' added to cart', {
      type: 'success', icon: 'fa-solid fa-circle-check',
      action: { label: 'View Cart →', onClick: "showPage('cart')" }
    });
  };

  window.addBundleToCart = function (type) {
    let bundleItems = [];
    if (type === 'starter') {
      bundleItems = ['nano', 'gleam', 'cabin', 'surface'];
      cartBundleDiscount = 0.05;
      cartBundleLabel = 'Starter Kit Discount (5%)';
    } else if (type === 'pro') {
      bundleItems = PRODS.map(p => p.id);
      cartBundleDiscount = 0.10;
      cartBundleLabel = 'Pro Kit Discount (10%)';
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
  function getShipping() {
    if (isProKitCart()) return 0;
    const qty = cart.reduce((s, c) => s + c.qty, 0);
    return qty * 40;
  }
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
      list.innerHTML = cart.map(c => `
      <div class="cart-row">
        <div class="ci-prod"><div class="ci-img-ph">${makeImgHTML(c.id, '')}</div><div><div class="ci-name">${c.name}</div><div class="ci-sub">${c.sub}</div></div></div>
        <div class="ci-pval">₹${c.price.toLocaleString('en-IN')}</div>
        <div><div class="qty-ctrl"><button class="qty-b" onclick="changeQty('${c.id}',-1)">−</button><input class="qty-n" value="${c.qty}" readonly><button class="qty-b" onclick="changeQty('${c.id}',1)">+</button></div></div>
        <div class="ci-tval">₹${(c.price * c.qty).toLocaleString('en-IN')}</div>
        <div class="ci-remove"><button class="rm-btn" onclick="removeFromCart('${c.id}')"><i class="fa-solid fa-trash-can"></i></button></div>
      </div>`).join('');
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

      if (orders.length === 0) {
        list.innerHTML = `<div class="cart-empty" style="padding:40px 0;"><div class="ce-icon" style="font-size:30px;"><i class="fa-solid fa-box-open"></i></div><div class="ce-title" style="font-size:18px;">No orders yet</div><button class="btn-o" onclick="showPage('shop')">Start Shopping</button></div>`;
        return;
      }

      const groups = {
        'upi': { name: 'UPI PAYMENTS', icon: 'fa-mobile-screen-button', list: [] },
        'nb': { name: 'NET BANKING', icon: 'fa-building-columns', list: [] },
        'card': { name: 'CARD PAYMENTS', icon: 'fa-credit-card', list: [] },
        'cod': { name: 'CASH ON DELIVERY', icon: 'fa-money-bill-wave', list: [] },
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

        return `
        <div class="prof-order-item">
          <div class="poi-head">
            <div class="poi-num">Order #${o.orderNum}</div>
            <div class="poi-date">${new Date(o.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
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

          <div class="poi-items">
            ${o.items.map(i => `<div class="poi-item"><span>${i.name} x ${i.qty}</span><span>₹${(i.price * i.qty).toLocaleString('en-IN')}</span></div>`).join('')}
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

  window.placeOrder = async function () {
    if (!currentUser) {
      redirectAfterAuth = 'checkout';
      showPage('login');
      toast('Please sign in to place your order', { type: 'info', icon: 'fa-solid fa-user-lock' });
      return;
    }

    if (!validateCheckoutData()) return;

    const sub = getSubtotal(), total = getFinalTotal();
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

    // Detect Method

    const method = document.querySelector('input[name="pm"]:checked')?.parentElement?.id?.split('-')[1] || 'cod';

    if (method === 'cod') {
      return saveOrder(null, null, null, 'cod', 'pending', addr);
    }

    const finalMethod = method; // Use original detected method (upi, nb, card)

    // Razorpay Order Creation
    try {
      const rOrder = await apiReq('/payments/create-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: Number(total),
          customer: { name: addr.first, email: addr.email, phone: addr.phone }
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
          // Modal is hidden as soon as this is called
          toggleLoader(true);
          apiReq('/payments/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resp)
          }).then(v => {
            if (v.success) {
              saveOrder(null, rOrder.id, resp.razorpay_payment_id, finalMethod, 'paid', addr);
            } else {
              toggleLoader(false);
              toast('Payment verification failed. Please contact support.', { type: 'error' });
            }
          }).catch(err => {
            toggleLoader(false);
            toast('Verification error: ' + err.message, { type: 'error' });
          });
        },
        modal: {
          ondismiss: function () {
            toggleLoader(false);
            toast('Payment cancelled', { type: 'info' });
          }
        },
        prefill: { name: addr.first, email: addr.email, contact: addr.phone },
        theme: { color: "#d4af37" }
      };
      const rzp = new Razorpay(opt);
      rzp.open();
      // Modal covers the screen now, don't hide loader yet as it looks weird flickering
      setTimeout(() => toggleLoader(false), 2000);
    } catch (e) {
      toggleLoader(false);
      console.error('Payment Error:', e);
      toast('Payment initialization failed: ' + e.message, { type: 'error', icon: 'fa-solid fa-circle-exclamation' });
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
    window.open(waLink, '_blank');

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




    // Save order, clear cart, and show success page
    showPage('checkout');
    saveOrder(orderNum, null, null, 'whatsapp', 'pending', addrObj);
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
      document.getElementById('chkContent').style.display = 'none';
      document.getElementById('orderSuccess').style.display = 'block';
      window.scrollTo(0, 0);
    } catch (err) {
      toast('Failed to save order. But payment was successful. Please contact support with ID: ' + rPayId, { type: 'error' });
    } finally {
      toggleLoader(false);
    }
    document.getElementById('orderNum').textContent = orderNum;

    // Set WhatsApp status button
    const waBtn = document.getElementById('waSuccessBtn');
    if (waBtn) {
      const waText = encodeURIComponent(`Hi Alpha Detail, I've placed an order (ID: ${orderNum}). Could you please confirm the shipping status?`);
      waBtn.onclick = () => window.open(`https://wa.me/${BUSINESS_PHONE}?text=${waText}`, '_blank');
    }

    toast('Order placed successfully!', { type: 'success', icon: 'fa-solid fa-circle-check' });
    // Persist for page refresh
    sessionStorage.setItem('alphaLastOrder', JSON.stringify(lastOrder));
  }

  window.printOrder = function () {
    if (!lastOrder) return toast('No order details found to print', { type: 'error' });

    const w = window.open('', '_blank');
    const itemsHTML = lastOrder.items.map(i => `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
      <div style="display:flex; align-items:center; gap:15px;">
        <div style="width:50px; height:50px; background:#f0f0f0;">${makeImgHTML(i.id, i.name, 'width:100%;height:100%;object-fit:cover;')}</div>
        <div>
          <div style="font-weight:bold; font-size:14px;">${i.name}</div>
          <div style="font-size:12px; color:#666;">Quantity: ${i.qty}</div>
        </div>
      </div>
      <div style="font-weight:bold;">₹${(i.price * i.qty).toLocaleString('en-IN')}</div>
    </div>
  `).join('');

    const html = `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>Invoice | AlphaDetail Car Care</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: #e9eef3;
      font-family: 'Inter', 'Segoe UI', 'Roboto', system-ui, -apple-system, 'BlinkMacSystemFont', sans-serif;
      padding: 2rem 1rem;
      color: #1a2c3e;
    }

    /* main invoice card */
    .invoice-container {
      max-width: 1100px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 28px;
      box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.02);
      overflow: hidden;
      transition: all 0.2s ease;
    }

    /* inner content with generous padding */
    .invoice-inner {
      padding: 2rem 2.2rem 2.2rem 2.2rem;
    }

    /* header area: refined brand and invoice badge */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
      padding-bottom: 1.8rem;
      margin-bottom: 2rem;
      border-bottom: 2px solid #f0f2f5;
    }

    .brand-section {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .brand-name {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #1f2e3a 0%, #2c3e4e 100%);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      line-height: 1.2;
    }

    .brand-tagline {
      font-size: 0.8rem;
      font-weight: 500;
      color: #5d6f7f;
      letter-spacing: 0.3px;
    }

    .invoice-meta {
      text-align: right;
      background: #f8fafc;
      padding: 0.9rem 1.4rem;
      border-radius: 24px;
    }

    .invoice-badge {
      font-size: 1.5rem;
      font-weight: 800;
      color: #1f5e3a;
      letter-spacing: 1px;
      margin-bottom: 0.3rem;
    }

    .meta-detail {
      font-size: 0.85rem;
      color: #2c3e4e;
      font-weight: 500;
    }

    /* 2 column grids */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2.2rem;
    }

    .info-card {
      background: #fbfdff;
      border-radius: 20px;
      padding: 0.2rem 0;
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #4f7a5c;
      margin-bottom: 1rem;
      border-left: 3px solid #4f7a5c;
      padding-left: 0.75rem;
    }

    .info-content {
      font-size: 0.9rem;
      line-height: 1.5;
      color: #1e2f3c;
    }

    .info-content strong {
      font-weight: 700;
      color: #0f2c38;
    }

    .info-content p {
      margin-top: 0.2rem;
    }

    /* items table - clean and professional */
    .items-section {
      margin: 2rem 0 1.8rem;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .items-table th {
      text-align: left;
      padding: 1rem 0.8rem;
      background-color: #f4f7fb;
      font-weight: 600;
      color: #1f4d3a;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.8rem;
      letter-spacing: 0.3px;
    }

    .items-table td {
      padding: 1rem 0.8rem;
      border-bottom: 1px solid #edf2f7;
      vertical-align: top;
      color: #2d3e50;
    }

    .items-table tr:last-child td {
      border-bottom: none;
    }

    .product-name {
      font-weight: 600;
      color: #1e293b;
    }

    .product-sku {
      font-size: 0.7rem;
      color: #6c869a;
      margin-top: 4px;
    }

    .text-right {
      text-align: right;
    }

    /* totals panel - modern and airy */
    .totals-panel {
      margin-top: 1.5rem;
      display: flex;
      justify-content: flex-end;
    }

    .totals-card {
      width: 320px;
      background: #fefefe;
      border-radius: 24px;
      padding: 1.2rem 1.6rem;
      border: 1px solid #eef2f8;
      box-shadow: 0 6px 12px -8px rgba(0, 0, 0, 0.05);
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      margin-bottom: 0.7rem;
      color: #2c4b3e;
    }

    .totals-row.discount-row {
      color: #2b7a4b;
      font-weight: 500;
    }

    .grand-total-row {
      display: flex;
      justify-content: space-between;
      font-weight: 800;
      font-size: 1.2rem;
      margin-top: 0.9rem;
      padding-top: 0.9rem;
      border-top: 2px solid #e2edf2;
      color: #1f3b2c;
    }

    .payment-status {
      display: inline-block;
      background: #eef6ef;
      padding: 0.2rem 0.7rem;
      border-radius: 50px;
      font-size: 0.7rem;
      font-weight: 700;
      color: #1e6f3f;
    }

    .payment-status.paid {
      background: #e0f2e6;
      color: #106a3b;
    }

    /* thank you footer */
    .footer-thanks {
      margin-top: 2.5rem;
      text-align: center;
      padding-top: 1.2rem;
      border-top: 1px solid #eef2f8;
      font-size: 0.75rem;
      color: #6d8a9c;
      letter-spacing: 0.2px;
    }

    /* print button & print styles */
    .print-actions {
      text-align: right;
      margin-top: 1.2rem;
      padding: 0 0 1rem 0;
    }

    .btn-print {
      background: #2c3e4e;
      border: none;
      padding: 0.7rem 1.8rem;
      border-radius: 40px;
      font-weight: 600;
      font-size: 0.8rem;
      color: white;
      cursor: pointer;
      transition: 0.2s;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
      font-family: inherit;
    }

    .btn-print:hover {
      background: #1f5e3a;
      transform: translateY(-1px);
    }

    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      .invoice-container {
        box-shadow: none;
        border-radius: 0;
        margin: 0;
        max-width: 100%;
      }
      .invoice-inner {
        padding: 0.8in;
      }
      .print-actions {
        display: none;
      }
      .btn-print {
        display: none;
      }
      .totals-card {
        box-shadow: none;
        border: 1px solid #ddd;
      }
      .items-table th {
        background: #f1f5f9;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .payment-status {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    /* responsive */
    @media (max-width: 680px) {
      .invoice-inner {
        padding: 1.2rem;
      }
      .info-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
      .totals-panel {
        justify-content: stretch;
      }
      .totals-card {
        width: 100%;
      }
      .items-table th, .items-table td {
        padding: 0.7rem 0.5rem;
      }
      .header-row {
        flex-direction: column;
        align-items: flex-start;
      }
      .invoice-meta {
        text-align: left;
        width: 100%;
      }
    }
  </style>
</head>
<body>
<div class="invoice-container">
  <div class="invoice-inner">
    <!-- HEADER: refined brand + meta -->
    <div class="header-row">
      <div class="brand-section">
        <div class="brand-name">ALPHADETAIL</div>
        <div class="brand-tagline">Precision DIY Car Care · Kerala, India</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-badge">TAX INVOICE</div>
        <div class="meta-detail"><strong>Order #ORD-${lastOrder.orderNum || '100294'}</strong></div>
        <div class="meta-detail">Issued: ${new Date(lastOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>

    <!-- CUSTOMER & SHIPPING (two column) -->
    <div class="info-grid">
      <div class="info-card">
        <div class="section-title">BILL TO</div>
        <div class="info-content">
          <strong>${lastOrder.address.first} ${lastOrder.address.last || ''}</strong><br>
          ${lastOrder.address.email}<br>
          ${lastOrder.address.phone}<br>
          ${lastOrder.address.addr ? lastOrder.address.addr : ''}<br>
          ${lastOrder.address.city ? lastOrder.address.city + ', ' : ''} ${lastOrder.address.pin || ''}
        </div>
      </div>
      <div class="info-card">
        <div class="section-title">SHIP TO</div>
        <div class="info-content">
          ${lastOrder.address.first} ${lastOrder.address.last || ''}<br>
          ${lastOrder.address.addr || '—'}<br>
          ${lastOrder.address.city || ''} ${lastOrder.address.pin ? '- ' + lastOrder.address.pin : ''}<br>
          Kerala, India
        </div>
      </div>
    </div>

    <!-- ORDER ITEMS (dynamic) -->
    <div class="items-section">
      <div class="section-title">ORDER SUMMARY</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML || `
            <tr>
              <td colspan="4" style="text-align:center; padding:2rem;">No items found</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- TOTALS + PAYMENT INFO (grid layout refined) -->
    <div class="info-grid" style="margin-bottom: 0.5rem;">
      <div class="info-card">
        <div class="section-title">PAYMENT DETAILS</div>
        <div class="info-content">
          <span style="font-weight:500;">Method:</span> ${(lastOrder.paymentMethod || 'card').toUpperCase()} 
          <span style="display:inline-block; margin-left: 0.6rem;"></span><br>
          <span style="font-weight:500;">Status:</span> 
          <span class="payment-status ${lastOrder.paymentStatus === 'paid' ? 'paid' : ''}">${(lastOrder.paymentStatus || 'pending').toUpperCase()}</span>
          <p style="margin-top: 10px; font-size:0.8rem; color:#4f6f8a;">
            ${lastOrder.paymentStatus === 'paid' ? '✓ Payment received successfully' : 'Payment confirmation pending'}
          </p>
        </div>
      </div>
      <div class="totals-panel" style="justify-content: flex-end; margin:0;">
        <div class="totals-card">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>₹${Math.round(lastOrder.subtotal || 0).toLocaleString('en-IN')}</span>
          </div>
          <div class="totals-row">
            <span>Shipping (standard)</span>
            <span>₹${Math.round(lastOrder.shipping || 0).toLocaleString('en-IN')}</span>
          </div>
          ${(lastOrder.bundleDiscount && lastOrder.bundleDiscount > 0) ? `
          <div class="totals-row discount-row">
            <span>${lastOrder.bundleLabel || 'Bundle saving'}</span>
            <span>- ₹${Math.round(lastOrder.bundleDiscount).toLocaleString('en-IN')}</span>
          </div>
          ` : ''}
          ${(lastOrder.couponDiscount && lastOrder.couponDiscount > 0) ? `
          <div class="totals-row discount-row">
            <span>Coupon discount</span>
            <span>- ₹${Math.round(lastOrder.couponDiscount).toLocaleString('en-IN')}</span>
          </div>
          ` : ''}
          <div class="grand-total-row">
            <span>Grand Total</span>
            <span>₹${Math.round(lastOrder.total || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="font-size:0.7rem; margin-top:0.7rem; text-align:center; color:#6c8d9e;">
            Inclusive of all taxes
          </div>
        </div>
      </div>
    </div>

    <!-- Additional note: professional touch -->
    <div style="background: #f9fbfd; border-radius: 20px; padding: 0.8rem 1rem; margin-top: 1rem;">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: space-between; align-items: center;">
        <div style="font-size: 0.75rem; color: #4a6f88;">
          <span style="font-weight:600;">📞 Support:</span> +91 7025225245 &nbsp;|&nbsp;
          <span style="font-weight:600;">✉️alphadetail2f@gmail.com</span>
        </div>
        <div style="font-size: 0.7rem; color: #7f9bb0;">
          GSTIN: 32ABCDE1234F1Z5
        </div>
      </div>
    </div>

    <div class="footer-thanks">
      ⚡ Thank you for choosing AlphaDetail — drive with confidence, shine with pride.<br>
      This is a digitally generated invoice and does not require a physical signature.
    </div>
  </div>

  <div class="print-actions">
    <button class="btn-print no-print" onclick="window.print();">🖨️ Print / Save as PDF</button>
  </div>
</div>

<script>
  // (optional) Auto adjust for missing bundleLabel / fallback values – but template is robust
  window.onload = function() {
    // ensure any missing label defaults if needed
    if (typeof lastOrder !== 'undefined' && lastOrder && !lastOrder.bundleLabel && lastOrder.bundleDiscount > 0) {
      // In case dynamic label missing, but we already have a fallback inside template
      // This is just a graceful client side safe check (no action required)
    }
    // Any interactive polish: nothing heavy
    console.log("Professional Invoice Ready");
    setTimeout(() => { window.print(); }, 800);
  };
</script>

</body>
</html>
  `;

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
    if (u) { currentUser = JSON.parse(u); updateNavUser(); }
    updateBadge();
    fetchProducts();
    observeReveal();

    // Recover last order for print if visible
    const savedOrder = sessionStorage.getItem('alphaLastOrder');
    if (savedOrder) {
      lastOrder = JSON.parse(savedOrder);
      if (document.getElementById('orderSuccess').style.display === 'block') {
        document.getElementById('orderNum').textContent = lastOrder.orderNum;
      }
    }
  });

})();