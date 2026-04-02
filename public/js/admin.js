/**
 * Admin Panel JavaScript
 * Handles: Auth check, PR item CRUD, form toggle
 */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('adminToken');
}

function getAuthHeaders() {
  return { 'Authorization': `Bearer ${getToken()}` };
}

// ─── AUTH CHECK (redirect if no token) ──────────────────────────────────────
(function checkAuth() {
  if (!window.location.pathname.includes('/login') && !getToken()) {
    window.location.href = '/admin/login';
  }
})();

// ─── LOGIN PAGE ──────────────────────────────────────────────────────────────
(function loginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.textContent = 'กำลังเข้าสู่ระบบ...';
    errorEl.style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('adminToken', data.token);
        window.location.href = '/admin';
      } else {
        errorEl.textContent = data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> เข้าสู่ระบบ`;
    }
  });
})();

// ─── DASHBOARD PAGE ──────────────────────────────────────────────────────────
(function dashboardPage() {
  if (!document.querySelector('.admin-layout')) return;

  // 1. TABS NAVIGATION
  const navBtns = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.admin-panel');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.add('hide'));
      
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.remove('hide');
    });
  });

  // 2. PR PANEL LOGIC
  const prTbody = document.getElementById('pr-tbody');
  const prAddBtn = document.getElementById('pr-add-btn');
  const prFormContainer = document.getElementById('pr-form-container');
  const prCancelBtn = document.getElementById('pr-cancel-btn');
  const prForm = document.getElementById('pr-form');
  const prCategory = document.getElementById('pr-category');
  const prDeptGroup = document.getElementById('pr-department-group');
  let allPR = [];

  prCategory.addEventListener('change', (e) => {
    if (e.target.value === 'ประกาศ') {
      prDeptGroup.classList.remove('hide');
    } else {
      prDeptGroup.classList.add('hide');
      document.getElementById('pr-departmentTag').value = '';
    }
  });

  prAddBtn.addEventListener('click', () => {
    prForm.reset();
    document.getElementById('pr-id').value = '';
    prFormContainer.classList.remove('hide');
    prAddBtn.style.display = 'none';
  });

  prCancelBtn.addEventListener('click', () => {
    prFormContainer.classList.add('hide');
    prAddBtn.style.display = 'inline-flex';
  });

  async function loadPR() {
    try {
      const res = await fetch(`${API_BASE}/pr`, { headers: getAuthHeaders() });
      if (res.status === 401) return window.location.href = '/admin/login';
      allPR = await res.json();
      renderPR(allPR);
    } catch (e) {
      prTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading PR items</td></tr>';
    }
  }

  function renderPR(items) {
    if (items.length === 0) {
      prTbody.innerHTML = '<tr><td colspan="4" class="table-empty">ไม่มีรายการข้อมูล</td></tr>';
      return;
    }
    prTbody.innerHTML = items.map(item => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <img src="${item.image || 'https://placehold.co/40x40/f1f5f9/94a3b8?text=IMG'}" alt="" class="table-thumb" onerror="this.src='https://placehold.co/40x40/f1f5f9/94a3b8?text=IMG'">
            <span style="font-weight:600;">${escapeHtml(item.title)}</span>
          </div>
        </td>
        <td>
          <span class="badge ${item.category === 'ประกาศ' ? 'badge-blue' : 'badge-green'}">${escapeHtml(item.category)}</span>
          ${item.departmentTag ? `<span class="badge" style="background:#fef3c7;color:#d97706;border:1px solid #fde68a;margin-left:0.25rem;">${escapeHtml(item.departmentTag)}</span>` : ''}
          ${item.isPinned ? `<span class="badge" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;margin-left:0.25rem;">📌 Pinned</span>` : ''}
        </td>
        <td style="color:var(--color-text-secondary)">${escapeHtml(item.date)}</td>
        <td>
          <div style="display:flex;gap:0.25rem;justify-content:flex-end;">
            <button class="icon-btn" onclick="togglePin('${item.id}')" title="ปักหมุด" style="color: ${item.isPinned ? '#dc2626' : 'inherit'}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${item.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
            </button>
            <button class="icon-btn" onclick="editPR('${item.id}')" title="แก้ไข">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" onclick="deletePR('${item.id}')" title="ลบ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.editPR = (id) => {
    const item = allPR.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('pr-id').value = item.id;
    document.getElementById('pr-title').value = item.title;
    document.getElementById('pr-category').value = item.category;
    document.getElementById('pr-departmentTag').value = item.departmentTag || '';
    document.getElementById('pr-date').value = item.date;
    document.getElementById('pr-content').value = item.content || '';
    
    if (item.category === 'ประกาศ') {
      prDeptGroup.classList.remove('hide');
    } else {
      prDeptGroup.classList.add('hide');
    }

    // Notice we clear file input when editing so logic is if files selected, upload, else keep old.
    document.getElementById('pr-images').value = '';
    
    document.getElementById('pr-form-title').textContent = 'แก้ไขรายการ';
    prFormContainer.classList.remove('hide');
    prAddBtn.style.display = 'none';
    
    // scroll to form
    prFormContainer.scrollIntoView({ behavior: 'smooth' });
  };

  prForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = prForm.querySelector('button[type="submit"]');
    const id = document.getElementById('pr-id').value;
    const isEdit = !!id;
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    
    try {
      const formData = new FormData(prForm);
      const url = isEdit ? `${API_BASE}/pr/${id}` : `${API_BASE}/pr`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: formData });
      if (res.ok) {
        await loadPR();
        prCancelBtn.click();
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      alert('Error saving');
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึกข้อมูล';
    }
  });

  window.deletePR = async (id) => {
    if (!confirm('ยืนยันลบรายการข่าวนี้?')) return;
    try {
      const res = await fetch(`${API_BASE}/pr/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) loadPR();
    } catch (err) { alert('Error deleting PR'); }
  };

  window.togglePin = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/pr/${id}/pin`, { method: 'PATCH', headers: getAuthHeaders() });
      if (res.ok) {
        await loadPR();
      } else {
        const data = await res.json();
        alert(data.message || 'ไม่สามารถปักหมุดได้');
      }
    } catch (err) { alert('Error toggling pin'); }
  };


  // 3. DOCUMENTS PANEL LOGIC
  const docsTbody = document.getElementById('docs-tbody');
  const docAddBtn = document.getElementById('doc-add-btn');
  const docFormContainer = document.getElementById('doc-form-container');
  const docCancelBtn = document.getElementById('doc-cancel-btn');
  const docForm = document.getElementById('doc-form');
  let allDocs = [];

  docAddBtn.addEventListener('click', () => {
    docForm.reset();
    docFormContainer.classList.remove('hide');
    docAddBtn.style.display = 'none';
  });

  docCancelBtn.addEventListener('click', () => {
    docFormContainer.classList.add('hide');
    docAddBtn.style.display = 'inline-flex';
  });

  async function loadDocs() {
    try {
      const res = await fetch(`${API_BASE}/docs`, { headers: getAuthHeaders() });
      allDocs = await res.json();
      renderDocs(allDocs);
    } catch (e) {
      docsTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading documents</td></tr>';
    }
  }

  function renderDocs(items) {
    if (items.length === 0) {
      docsTbody.innerHTML = '<tr><td colspan="4" class="table-empty">ไม่มีรายการเอกสาร</td></tr>';
      return;
    }
    docsTbody.innerHTML = items.map(item => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <div style="width:34px;height:34px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#d97706;flex-shrink:0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <a href="${item.fileUrl}" target="_blank" style="font-weight:600;color:var(--color-text-primary);text-decoration:none;">${escapeHtml(item.title)}</a>
          </div>
        </td>
        <td>
          <span class="badge ${item.type === 'bidding' ? 'badge-orange' : 'badge-purple'}">${item.type === 'bidding' ? 'ประกวดราคา' : 'เอกสารทั่วไป'}</span>
        </td>
        <td style="color:var(--color-text-secondary)">${escapeHtml(item.date)}</td>
        <td>
          <div style="display:flex;gap:0.25rem;justify-content:flex-end;">
            <button class="icon-btn danger" onclick="deleteDoc('${item.id}')" title="ลบ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  docForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = docForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    
    try {
      const formData = new FormData(docForm);
      const res = await fetch(`${API_BASE}/docs`, { method: 'POST', headers: getAuthHeaders(), body: formData });
      if (res.ok) {
        await loadDocs();
        docCancelBtn.click();
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกเอกสาร');
      }
    } catch (err) {
      alert('Error saving document');
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึกข้อมูล';
    }
  });

  window.deleteDoc = async (id) => {
    if (!confirm('ยืนยันลบเอกสารนี้?')) return;
    try {
      const res = await fetch(`${API_BASE}/docs/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) loadDocs();
    } catch (err) { alert('Error deleting document'); }
  };


  // 4. PERSONNEL PANEL LOGIC
  const pnTbody = document.getElementById('personnel-tbody');
  const pnAddBtn = document.getElementById('personnel-add-btn');
  const pnFormContainer = document.getElementById('personnel-form-container');
  const pnCancelBtn = document.getElementById('personnel-cancel-btn');
  const pnForm = document.getElementById('personnel-form');
  
  const pnImportBtn = document.getElementById('personnel-import-btn');
  const pnImportContainer = document.getElementById('personnel-import-container');
  const pnImportCancelBtn = document.getElementById('personnel-import-cancel-btn');
  const pnImportForm = document.getElementById('personnel-import-form');
  
  let allPersonnel = [];

  pnAddBtn.addEventListener('click', () => {
    pnForm.reset();
    document.getElementById('personnel-id').value = '';
    pnFormContainer.classList.remove('hide');
    pnImportContainer.classList.add('hide');
  });

  pnCancelBtn.addEventListener('click', () => pnFormContainer.classList.add('hide'));

  pnImportBtn.addEventListener('click', () => {
    pnImportForm.reset();
    pnImportContainer.classList.remove('hide');
    pnFormContainer.classList.add('hide');
  });
  
  pnImportCancelBtn.addEventListener('click', () => pnImportContainer.classList.add('hide'));

  async function loadPersonnel() {
    try {
      const res = await fetch(`${API_BASE}/personnel`, { headers: getAuthHeaders() });
      allPersonnel = await res.json();
      renderPersonnel(allPersonnel);
    } catch (e) {
      pnTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading personnel</td></tr>';
    }
  }

  function renderPersonnel(items) {
    if (items.length === 0) {
      pnTbody.innerHTML = '<tr><td colspan="4" class="table-empty">ไม่มีรายชื่อบุคลากร</td></tr>';
      return;
    }
    pnTbody.innerHTML = items.map(item => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <img src="${item.imageUrl || 'https://placehold.co/40x40/f1f5f9/94a3b8?text=USR'}" alt="" class="table-thumb" onerror="this.src='https://placehold.co/40x40/f1f5f9/94a3b8?text=USR'" style="border-radius:50%">
            <span style="font-weight:600;">${escapeHtml(item.prefix || '')} ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</span>
          </div>
        </td>
        <td>${escapeHtml(item.position || '-')}</td>
        <td>${escapeHtml(item.phone || '-')}</td>
        <td>
          <div style="display:flex;gap:0.25rem;justify-content:flex-end;">
            <button class="icon-btn" onclick="editPersonnel('${item.id}')" title="แก้ไข">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" onclick="deletePersonnel('${item.id}')" title="ลบ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.editPersonnel = (id) => {
    const item = allPersonnel.find(i => i.id === id);
    if (!item) return;

    document.getElementById('personnel-id').value = item.id;
    document.getElementById('personnel-prefix').value = item.prefix || '';
    document.getElementById('personnel-firstName').value = item.firstName;
    document.getElementById('personnel-lastName').value = item.lastName;
    document.getElementById('personnel-position').value = item.position || '';
    document.getElementById('personnel-phone').value = item.phone || '';
    document.getElementById('personnel-order').value = item.order || 0;
    
    // Parse duties array back to comma separated
    let dutiesStr = '';
    try {
      const dArr = JSON.parse(item.duties);
      dutiesStr = Array.isArray(dArr) ? dArr.join(', ') : '';
    } catch { dutiesStr = item.duties || ''; }
    document.getElementById('personnel-duties').value = dutiesStr;
    
    document.getElementById('personnel-image').value = ''; // clear input
    
    document.getElementById('personnel-form-title').textContent = 'แก้ไขบุคลากร';
    
    pnFormContainer.classList.remove('hide');
    pnImportContainer.classList.add('hide');
    pnFormContainer.scrollIntoView({ behavior: 'smooth' });
  };

  pnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = pnForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      const formData = new FormData(pnForm);
      const id = document.getElementById('personnel-id').value;
      const url = id ? `${API_BASE}/personnel/${id}` : `${API_BASE}/personnel`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getAuthHeaders(), body: formData });
      if (res.ok) {
        await loadPersonnel();
        pnCancelBtn.click();
      } else alert('บันทึกบุคลากรไม่สำเร็จ');
    } catch { alert('Error saving personnel'); }
    finally { btn.disabled = false; btn.textContent = 'บันทึกข้อมูล'; }
  });

  window.deletePersonnel = async (id) => {
    if (!confirm('ยืนยันลบรายชื่อบุคลากรนี้?')) return;
    try {
      const res = await fetch(`${API_BASE}/personnel/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) loadPersonnel();
    } catch (err) { alert('Error deleting personnel'); }
  };

  pnImportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = pnImportForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'กําลังนำเข้า...';
    try {
      const formData = new FormData(pnImportForm);
      const res = await fetch(`${API_BASE}/personnel/import`, { method: 'POST', headers: getAuthHeaders(), body: formData });
      if (res.ok) {
        const d = await res.json();
        alert(d.message);
        await loadPersonnel();
        pnImportCancelBtn.click();
      } else alert('นำเข้าข้อมูลล้มเหลว ตรวจสอบรูปแบบไฟล์อีกครั้ง');
    } catch { alert('Error importing file'); }
    finally { btn.disabled = false; btn.textContent = 'เริ่มนำเข้า'; }
  });

  // Init loads
  loadPR();
  loadPersonnel();
  loadDocs();
  
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  });
})();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}
