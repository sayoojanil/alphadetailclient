(function(){
'use strict';

// const API_BASE = 'http://localhost:5000/api';
const API_BASE = 'https://alphadetailserver.onrender.com/api';


// ══ LOADER ══
window.addEventListener('load', function(){
  setTimeout(function(){
    document.getElementById('loader').classList.add('hide');
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

// ══ API HELPERS ══
async function apiReq(path, opt = {}) {
  if (currentUser && currentUser.token) {
    opt.headers = { ...opt.headers, 'Authorization': `Bearer ${currentUser.token}` };
  }
  try {
    const res = await fetch(API_BASE + path, opt);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    toast(err.message, { type: 'error' });
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
      renderFeatured();
      renderShop(filteredProds);
    }
  } catch (e) {
    const errorHTML = `<div class="grid-loader"><div class="spinner-text" style="color:var(--red);"> Collection unavailable. Check back soon.</div></div>`;
    if (hg) hg.innerHTML = errorHTML;
    if (sg) sg.innerHTML = errorHTML;
    console.error('Failed to sync products from server');
  }
}

// ══ IMAGE HELPERS ══
function makeImgHTML(prodId, alt, style) {
  const p = PRODS.find(x => x.id === prodId);
  if (p && p.imgs && p.imgs.length > 0) {
    return `<img src="${p.imgs[0]}" alt="${alt}" style="${style||'width:100%;height:100%;object-fit:cover;'}">`;
  }
  const bg = p ? p.grad : '#1a1a1a';
  return `<div style="width:100%;height:100%;background:${bg};display:flex;align-items:center;justify-content:center;"><span style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.1);">${alt}</span></div>`;
}

// ══ PAGE ROUTING ══
window.showPage = function(id) {
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
    <div class="hf-card reveal" onclick="showPage('shop');setTimeout(()=>openPD('${p.id}'),200)">
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
      <div class="grid-loader" style="padding: 80px 0;">
        <div class="ce-icon" style="font-size: 40px; margin-bottom: 15px;"><i class="fa-solid fa-magnifying-glass"></i></div>
        <div class="ce-title" style="font-size: 20px; color: var(--muted); letter-spacing: 2px;">No Products Found</div>
        <div style="font-size: 12px; color: #555; margin-bottom: 20px;">Try adjusting your filters or search criteria.</div>
        <button class="btn-o" onclick="filterP('all', document.querySelector('.ftab'))">Clear All Filters</button>
      </div>`;
    return;
  }
  g.innerHTML = list.map(p => `
    <div class="pcard">
      <div class="pc-img" onclick="openPD('${p.id}')" style="background:${p.grad};">
        ${makeImgHTML(p.id, p.name, 'width:100%;height:100%;object-fit:cover;transition:transform .6s,filter .4s;')}
        <div class="pc-ov"></div>
        <div class="pc-badge">${p.badge || 'New'} · 473ml</div>
        <button class="pc-qv" onclick="event.stopPropagation();openPD('${p.id}')">Quick View</button>
      </div>
      <div class="pc-body">
        <div class="pc-code">${p.code || ''}</div>
        <div class="pc-name" onclick="openPD('${p.id}')">${p.name}</div>
        <div class="pc-sub">${p.sub || ''}</div>
        <div class="pc-ml">473ml</div>
        <p class="pc-hook">"${p.hook || ''}"</p>
        <div class="pc-bot">
          <div><div class="pc-mrp">MRP</div><div class="pc-price">₹${p.price.toLocaleString('en-IN')}</div></div>
          <button class="pc-atc" onclick="addToCart('${p.id}')">+ Add to Cart</button>
        </div>
        <div class="pc-tags">${(p.tags||[]).map((t,i)=>`<span class="tag${i<1?' tag-g':''}">${t}</span>`).join('')}</div>
      </div>
    </div>`).join('');
}

// ══ FILTER & SORT ══
window.filterP = function(cat, btn) {
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('act'));
  btn.classList.add('act');
  filteredProds = cat === 'all' ? [...PRODS] : PRODS.filter(p => p.cat === cat);
  renderShop(filteredProds);
};
window.sortP = function(val) {
  let list = [...filteredProds];
  if (val === 'low') list.sort((a,b) => a.price - b.price);
  if (val === 'high') list.sort((a,b) => b.price - a.price);
  renderShop(list);
};

// ══ PRODUCT DETAIL MODAL ══
window.openPD = function(id) {
  const p = PRODS.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pdCode').textContent = p.code || '';
  document.getElementById('pdName').textContent = p.name;
  document.getElementById('pdSub').textContent = p.sub || '';
  document.getElementById('pdHook').textContent = p.hook ? '"' + p.hook + '"' : '';
  document.getElementById('pdDesc').innerHTML = p.desc || '';
  document.getElementById('pdPrice').textContent = '₹' + p.price.toLocaleString('en-IN');
  document.getElementById('pdFeats').innerHTML = (p.feats||[]).map(f => `<li>${f}</li>`).join('');
  
  const mw = document.getElementById('pdMainWrap');
  mw.innerHTML = makeImgHTML(p.id, p.name);
  
  document.getElementById('pdAddBtn').onclick = () => { addToCart(p.id); closePD(); };
  document.getElementById('pdOv').classList.add('open');
  document.body.style.overflow = 'hidden';
};
window.closePD = function(e) {
  if (!e || e.target === document.getElementById('pdOv') || (e.currentTarget && e.currentTarget.classList.contains('pd-close'))) {
    document.getElementById('pdOv').classList.remove('open');
    document.body.style.overflow = '';
  }
};

// ══ CART ══
window.addToCart = function(id) {
  const p = PRODS.find(x => x.id === id);
  if (!p) return;
  const ex = cart.find(c => c.id === id);
  if (ex) ex.qty++;
  else cart.push({ id: p.id, name: p.name, sub: p.sub, price: p.price, img: p.id, qty: 1 });
  updateBadge();
  toast(p.name + ' added to cart', { 
    type: 'success', icon: 'fa-solid fa-circle-check', 
    action: { label: 'View Cart →', onClick: "showPage('cart')" } 
  });
};

window.addBundleToCart = function(type) {
  let bundleItems = [];
  if (type === 'starter') {
    bundleItems = ['nano', 'gleam', 'cabin', 'surface'];
    cartBundleDiscount = 0.05;
    cartBundleLabel = 'Starter Kit Discount (5%)';
  } else if (type === 'pro') {
    bundleItems = ['nano', 'fusion', 'gleam', 'hyper', 'cabin', 'surface', 'graphene'];
    cartBundleDiscount = 0.10;
    cartBundleLabel = 'Pro Kit Discount (10%)';
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
  } catch(e) {}
}
function getSubtotal() { return cart.reduce((s, c) => s + c.price * c.qty, 0); }
function getCouponDiscount() { return getSubtotal() * couponDiscountRate; }
function getBundleDiscount() { return getSubtotal() * cartBundleDiscount; }
function getShipping() { 
  const qty = cart.reduce((s, c) => s + c.qty, 0);
  return qty >= 2 ? 0 : (qty > 0 ? 80 : 0);
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

window.applyCoupon = function() {
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
window.doLogin = async function() {
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
    showPage(redirectAfterAuth || 'home');
  } catch (e) {
    // Error is already toasted by apiReq
    const errEl = document.getElementById('loginErr');
    if (errEl) {
      errEl.textContent = e.message;
      errEl.classList.add('show');
      setTimeout(() => errEl.classList.remove('show'), 5000);
    }
  } finally {
    if (btn) { btn.innerHTML = ogText; btn.disabled = false; }
  }
};

window.doRegister = async function() {
  const firstName = document.getElementById('rFirst').value.trim();
  const lastName = document.getElementById('rLast').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const phone = document.getElementById('rPhone').value.trim();
  const password = document.getElementById('rPass').value;
  const btn = document.getElementById('regBtn');
  const ogText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...'; btn.disabled = true; }
  
  try {
    const data = await apiReq('/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, password })
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

window.doLogout = function() {
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

  if (currentUser) {
    if (ae) ae.style.display = 'none'; 
    if (ue) ue.style.display = 'flex';
    if (ml) ml.style.display = 'none';
    if (mr) mr.style.display = 'none';
    if (mp) mp.style.display = 'block';
    if (mo) mo.style.display = 'block';

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
  if (pJoined) pJoined.textContent = new Date(currentUser.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'});

  const list = document.getElementById('profOrdersList');
  const loaderHTML = '<div class="grid-loader"><div class="spinner"></div><div class="spinner-text">Syncing History</div></div>';
  if (list) list.innerHTML = loaderHTML;

  const orders = await apiReq('/orders/my-orders');
  document.getElementById('profOrderCount').textContent = orders.length;
  if (orders.length === 0) {
    list.innerHTML = `<div class="cart-empty" style="padding:40px 0;"><div class="ce-icon" style="font-size:30px;"><i class="fa-solid fa-box-open"></i></div><div class="ce-title" style="font-size:18px;">No orders yet</div><button class="btn-o" onclick="showPage('shop')">Start Shopping</button></div>`;
  } else {
    list.innerHTML = orders.map(o => `
      <div class="prof-order-item">
        <div class="poi-head">
          <div class="poi-num">Order #${o.orderNum}</div>
          <div class="poi-date">${new Date(o.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'})}</div>
        </div>
        <div class="poi-items">
          ${o.items.map(i => `<div class="poi-item"><span>${i.name} x ${i.qty}</span><span>₹${(i.price * i.qty).toLocaleString('en-IN')}</span></div>`).join('')}
        </div>
        <div class="poi-footer">
          <div class="poi-status" style="border-color:${o.status==='delivered'?'var(--green)':'var(--gold)'};color:${o.status==='delivered'?'var(--green)':'var(--gold)'}">${o.status.toUpperCase()}</div>
          <div class="poi-total">Total: ₹${o.total.toLocaleString('en-IN')}</div>
        </div>
      </div>`).join('');
  }
}

// ══ CHECKOUT & RAZORPAY ══
window.proceedCheckout = function() {
  if (cart.length === 0) return toast('Cart is empty!', { type: 'error', icon: 'fa-solid fa-cart-shopping' });
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
  document.getElementById('osItems').innerHTML = cart.map(c => `<div class="os-item"><div>${c.name} x ${c.qty}</div><div>₹${(c.price * c.qty).toLocaleString('en-IN')}</div></div>`).join('');
}

window.selPM = function(el, method) {
  document.querySelectorAll('.pay-opt').forEach(opt => opt.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('upiF').style.display = method === 'upi' ? 'block' : 'none';
  document.getElementById('cardF').style.display = method === 'card' ? 'block' : 'none';
};

window.placeOrder = async function() {
  if (!currentUser) {
    redirectAfterAuth = 'checkout';
    showPage('login');
    toast('Please sign in to place your order', { type: 'info', icon: 'fa-solid fa-user-lock' });
    return;
  }
  const sub = getSubtotal(), total = getFinalTotal();
  const addr = {
    first: document.getElementById('cFirst').value,
    email: document.getElementById('cEmail').value,
    phone: document.getElementById('cPhone').value,
    addr: document.getElementById('cAddr').value,
    city: document.getElementById('cCity').value,
    pin: document.getElementById('cPin').value
  };

  // Detect Method
  const method = document.querySelector('input[name="pm"]:checked')?.parentElement?.id?.split('-')[1] || 'cod';

  if (method === 'cod') {
    return saveOrder(null, null, 'cod', 'pending', addr);
  }
  
  const finalMethod = (method === 'cod') ? 'cod' : 'razorpay';

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

    const opt = {
      key: rOrder.key_id, // Use the key provided by the server to ensure perfect sync
      amount: rOrder.amount,
      currency: "INR",
      name: "AlphaDetail",
      description: "Order Checkout",
      order_id: rOrder.id,
      handler: function(resp) {
        apiReq('/payments/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resp)
        }).then(v => {
          if (v.success) {
            saveOrder(rOrder.id, resp.razorpay_payment_id, finalMethod, 'paid', addr);
          }
        });
      },
      prefill: { name: addr.first, email: addr.email, contact: addr.phone },
      theme: { color: "#d4af37" }
    };
    const rzp = new Razorpay(opt);
    rzp.open();
  } catch (e) {
    console.error('Payment Error:', e);
    toast('Payment initialization failed: ' + e.message, { type: 'error', icon: 'fa-solid fa-circle-exclamation' });
  }
};

async function saveOrder(rOrderId, rPayId, method, status, addr) {
  const orderNum = 'AD' + Date.now().toString().slice(-6);
  await apiReq('/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNum, items: cart, subtotal: getSubtotal(), total: getFinalTotal(),
      paymentMethod: method, paymentStatus: status, razorpayOrderId: rOrderId, razorpayPaymentId: rPayId,
      address: addr
    })
  });
  cart = []; updateBadge();
  document.getElementById('chkContent').style.display = 'none';
  document.getElementById('orderSuccess').style.display = 'block';
  document.getElementById('orderNum').textContent = orderNum;
  toast('Order placed successfully!', { type: 'success', icon: 'fa-solid fa-circle-check' });
}

window.toast = function(msg, opt = {}) {
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
});

})();