/**
 * Admin Panel JavaScript
 * Handles: Auth check, PR item CRUD, form toggle, personnel management
 */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('adminToken');
}

function getAuthHeaders() {
  return { 'Authorization': `Bearer ${getToken()}` };
}

// ─── AUTH CHECK ──────────────────────────────────────────────────────────────
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

  // Toggle group open/closed
  window.toggleNavGroup = function(groupId) {
    const group = document.getElementById(groupId);
    if (group) group.classList.toggle('collapsed');
  };

  // Auto-expand group that contains the active button, and collapse others
  function expandGroupOfActiveBtn(activeBtn) {
    const parentGroup = activeBtn.closest('.nav-group');
    if (!parentGroup) return;
    // Expand the parent group
    parentGroup.classList.remove('collapsed');
    // Mark header as has-active
    document.querySelectorAll('.nav-group-header').forEach(h => h.classList.remove('has-active'));
    const header = parentGroup.querySelector('.nav-group-header');
    if (header) header.classList.add('has-active');
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.add('hide'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId)?.classList.remove('hide');
      expandGroupOfActiveBtn(btn);

      // Save to localStorage
      localStorage.setItem('activeAdminTab', targetId);
    });
  });

  // On load: restore saved tab or find the currently active button and expand its group
  const savedTab = localStorage.getItem('activeAdminTab');
  if (savedTab) {
    const targetBtn = document.querySelector(`.nav-btn[data-target="${savedTab}"]`);
    if (targetBtn) {
      // Trigger click to activate the panel and expand group
      targetBtn.click();
    } else {
      // Fallback to default
      const initialActive = document.querySelector('.nav-btn.active');
      if (initialActive) expandGroupOfActiveBtn(initialActive);
    }
  } else {
    const initialActive = document.querySelector('.nav-btn.active');
    if (initialActive) expandGroupOfActiveBtn(initialActive);
  }

  // 2. PR PANEL LOGIC
  const prTbody = document.getElementById('pr-tbody');
  const prAddBtn = document.getElementById('pr-add-btn');
  const prFormContainer = document.getElementById('pr-form-container');
  const prCancelBtn = document.getElementById('pr-cancel-btn');
  const prForm = document.getElementById('pr-form');
  const prCategory = document.getElementById('pr-category');
  const prDeptGroup = document.getElementById('pr-department-group');
  let allPR = [];

  prCategory?.addEventListener('change', (e) => {
    if (e.target.value === 'ประกาศ') {
      prDeptGroup?.classList.remove('hide');
    } else {
      prDeptGroup?.classList.add('hide');
      const deptTagInput = document.getElementById('pr-departmentTag');
      if (deptTagInput) deptTagInput.value = '';
    }
  });

  prAddBtn?.addEventListener('click', () => {
    prForm.reset();
    document.getElementById('pr-id').value = '';
    prFormContainer.classList.remove('hide');
    prAddBtn.style.display = 'none';
  });

  prCancelBtn?.addEventListener('click', () => {
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
      if (prTbody) prTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading PR items</td></tr>';
    }
  }

  function renderPR(items) {
    if (!prTbody) return;
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
      prDeptGroup?.classList.remove('hide');
    } else {
      prDeptGroup?.classList.add('hide');
    }

    const imgInput = document.getElementById('pr-images');
    if (imgInput) imgInput.value = '';
    
    document.getElementById('pr-form-title').textContent = 'แก้ไขรายการ';
    prFormContainer.classList.remove('hide');
    prAddBtn.style.display = 'none';
    prFormContainer.scrollIntoView({ behavior: 'smooth' });
  };

  prForm?.addEventListener('submit', async (e) => {
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
        const errData = await res.json().catch(() => ({}));
        alert(`บันทึกข้อมูลไม่สำเร็จ: ${errData.message || 'Unknown error'}`);
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

  docAddBtn?.addEventListener('click', () => {
    docForm.reset();
    document.getElementById('doc-id').value = '';
    document.getElementById('doc-form-title').textContent = 'เพิ่มเอกสารใหม่';
    document.getElementById('doc-file').required = true;
    document.getElementById('doc-file-hint').style.display = 'none';
    docFormContainer.classList.remove('hide');
    docAddBtn.style.display = 'none';
  });

  docCancelBtn?.addEventListener('click', () => {
    docFormContainer.classList.add('hide');
    docAddBtn.style.display = 'inline-flex';
    document.getElementById('doc-id').value = '';
    document.getElementById('doc-file').required = true;
    document.getElementById('doc-file-hint').style.display = 'none';
    document.getElementById('doc-form-title').textContent = 'เพิ่มเอกสารใหม่';
  });

  async function loadDocs() {
    try {
      const res = await fetch(`${API_BASE}/docs`, { headers: getAuthHeaders() });
      allDocs = await res.json();
      renderDocs(allDocs);
    } catch (e) {
      if (docsTbody) docsTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading documents</td></tr>';
    }
  }

  function renderDocs(items) {
    if (!docsTbody) return;
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
            <button class="icon-btn" onclick="editDoc('${item.id}')" title="แก้ไข">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" onclick="deleteDoc('${item.id}')" title="ลบ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.editDoc = (id) => {
    const item = allDocs.find(d => d.id === id);
    if (!item) return;
    document.getElementById('doc-id').value = item.id;
    document.getElementById('doc-title').value = item.title;
    document.getElementById('doc-type').value = item.type;
    document.getElementById('doc-date').value = item.date;
    // Reset file input (optional for edit)
    document.getElementById('doc-file').value = '';
    document.getElementById('doc-file').required = false;
    document.getElementById('doc-file-hint').style.display = 'block';
    document.getElementById('doc-form-title').textContent = 'แก้ไขเอกสาร';
    docFormContainer.classList.remove('hide');
    docAddBtn.style.display = 'none';
    docFormContainer.scrollIntoView({ behavior: 'smooth' });
  };

  docForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = docForm.querySelector('button[type="submit"]');
    const docId = document.getElementById('doc-id').value;
    const isEdit = !!docId;
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      const formData = new FormData(docForm);
      const url = isEdit ? `${API_BASE}/docs/${docId}` : `${API_BASE}/docs`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: formData });
      if (res.ok) {
        await loadDocs();
        docCancelBtn.click();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`บันทึกเอกสารไม่สำเร็จ: ${errData.message || 'Unknown error'}`);
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
  const pnCancelBtn = document.getElementById('personnel-cancel-btn');
  const pnForm = document.getElementById('personnel-form');
  
  const pnImportBtn = document.getElementById('personnel-import-btn');
  const pnImportContainer = document.getElementById('personnel-import-container');
  const pnImportCancelBtn = document.getElementById('personnel-import-cancel-btn');
  const pnImportForm = document.getElementById('personnel-import-form');
  const pnBulkDeleteBtn = document.getElementById('personnel-bulk-delete-btn');
  const pnSelectAll = document.getElementById('personnel-select-all');
  const pnModal = document.getElementById('personnel-modal');
  const pnModalCloseIcon = document.getElementById('modal-close-icon');
  
  const dutyTagContainer = document.getElementById('duty-tag-container');
  const newDutyInput = document.getElementById('new-duty-input');
  const dutyUnifiedField = document.getElementById('duty-unified-field');
  const dutySuggestions = document.getElementById('duty-suggestions');
  
  let allPersonnel = [];
  let selectedPersonnelIds = new Set();
  let currentDuties = [];
  let allAvailableDuties = [];

  pnAddBtn?.addEventListener('click', () => {
    pnForm.reset();
    document.getElementById('personnel-id').value = '';
    document.getElementById('personnel-form-title').textContent = 'เพิ่มบุคลากรใหม่';
    currentDuties = [];
    renderDutyTags();
    pnModal.classList.add('active');
    pnImportContainer.classList.add('hide');
  });

  pnCancelBtn?.addEventListener('click', () => pnModal.classList.remove('active'));
  pnModalCloseIcon?.addEventListener('click', () => pnModal.classList.remove('active'));
  
  // Close modal when clicking outside form
  pnModal?.addEventListener('click', (e) => {
    if (e.target === pnModal) pnModal.classList.remove('active');
  });

  pnImportBtn?.addEventListener('click', () => {
    pnImportForm.reset();
    pnImportContainer.classList.remove('hide');
    pnModal.classList.remove('active');
  });
  
  pnImportCancelBtn?.addEventListener('click', () => pnImportContainer.classList.add('hide'));

  async function loadPersonnel() {
    try {
      selectedPersonnelIds.clear();
      updateBulkDeleteUI();
      if (pnSelectAll) pnSelectAll.checked = false;
      const res = await fetch(`${API_BASE}/personnel`, { headers: getAuthHeaders() });
      const data = await res.json();
      
      // Sort data to match personnel page logic
      data.sort((a, b) => {
        const getRank = (p) => {
          const pos = (p.position || '').toLowerCase();
          const acad = (p.academicStanding || '').toLowerCase();
          const text = pos + acad;
          
          // 1. Executives
          if (p.isDirector || pos.includes('ผู้อำนวยการ')) return 0;
          if (pos.includes('รองผู้อำนวยการ') || pos.includes('ผู้บริหาร')) return 1;
          
          // 2. Teachers by rank
          if (text.includes('เชี่ยวชาญพิเศษ')) return 10;
          if (text.includes('เชี่ยวชาญ')) return 11;
          if (text.includes('ชำนาญการพิเศษ')) return 12;
          if (text.includes('ชำนาญการ')) return 13;
          if (text.includes('ครูผู้ช่วย')) return 15;
          if (text.includes('ครู')) return 14;
          if (text.includes('พนักงานราชการ')) return 16;
          if (text.includes('ครูอัตราจ้าง') || text.includes('อัตราจ้าง')) return 17;
          
          // 3. Support Staff
          if (text.includes('เจ้าหน้าที่')) return 20;
          if (text.includes('ลูกจ้างอัตราจ้าง')) return 21;
          
          return 99;
        };
        
        const rankA = getRank(a);
        const rankB = getRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return (a.order || 0) - (b.order || 0) || (a.firstName || '').localeCompare(b.firstName || '', 'th');
      });

      allPersonnel = data;
      renderPersonnel(allPersonnel);
    } catch (e) {
      if (pnTbody) pnTbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error loading personnel</td></tr>';
    }
  }

  function updateBulkDeleteUI() {
    if (!pnBulkDeleteBtn) return;
    const count = selectedPersonnelIds.size;
    if (count > 0) {
      pnBulkDeleteBtn.classList.remove('hide');
      pnBulkDeleteBtn.textContent = `ลบที่เลือก (${count})`;
    } else {
      pnBulkDeleteBtn.classList.add('hide');
    }
  }

  window.togglePersonnelSelection = (id) => {
    if (selectedPersonnelIds.has(id)) {
      selectedPersonnelIds.delete(id);
    } else {
      selectedPersonnelIds.add(id);
    }
    updateBulkDeleteUI();
    if (pnSelectAll) {
      pnSelectAll.checked = allPersonnel.length > 0 && selectedPersonnelIds.size === allPersonnel.length;
    }
  };

  pnSelectAll?.addEventListener('change', () => {
    const isChecked = pnSelectAll.checked;
    if (isChecked) {
      allPersonnel.forEach(p => selectedPersonnelIds.add(p.id));
    } else {
      selectedPersonnelIds.clear();
    }
    renderPersonnel(allPersonnel);
    updateBulkDeleteUI();
  });

  function updateBulkDeleteUI() {
    if (!pnBulkDeleteBtn) return;
    const count = selectedPersonnelIds.size;
    const countSpan = document.getElementById('bulk-delete-count');

    if (count > 0) {
      pnBulkDeleteBtn.classList.remove('hide');
      pnBulkDeleteBtn.style.display = 'inline-flex';
      if (countSpan) countSpan.textContent = `(${count})`;
    } else {
      pnBulkDeleteBtn.classList.add('hide');
      pnBulkDeleteBtn.style.display = 'none';
      if (countSpan) countSpan.textContent = '';
    }
  }

  pnBulkDeleteBtn?.addEventListener('click', async () => {
    const count = selectedPersonnelIds.size;
    if (count === 0) return;
    if (!confirm(`ยืนยันลบรายชื่อที่เลือกทั้งหมด ${count} รายการ?`)) return;
    pnBulkDeleteBtn.disabled = true;
    pnBulkDeleteBtn.textContent = 'กำลังลบ...';
    try {
      const res = await fetch(`${API_BASE}/personnel/bulk`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedPersonnelIds) })
      });
      if (res.ok) {
        selectedPersonnelIds.clear(); // Clear selection after delete
        await loadPersonnel();
      } else {
        alert('ลบข้อมูลไม่สำเร็จ');
      }
    } catch (err) {
      alert('Error during bulk delete');
    } finally {
      pnBulkDeleteBtn.disabled = false;
      updateBulkDeleteUI();
    }
  });

  function renderPersonnel(items) {
    if (!pnTbody) return;
    if (items.length === 0) {
      pnTbody.innerHTML = '<tr><td colspan="6" class="table-empty">ไม่มีรายชื่อบุคลากร</td></tr>';
      return;
    }
    pnTbody.innerHTML = items.map((item, idx) => {
      const isSelected = selectedPersonnelIds.has(item.id);
      return `
      <tr class="${isSelected ? 'selected-item' : ''}">
        <td style="text-align:center;font-weight:600;color:var(--color-text-secondary);">${idx + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <img src="${item.imageUrl || 'https://placehold.co/40x40/f1f5f9/94a3b8?text=USR'}" alt="" class="table-thumb" style="border-radius:50%">
            <div>
              <div style="font-weight:600;">${escapeHtml(item.prefix || '')} ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</div>
              ${item.phone ? `<div style="font-size:0.8rem;color:var(--color-text-secondary)">📞 ${escapeHtml(item.phone)}</div>` : ''}
              ${item.email ? `<div style="font-size:0.8rem;color:var(--color-text-secondary)">📧 ${escapeHtml(item.email)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:500;">${escapeHtml(item.position || '-')}</div>
          <div style="font-size:0.85rem;color:var(--color-accent-primary)">${escapeHtml(item.academicStanding || '')}</div>
        </td>
        <td>
          <div style="font-size:0.9rem;">${escapeHtml(item.department || '-')}</div>
          <div style="font-size:0.8rem;color:var(--color-text-secondary)">${escapeHtml(item.positionNumber || '')}</div>
        </td>
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
        <td style="text-align:center;">
          <input type="checkbox" onclick="togglePersonnelSelection('${item.id}')" ${isSelected ? 'checked' : ''} />
        </td>
      </tr>`;
    }).join('');
  }

  window.editPersonnel = (id) => {
    const item = allPersonnel.find(i => i.id === id);
    if (!item) return;

    document.getElementById('personnel-id').value = item.id;
    document.getElementById('personnel-prefix').value = item.prefix || '';
    document.getElementById('personnel-firstName').value = item.firstName;
    document.getElementById('personnel-lastName').value = item.lastName;
    document.getElementById('personnel-position').value = item.position || '';
    document.getElementById('personnel-academicStanding').value = item.academicStanding || '';
    document.getElementById('personnel-positionNumber').value = item.positionNumber || '';
    document.getElementById('personnel-department').value = item.department || '';
    document.getElementById('personnel-phone').value = item.phone || '';
    document.getElementById('personnel-email').value = item.email || '';
    document.getElementById('personnel-order').value = item.order || 0;
    
    try {
      const rawDuties = item.duties;
      if (Array.isArray(rawDuties)) {
        currentDuties = [...rawDuties];
      } else if (typeof rawDuties === 'string' && rawDuties.startsWith('[')) {
        currentDuties = JSON.parse(rawDuties);
      } else if (rawDuties) {
        currentDuties = [rawDuties];
      } else {
        currentDuties = [];
      }
    } catch {
      currentDuties = [];
    }
    renderDutyTags();
    
    const imgInput = document.getElementById('personnel-image');
    if (imgInput) imgInput.value = '';
    document.getElementById('personnel-form-title').textContent = 'แก้ไขข้อมูลบุคลากร';
    
    pnModal.classList.add('active');
    pnImportContainer.classList.add('hide');
  };

  pnForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = pnForm.querySelector('button[type="submit"]');
    
    // Custom Email Validation: Allow '-' or empty, but check format if filled
    const emailVal = document.getElementById('personnel-email').value.trim();
    if (emailVal && emailVal !== '-') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailVal)) {
        alert('กรุณากรอกรูปแบบอีเมลที่ถูกต้อง (หรือใส่ - หากไม่มี)');
        return;
      }
    }

    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      const formData = new FormData(pnForm);
      formData.set('duties', JSON.stringify(currentDuties));
      const id = document.getElementById('personnel-id').value;
      const url = id ? `${API_BASE}/personnel/${id}` : `${API_BASE}/personnel`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getAuthHeaders(), body: formData });
      if (res.ok) {
        await loadPersonnel();
        fetchUniqueDuties();
        pnModal.classList.remove('active');
        currentDuties = [];
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`บันทึกบุคลากรไม่สำเร็จ: ${errData.message || 'Unknown error'}${errData.error ? '\n' + errData.error : ''}`);
      }
    } catch (err) {
      alert('Error saving personnel: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึกข้อมูล';
    }
  });

  window.deletePersonnel = async (id) => {
    if (!confirm('ยืนยันลบรายชื่อบุคลากรนี้?')) return;
    try {
      const res = await fetch(`${API_BASE}/personnel/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) loadPersonnel();
    } catch (err) { alert('Error deleting personnel'); }
  };

  pnImportForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = pnImportForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'กำลังนำเข้า...';
    try {
      const formData = new FormData(pnImportForm);
      const res = await fetch(`${API_BASE}/personnel/import`, { method: 'POST', headers: getAuthHeaders(), body: formData });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'นำเข้าข้อมูลสำเร็จ');
        await loadPersonnel();
        fetchUniqueDuties();
        pnImportCancelBtn.click();
      } else {
        alert(result.message || 'นำเข้าข้อมูลล้มเหลว');
      }
    } catch { alert('Error importing file'); }
    finally { btn.disabled = false; btn.textContent = 'เริ่มนำเข้า'; }
  });

  // Tag Management & Auto-Suggestion Logic
  dutyUnifiedField?.addEventListener('click', () => newDutyInput?.focus());

  async function fetchUniqueDuties() {
    try {
      const res = await fetch(`${API_BASE}/personnel/unique-duties`, { headers: getAuthHeaders() });
      if (res.ok) {
        allAvailableDuties = await res.json();
      }
    } catch (err) { console.error('Error fetching unique duties:', err); }
  }

  function showDutySuggestions(filter = '') {
    if (!dutySuggestions) return;
    const filtered = allAvailableDuties.filter(d => 
      d.toLowerCase().includes(filter.toLowerCase()) && !currentDuties.includes(d)
    );
    if (filtered.length === 0) {
      dutySuggestions.style.display = 'none';
      return;
    }
    dutySuggestions.innerHTML = filtered.map(d => `
      <div class="duty-suggestion-item" onclick="selectDutySuggestion('${escapeHtml(d)}')">
        ${escapeHtml(d)}
      </div>
    `).join('');
    dutySuggestions.style.display = 'block';
  }

  window.selectDutySuggestion = (val) => {
    if (val && !currentDuties.includes(val)) {
      currentDuties.push(val);
      if (newDutyInput) newDutyInput.value = '';
      renderDutyTags();
      dutySuggestions.style.display = 'none';
    }
  };

  const addDuty = () => {
    const val = newDutyInput?.value.trim();
    if (val && !currentDuties.includes(val)) {
      currentDuties.push(val);
      if (newDutyInput) newDutyInput.value = '';
      renderDutyTags();
      if (dutySuggestions) dutySuggestions.style.display = 'none';
    }
  };

  window.removeDuty = (index) => {
    currentDuties.splice(index, 1);
    renderDutyTags();
  };

  function renderDutyTags() {
    if (!dutyTagContainer) return;
    dutyTagContainer.innerHTML = currentDuties.map((duty, index) => `
      <div class="duty-tag">
        <span>${escapeHtml(duty)}</span>
        <div class="duty-remove-btn" onclick="event.stopPropagation(); removeDuty(${index})">&times;</div>
      </div>
    `).join('');
  }

  newDutyInput?.addEventListener('input', (e) => showDutySuggestions(e.target.value));
  newDutyInput?.addEventListener('focus', (e) => showDutySuggestions(e.target.value));
  newDutyInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDuty();
    }
  });

  document.addEventListener('click', (e) => {
    if (dutySuggestions && !e.target.closest('#duty-unified-field')) {
      dutySuggestions.style.display = 'none';
    }
  });

  // Sidebar Toggle Logic
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.getElementById('admin-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle');

  const toggleSidebar = () => {
    sidebar?.classList.toggle('active');
    overlay?.classList.toggle('active');
  };

  toggleBtn?.addEventListener('click', toggleSidebar);
  overlay?.addEventListener('click', toggleSidebar);

  // Auto-close sidebar on mobile after clicking a link
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        sidebar?.classList.remove('active');
        overlay?.classList.remove('active');
      }
    });
  });

  // 5. ITA PANEL LOGIC
  const itaTbody = document.getElementById('ita-tbody');
  const itaModal = document.getElementById('ita-modal');
  const itaForm = document.getElementById('ita-form');
  const itaInitBtn = document.getElementById('ita-init-btn');
  const itaAttachmentsList = document.getElementById('ita-attachments-list');
  const itaAddLinkBtn = document.getElementById('ita-add-link-btn');
  const itaCancelBtn = document.getElementById('ita-cancel-btn');
  const itaModalCloseIcon = document.getElementById('ita-modal-close-icon');

  let allITA = [];
  let currentItaAttachments = []; // Local state for the modal
  let itaNewLinksToAdd = []; // Separate buffer for new links

  async function loadITA() {
    try {
      const res = await fetch(`${API_BASE}/ita`, { headers: getAuthHeaders() });
      allITA = await res.json();
      renderITA(allITA);
    } catch (e) {
      if (itaTbody) itaTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading ITA data</td></tr>';
    }
  }

  function renderITA(items) {
    if (!itaTbody) return;
    if (items.length === 0) {
      itaTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;">ยังไม่เปิดใช้งานระบบ ITA <br><small>กรุณากดปุ่มรีเซ็ต/เริ่มระบบเพื่อเริ่มต้น</small></td></tr>';
      return;
    }
    itaTbody.innerHTML = items.map(item => {
      const count = (item.attachments || []).length;
      const statusHtml = count > 0 
        ? `<span class="badge badge-green">✅ เรียบร้อย (${count} รายการ)</span>` 
        : `<span class="badge" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;">⏳ ยังไม่มีข้อมูล</span>`;
      
      return `
        <tr>
          <td style="font-weight:700;color:var(--color-accent-primary);text-align:center;">${item.code}</td>
          <td>
            <div style="font-weight:600;">${escapeHtml(item.title)}</div>
            <div style="font-size:0.8rem;color:var(--color-text-secondary);margin-top:2px;">${escapeHtml(item.description || '-')}</div>
            <div style="font-size:0.75rem;color:var(--color-text-secondary);margin-top:4px;opacity:0.7">อัปเดตล่าสุด: ${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('th-TH') : '-'}</div>
          </td>
          <td>${statusHtml}</td>
          <td style="text-align:right;">
            <button class="icon-btn" onclick="editITA('${item.code}')" title="จัดการข้อมูล">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.editITA = (code) => {
    const item = allITA.find(i => i.code === code);
    if (!item) return;

    document.getElementById('ita-code').value = item.code;
    document.getElementById('ita-display-title').textContent = `${item.code}: ${item.title}`;
    document.getElementById('ita-display-desc').textContent = item.description || 'ไม่มีคำอธิบายเพิ่มเติม';
    
    currentItaAttachments = Array.isArray(item.attachments) ? [...item.attachments] : [];
    itaNewLinksToAdd = [];
    
    renderItaAttachments();
    itaModal.classList.add('active');
  };

  function renderItaAttachments() {
    if (!itaAttachmentsList) return;
    
    const allItems = [...currentItaAttachments, ...itaNewLinksToAdd];
    
    if (allItems.length === 0) {
      itaAttachmentsList.innerHTML = '<div style="color:var(--color-text-secondary);font-size:0.9rem;padding:0.5rem;border:1px dashed #ddd;border-radius:8px;text-align:center;">ยังไม่มีการแนบไฟล์หรือลิงก์</div>';
      return;
    }

    itaAttachmentsList.innerHTML = allItems.map((att, idx) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span style="font-size:1.2rem;">${att.type === 'file' ? '📄' : '🔗'}</span>
          <div>
            <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(att.label)}</div>
            <a href="${att.url}" target="_blank" style="font-size:0.75rem;color:var(--color-accent-primary);text-decoration:none;">ดูข้อมูล/ลิงก์</a>
          </div>
        </div>
        <button type="button" class="icon-btn danger" onclick="removeItaAttachment(${idx})" style="padding:4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `).join('');
  }

  window.removeItaAttachment = (idx) => {
    if (idx < currentItaAttachments.length) {
      currentItaAttachments.splice(idx, 1);
    } else {
      itaNewLinksToAdd.splice(idx - currentItaAttachments.length, 1);
    }
    renderItaAttachments();
  };

  itaAddLinkBtn?.addEventListener('click', () => {
    const label = document.getElementById('ita-new-link-label').value.trim();
    const url = document.getElementById('ita-new-link-url').value.trim();
    if (!url) return alert('กรุณาใส่ URL');
    
    itaNewLinksToAdd.push({ label: label || 'ลิงก์ภายนอก', url, type: 'link' });
    document.getElementById('ita-new-link-label').value = '';
    document.getElementById('ita-new-link-url').value = '';
    renderItaAttachments();
  });

  itaForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = itaForm.querySelector('button[type="submit"]');
    const code = document.getElementById('ita-code').value;
    
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    
    try {
      const formData = new FormData();
      formData.append('existingAttachments', JSON.stringify(currentItaAttachments));
      formData.append('newLinks', JSON.stringify(itaNewLinksToAdd));
      
      const fileInput = document.getElementById('ita-new-files');
      if (fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('files', fileInput.files[i]);
        }
      }

      const res = await fetch(`${API_BASE}/ita/${code}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData
      });

      if (res.ok) {
        await loadITA();
        itaModal.classList.remove('active');
        fileInput.value = '';
      } else {
        alert('ไม่สามารถบันทึกข้อมูล ITA ได้');
      }
    } catch (err) {
      alert('Error saving ITA item');
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึกข้อมูลทั้งหมด';
    }
  });

  itaInitBtn?.addEventListener('click', async () => {
    if (!confirm('ยืนยันการตั้งค่าเริ่มต้นระบบ ITA? หัวข้อเดิมจะถูกรีเซ็ตชื่อเป็นค่าเริ่มต้น (แต่ไฟล์จะไม่หาย)')) return;
    try {
      const res = await fetch(`${API_BASE}/ita/init`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await loadITA();
        alert('ตั้งค่าระบบ ITA สำเร็จ (O1-O37)');
      }
    } catch (err) { alert('Init failed'); }
  });

  itaCancelBtn?.addEventListener('click', () => itaModal.classList.remove('active'));
  itaModalCloseIcon?.addEventListener('click', () => itaModal.classList.remove('active'));

  // 6. STUDENT PANEL LOGIC
  const studentSaveButtons = document.querySelectorAll('.student-save-trigger');
  const academicYearGlobal = document.getElementById('setting-academic-year');
  const semesterGlobal = document.getElementById('setting-current-semester');
  const academicYearView = document.getElementById('view-academic-year');
  const semesterView = document.getElementById('view-current-semester');
  const btnAddYear = document.getElementById('btn-add-year');
  const btnDeletePeriod = document.getElementById('btn-delete-period');

  const toolSourceYear = document.getElementById('tool-source-year');
  const toolSourceSemester = document.getElementById('tool-source-semester');
  const btnToolCopy = document.getElementById('btn-tool-copy');
  const btnToolPromote = document.getElementById('btn-tool-promote');

  async function fetchAvailableYears() {
    try {
      const res = await fetch(`${API_BASE}/students/years`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      let years = await res.json();
      
      // Ensure current site year is at least an option if nothing in DB
      const siteYear = academicYearGlobal?.value || '2567';
      if (years.length === 0) {
        years = [siteYear];
      } else if (!years.includes(siteYear)) {
        years.push(siteYear);
        years.sort((a, b) => b.localeCompare(a));
      }

      const yearsHtml = years.map(y => `<option value="${y}">${y}</option>`).join('');
      if (academicYearView) academicYearView.innerHTML = yearsHtml;
      if (toolSourceYear) toolSourceYear.innerHTML = yearsHtml;
      if (academicYearGlobal) academicYearGlobal.innerHTML = yearsHtml;
      
      const currentVal = academicYearView.value;
      if (currentVal && years.includes(currentVal)) {
        academicYearView.value = currentVal;
      }
      
      const globalVal = academicYearGlobal?.getAttribute('data-initial');
      if (globalVal && years.includes(globalVal)) {
        academicYearGlobal.value = globalVal;
      }
    } catch (err) { console.error('Error fetching years:', err); }
  }

  async function loadStudentData(year = '', semester = '') {
    try {
      const query = (year && semester) ? `?year=${year}&semester=${semester}` : '';
      const res = await fetch(`${API_BASE}/students${query}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
           alert('Session หมดอายุ กรุณา Login ใหม่');
           window.location.href = '/admin/login';
        }
        return;
      }
      const { enrollments, settings } = await res.json();

      if (!year && !semester) {
        // Set initial data attributes for selects to pick up
        if (academicYearGlobal) {
          academicYearGlobal.setAttribute('data-initial', settings.academic_year);
        }
        if (semesterGlobal) semesterGlobal.value = settings.current_semester;
        
        await fetchAvailableYears();
        
        if (academicYearView) academicYearView.value = settings.academic_year;
        if (semesterView) semesterView.value = settings.current_semester;
      } else {
        if (academicYearView) academicYearView.value = settings.academic_year;
        if (semesterView) semesterView.value = settings.current_semester;
      }

      document.querySelectorAll('.student-input').forEach(input => input.value = 0);

      enrollments.forEach(en => {
        const row = document.querySelector(`#student-tbody tr[data-slug="${en.departmentSlug}"]`);
        if (row) {
          row.querySelector('[data-field="pvc1"]').value = en.pvc1;
          row.querySelector('[data-field="pvc2"]').value = en.pvc2;
          row.querySelector('[data-field="pvc3"]').value = en.pvc3;
          row.querySelector('[data-field="pvs1"]').value = en.pvs1;
          row.querySelector('[data-field="pvs2"]').value = en.pvs2;
        }
      });
    } catch (err) {
      console.error('Error loading student data:', err);
    }
  }

  const handleStudentSave = async () => {
    const btn = document.querySelector('.student-save-trigger'); 
    studentSaveButtons.forEach(b => {
      b.disabled = true;
      b.textContent = 'กำลังบันทึก...';
    });

    const siteSettings = {
      current_semester: semesterGlobal.value,
      academic_year: academicYearGlobal.value
    };

    const targetPeriod = {
      academic_year: academicYearView.value,
      current_semester: semesterView.value
    };

    const enrollments = [];
    const rows = document.querySelectorAll('#student-tbody tr[data-slug]');
    rows.forEach(row => {
      enrollments.push({
        departmentSlug: row.getAttribute('data-slug'),
        pvc1: row.querySelector('[data-field="pvc1"]').value || 0,
        pvc2: row.querySelector('[data-field="pvc2"]').value || 0,
        pvc3: row.querySelector('[data-field="pvc3"]').value || 0,
        pvs1: row.querySelector('[data-field="pvs1"]').value || 0,
        pvs2: row.querySelector('[data-field="pvs2"]').value || 0
      });
    });

    try {
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enrollments, 
          settings: siteSettings,
          targetYear: targetPeriod.academic_year,
          targetSemester: targetPeriod.current_semester
        })
      });
      if (res.ok) {
        alert('บันทึกข้อมูลเรียบร้อยแล้ว');
        await fetchAvailableYears();
        await loadStudentData(targetPeriod.academic_year, targetPeriod.current_semester);
      } else {
        const data = await res.json();
        alert('ไม่สามารถบันทึกข้อมูลได้: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error saving data');
    } finally {
      studentSaveButtons.forEach(btn => {
        btn.disabled = false;
        btn.textContent = '💾 บันทึกข้อมูลทั้งหมด';
      });
    }
  };

  studentSaveButtons.forEach(btn => btn.addEventListener('click', handleStudentSave));
  
  academicYearView?.addEventListener('change', () => loadStudentData(academicYearView.value, semesterView.value));
  semesterView?.addEventListener('change', () => loadStudentData(academicYearView.value, semesterView.value));

  btnAddYear?.addEventListener('click', async () => {
    const newYear = prompt('กรุณาระบุปีการศึกษาใหม่ (เช่น 2568):');
    if (!newYear || isNaN(newYear)) return;
    
    const exists = Array.from(academicYearView.options).some(opt => opt.value === String(newYear));
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = newYear;
      opt.textContent = newYear;
      academicYearView.insertBefore(opt, academicYearView.firstChild);
      
      const toolOpt = document.createElement('option');
      toolOpt.value = newYear;
      toolOpt.textContent = newYear;
      toolSourceYear.insertBefore(toolOpt, toolSourceYear.firstChild);
    }
    academicYearView.value = newYear;
    loadStudentData(newYear, semesterView.value);
  });

  btnDeletePeriod?.addEventListener('click', async () => {
    const year = academicYearView.value;
    const sem = semesterView.value;
    if (!year) return alert('กรุณาเลือกช่วงเวลาที่ต้องการลบ');
    if (!confirm(`ยืนยันการลบข้อมูลของช่วงเวลา ${sem}/${year}? (ข้อมูลจะหายถาวร)`)) return;
    
    try {
      const res = await fetch(`${API_BASE}/students/period?year=${year}&semester=${sem}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert('ลบข้อมูลเรียบร้อยแล้ว');
        await fetchAvailableYears();
        await loadStudentData();
      } else {
        alert('ไม่สามารถลบข้อมูลได้');
      }
    } catch (err) { alert('Delete failed'); }
  });

  btnToolCopy?.addEventListener('click', async () => {
    const year = toolSourceYear.value;
    const sem = toolSourceSemester.value;
    if (!year) return alert('กรุณาเลือกปีการศึกษาต้นฉบับ');
    
    try {
      const res = await fetch(`${API_BASE}/students?year=${year}&semester=${sem}`, { headers: getAuthHeaders() });
      if (!res.ok) return alert('ไม่สามารถดึงข้อมูลต้นฉบับได้');
      const { enrollments } = await res.json();
      
      if (enrollments.length === 0) {
        return alert(`ไม่พบข้อมูลในช่วงเวลา ${sem}/${year} สำหรับคัดลอก`);
      }

      if (!confirm(`ยืนยันการคัดลอกข้อมูลจาก ${sem}/${year}? (ข้อมูลปัจจุบันในตารางจะถูกเขียนทับ)`)) return;
      
      document.querySelectorAll('.student-input').forEach(input => input.value = 0);

      enrollments.forEach(en => {
        const row = document.querySelector(`#student-tbody tr[data-slug="${en.departmentSlug}"]`);
        if (row) {
          row.querySelector('[data-field="pvc1"]').value = en.pvc1;
          row.querySelector('[data-field="pvc2"]').value = en.pvc2;
          row.querySelector('[data-field="pvc3"]').value = en.pvc3;
          row.querySelector('[data-field="pvs1"]').value = en.pvs1;
          row.querySelector('[data-field="pvs2"]').value = en.pvs2;
        }
      });
      alert('คัดลอกข้อมูลสำเร็จ (อย่าลืมกดบันทึก)');
    } catch (err) { alert('Copy failed'); }
  });

  btnToolPromote?.addEventListener('click', async () => {
    const year = toolSourceYear.value;
    const sem = toolSourceSemester.value;
    if (!year) return alert('กรุณาเลือกปีการศึกษาต้นฉบับ');
    
    try {
      const res = await fetch(`${API_BASE}/students?year=${year}&semester=${sem}`, { headers: getAuthHeaders() });
      if (!res.ok) return alert('ไม่สามารถดึงข้อมูลต้นฉบับได้');
      const { enrollments } = await res.json();
      
      if (enrollments.length === 0) {
        return alert(`ไม่พบข้อมูลในช่วงเวลา ${sem}/${year} สำหรับใช้เลื่อนขั้น`);
      }

      if (!confirm(`ยืนยันการเลื่อนขั้นนักเรียนจาก ${sem}/${year}? \n(ปวช.1->2, ปวช.2->3 และ ปวส.1->2)`)) return;
      
      document.querySelectorAll('.student-input').forEach(input => input.value = 0);

      enrollments.forEach(en => {
        const row = document.querySelector(`#student-tbody tr[data-slug="${en.departmentSlug}"]`);
        if (row) {
          row.querySelector('[data-field="pvc1"]').value = 0;
          row.querySelector('[data-field="pvc2"]').value = en.pvc1;
          row.querySelector('[data-field="pvc3"]').value = en.pvc2;
          row.querySelector('[data-field="pvs1"]').value = 0;
          row.querySelector('[data-field="pvs2"]').value = en.pvs1;
        }
      });
      alert('ประมวลผลเลื่อนขั้นข้อมูลสำเร็จ (อย่าลืมกดบันทึก)');
    } catch (err) { alert('Promotion failed'); }
  });

  // Toggle automation tools
  const btnToggleTools = document.getElementById('btn-toggle-tools');
  const toolsContent = document.getElementById('automation-tools-content');
  
  btnToggleTools?.addEventListener('click', () => {
    if (toolsContent.style.display === 'none') {
      toolsContent.style.display = 'flex';
      btnToggleTools.innerHTML = '🙈 ซ่อนเครื่องมือ';
    } else {
      toolsContent.style.display = 'none';
      btnToggleTools.innerHTML = '👁️ แสดงเครื่องมือ';
    }
  });

  // 7. FACILITY PANEL LOGIC
  const facTreeContainer = document.getElementById('fac-tree-container');
  const facAddBldgBtn = document.getElementById('fac-add-bldg-btn');
  const facModal = document.getElementById('fac-modal');
  const facModalCloseIcon = document.getElementById('fac-modal-close-icon');
  const facCancelBtn = document.getElementById('fac-cancel-btn');
  const facForm = document.getElementById('fac-form');
  const facModalTitle = document.getElementById('fac-modal-title');
  const facNameLabel = document.getElementById('fac-name-label');

  let allFacilities = [];

  // MOCK LocalStorage Sync temporarily
  function loadFacilities() {
    try {
      const stored = localStorage.getItem('mockFacilities');
      if (stored) {
        allFacilities = JSON.parse(stored);
      } else {
        // Initial Mock Data
        allFacilities = [
          { id: 'b1', type: 'BUILDING', name: 'อาคารทับทิมสยาม', category: 'ACADEMIC', capacity: 0, 
            children: [{ id: 'r1', type: 'ROOM', name: 'ห้อง 101', capacity: 40 }] },
          { id: 'b2', type: 'BUILDING', name: 'อาคารอเนกประสงค์', category: 'MULTIPURPOSE', capacity: 500, children: [] }
        ];
        saveFacilities();
      }
      renderFacilityTree();
    } catch {
      if(facTreeContainer) facTreeContainer.innerHTML = 'Error loading facilities';
    }
  }

  function saveFacilities() {
    localStorage.setItem('mockFacilities', JSON.stringify(allFacilities));
  }

  function getFacility(id) {
    for (let b of allFacilities) {
      if (b.id === id) return b;
      const child = b.children?.find(r => r.id === id);
      if (child) return child;
    }
    return null;
  }

  function renderFacilityTree() {
    if (!facTreeContainer) return;
    if (allFacilities.length === 0) {
      facTreeContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: #64748b;">ไม่มีข้อมูลอาคาร/สถานที่</div>';
      return;
    }

    let html = '';
    allFacilities.forEach(b => {
      let bCapacity = b.capacity;
      // If it has rooms, we can automatically calculate total capacity or just display its capacity
      const childrenCapacity = (b.children || []).reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);
      const displayCap = bCapacity > 0 ? bCapacity : childrenCapacity;

      const catNames = { ACADEMIC: 'อาคารเรียน', MULTIPURPOSE: 'อาคารอเนกประสงค์', ADMINISTRATION: 'อาคารอำนวยการ', OTHER: 'พื้นที่อื่นๆ' };
      const bCapLabel = catNames[b.category] || 'พื้นที่อื่นๆ';

      html += `
        <div class="fac-tree-node">
          <div class="fac-tree-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div class="fac-tree-title">
              <span class="fac-chevron"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
              <span style="font-size:1.2rem;">🏢</span> 
              <span>${escapeHtml(b.name)} <span style="font-size: 0.75rem; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">หมวด: ${bCapLabel}</span></span>
              ${displayCap > 0 ? `<span class="fac-tree-cap">รองรับรวม: ${displayCap} คน</span>` : ''}
            </div>
            <div class="fac-tree-actions" onclick="event.stopPropagation()">
              <button class="btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.8rem; min-height: unset; border-radius: 6px; box-shadow: none;" onclick="openFacModal('ROOM', null, '${b.id}')">+ เพิ่มหน่วยย่อย</button>
              <button class="icon-btn" onclick="openFacModal('BUILDING', '${b.id}')" title="บริหารจัดการข้อมูล">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn danger" onclick="deleteFacility('${b.id}', 'BUILDING')" title="ลบข้อมูลอาคารหลัก">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
          <div class="fac-tree-children">
            ${(b.children || []).length === 0 ? '<div style="color:var(--color-text-secondary); font-size:0.85rem;">(ยังไม่มีการระบุหน่วยย่อยภายในอาคารนี้)</div>' : b.children.map(r => `
              <div class="fac-tree-child">
                <div>
                  <span style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(r.name)}</span>
                  ${r.capacity > 0 ? `<span style="font-size: 0.8rem; color: var(--color-text-secondary); margin-left: 0.5rem;">(รองรับ ${r.capacity} คน)</span>` : ''}
                </div>
                <div class="fac-tree-actions">
                  <button class="icon-btn" onclick="openFacModal('ROOM', '${r.id}', '${b.id}')" title="แก้ไขข้อมูล">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="icon-btn danger" onclick="deleteFacility('${r.id}', 'ROOM', '${b.id}')" title="ลบข้อมูลหน่วยย่อย">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    facTreeContainer.innerHTML = html;
  }

  window.openFacModal = (type, editId = null, parentId = null, preCategory = null) => {
    facForm.reset();
    document.getElementById('fac-id').value = editId || '';
    document.getElementById('fac-type').value = type;
    document.getElementById('fac-parent-id').value = parentId || '';

    const catGroup = document.getElementById('fac-category-group');
    if (preCategory && document.getElementById('fac-category')) {
      document.getElementById('fac-category').value = preCategory;
    }

    if (type === 'BUILDING') {
      facModalTitle.textContent = editId ? 'แก้ไขข้อมูลอาคารหลัก' : 'เพิ่มข้อมูลอาคารหลัก';
      facNameLabel.textContent = 'ชื่ออาคารหลัก';
      if (catGroup) catGroup.style.display = 'block';
    } else {
      facModalTitle.textContent = editId ? 'แก้ไขข้อมูลหน่วยย่อย/ห้อง' : 'เพิ่มข้อมูลหน่วยย่อย/ห้อง';
      facNameLabel.textContent = 'ชื่อหน่วยย่อย / ห้องปฏิบัติการ';
      if (catGroup) catGroup.style.display = 'none';
    }

    const capLabel = document.querySelector('label[for="fac-capacity"]');

    if (editId) {
      const item = getFacility(editId);
      if (item) {
        document.getElementById('fac-name').value = item.name;
        document.getElementById('fac-capacity').value = item.capacity || 0;
        if (type === 'BUILDING' && item.category) {
          document.getElementById('fac-category').value = item.category;
        }
        if (capLabel) {
          capLabel.innerHTML = `รองรับ (คน) <span style="font-weight:normal; font-size:0.8rem; color:var(--color-accent-primary); margin-left:8px;">(ปัจจุบัน: ${item.capacity || 0})</span>`;
        }
      }
    } else {
      if (capLabel) capLabel.textContent = 'รองรับ (คน)';
    }

    facModal.classList.add('active');
  };

  facAddBldgBtn?.addEventListener('click', () => openFacModal('BUILDING'));
  facCancelBtn?.addEventListener('click', () => facModal.classList.remove('active'));
  facModalCloseIcon?.addEventListener('click', () => facModal.classList.remove('active'));

  facForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('fac-id').value;
    const type = document.getElementById('fac-type').value;
    const parentId = document.getElementById('fac-parent-id').value;
    const name = document.getElementById('fac-name').value.trim();
    const capacity = parseInt(document.getElementById('fac-capacity').value) || 0;
    const category = document.getElementById('fac-category').value;

    if (id) {
       // Edit
       const item = getFacility(id);
       if (item) {
         item.name = name;
         item.capacity = capacity;
         if (type === 'BUILDING') item.category = category;
       }
    } else {
       // Add
       const newId = 'fac_' + Date.now();
       if (type === 'BUILDING') {
         allFacilities.push({ id: newId, type: 'BUILDING', name, category, capacity, children: [] });
       } else {
         const parent = allFacilities.find(b => b.id === parentId);
         if (parent) {
           parent.children.push({ id: newId, type: 'ROOM', name, capacity });
         }
       }
    }
    saveFacilities();
    renderFacilityTree();
    facModal.classList.remove('active');
  });

  window.deleteFacility = (id, type, parentId = null) => {
    if (!confirm('ยืนยันการลบข้อมูล? (การลบข้อมูลอาคารหลักจะส่งผลให้ข้อมูลหน่วยย่อยภายในถูกลบทั้งหมด)')) return;
    if (type === 'BUILDING') {
      allFacilities = allFacilities.filter(b => b.id !== id);
    } else {
      const parent = allFacilities.find(b => b.id === parentId);
      if (parent) {
        parent.children = parent.children.filter(r => r.id !== id);
      }
    }
    saveFacilities();
    renderFacilityTree();
  };

  // Init loads moved to bottom
  
  // ─── PARTNER LOGIC (สถานประกอบการ) ──────────────────────────────────────────
  let allPartners = [];
  const partnerListContainer = document.getElementById('partner-list-container');
  const partnerModal = document.getElementById('partner-modal');
  const partnerForm = document.getElementById('partner-form');
  const partnerLogoInput = document.getElementById('partner-logo-input');
  const partnerLogoPreview = document.getElementById('partner-logo-preview');
  const partnerLogoPlaceholder = document.getElementById('partner-logo-placeholder');
  const partnerLogoHidden = document.getElementById('partner-logo-hidden');

  function savePartners() {
    localStorage.setItem('mockPartners', JSON.stringify(allPartners));
  }

  function loadPartners() {
    try {
      const stored = localStorage.getItem('mockPartners');
      if (stored) {
        allPartners = JSON.parse(stored);
      } else {
        // Initial Mock Data
        allPartners = [];
      }
      renderPartners();
    } catch {
      if(partnerListContainer) partnerListContainer.innerHTML = 'Error loading partners';
    }
  }

  function renderPartners() {
    if (!partnerListContainer) return;
    if (allPartners.length === 0) {
      partnerListContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #64748b;">ยังไม่มีข้อมูลสถานประกอบการ</div>';
      return;
    }

    let html = '';
    allPartners.forEach(p => {
      let tagsHtml = '';
      if (p.tags && p.tags.trim()) {
        const tags = p.tags.split(',').map(t => t.trim()).filter(t => t);
        tagsHtml = tags.map(t => `<span style="background: var(--color-accent-primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-right: 4px;">${escapeHtml(t)}</span>`).join('');
      }

      html += `
        <div style="border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; background: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); position: relative;">
          
          <div style="position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem;">
            <button class="icon-btn" onclick="openPartnerModal('${p.id}')" title="แก้ไขข้อมูล">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" onclick="deletePartner('${p.id}')" title="ลบข้อมูล">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>

          <div style="height: 100px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; background: #f8fafc; border-radius: 8px;">
            ${p.logo ? `<img src="${p.logo}" alt="Logo" style="max-height: 80px; max-width: 80%; object-fit: contain;">` : `<span style="color: #94a3b8; font-size: 2rem;">🏢</span>`}
          </div>
          
          <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">${escapeHtml(p.name)}</h3>
          
          ${tagsHtml ? `<div style="margin-bottom: 0.75rem;">${tagsHtml}</div>` : ''}
          
          ${p.address ? `<p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 0.5rem; line-height: 1.4;"><span style="font-weight: 600;">ที่อยู่:</span> ${escapeHtml(p.address)}</p>` : ''}
          ${p.coords ? `<p style="font-size: 0.8rem; color: #64748b; font-family: monospace;">📌 ${escapeHtml(p.coords)}</p>` : ''}
        </div>
      `;
    });
    
    partnerListContainer.innerHTML = html;
  }

  window.openPartnerModal = (editId = null) => {
    partnerForm.reset();
    document.getElementById('partner-id').value = editId || '';
    document.getElementById('partner-modal-title').textContent = editId ? 'แก้ไขสถานประกอบการ' : 'เพิ่มสถานประกอบการ';
    
    // Reset logo preview
    partnerLogoPreview.src = '';
    partnerLogoPreview.style.display = 'none';
    partnerLogoPlaceholder.style.display = 'block';
    partnerLogoHidden.value = '';

    if (editId) {
      const p = allPartners.find(x => x.id === editId);
      if (p) {
        document.getElementById('partner-name').value = p.name || '';
        document.getElementById('partner-tags').value = p.tags || '';
        document.getElementById('partner-address').value = p.address || '';
        document.getElementById('partner-coords').value = p.coords || '';
        
        if (p.logo) {
          partnerLogoPreview.src = p.logo;
          partnerLogoPreview.style.display = 'block';
          partnerLogoPlaceholder.style.display = 'none';
          partnerLogoHidden.value = p.logo;
        }
      }
    }

    partnerModal.classList.add('active');
  };

  window.deletePartner = (id) => {
    if (!confirm('ยืนยันการลบสถานประกอบการนี้?')) return;
    allPartners = allPartners.filter(x => x.id !== id);
    savePartners();
    renderPartners();
  };

  // Partner Event Listeners
  document.getElementById('partner-add-btn')?.addEventListener('click', () => openPartnerModal());
  document.getElementById('partner-cancel-btn')?.addEventListener('click', () => partnerModal.classList.remove('active'));
  document.getElementById('partner-modal-close-btn')?.addEventListener('click', () => partnerModal.classList.remove('active'));

  partnerLogoInput?.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        partnerLogoPreview.src = e.target.result;
        partnerLogoPreview.style.display = 'block';
        partnerLogoPlaceholder.style.display = 'none';
        partnerLogoHidden.value = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  partnerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('partner-id').value;
    const itemData = {
      name: document.getElementById('partner-name').value.trim(),
      tags: document.getElementById('partner-tags').value.trim(),
      address: document.getElementById('partner-address').value.trim(),
      coords: document.getElementById('partner-coords').value.trim(),
      logo: partnerLogoHidden.value
    };

    if (id) {
       // Edit
       const p = allPartners.find(x => x.id === id);
       if (p) Object.assign(p, itemData);
    } else {
       // Add
       itemData.id = 'partner_' + Date.now();
       allPartners.push(itemData);
    }
    
    savePartners();
    renderPartners();
    partnerModal.classList.remove('active');
  });

  // ─── BUDGET MANAGEMENT ──────────────────────────────────────────────
  let allBudgets = [];
  const budgetModal = document.getElementById('budget-modal');
  const budgetForm = document.getElementById('budget-form');
  const budgetListContainer = document.getElementById('budget-list-container');

  const saveBudgets = () => localStorage.setItem('mockBudgets', JSON.stringify(allBudgets));
  const loadBudgets = () => {
    const stored = localStorage.getItem('mockBudgets');
    if (stored) {
      allBudgets = JSON.parse(stored);
    } else {
      // Sample data
      allBudgets = [
        { id: 'b1', year: 2567, title: 'โครงการพัฒนาห้องปฏิบัติการคอมพิวเตอร์', category: 'งบลงทุน', amount: 500000, status: 'ดำเนินการเสร็จสิ้น' },
        { id: 'b2', year: 2567, title: 'ค่าจ้างครูอัตราจ้างประจำปี', category: 'งบดำเนินงาน', amount: 1200000, status: 'กำลังดำเนินการ' },
      ];
      saveBudgets();
    }
    renderBudgets();
    loadBudgetStatus(); // Added: Fetch and set initial toggle state
  };

  // ─── BUDGET STATUS MANAGEMENT ──────────────────────────────────────────
  const budgetStatusToggle = document.getElementById('budget-status-toggle');
  const budgetStatusText = document.getElementById('budget-status-text');

  async function loadBudgetStatus() {
    if (!budgetStatusToggle) return;
    try {
      const res = await fetch('/api/students', { headers: getAuthHeaders() }); // Global settings are inside this endpoint
      if (res.ok) {
        const { settings } = await res.json();
        const status = settings.budget_info_status || 'active';
        budgetStatusToggle.checked = (status === 'active');
        updateBudgetStatusUI(status);
      }
    } catch (e) { console.error('Error loading budget status:', e); }
  }

  function updateBudgetStatusUI(status) {
    if (!budgetStatusText) return;
    if (status === 'active') {
      budgetStatusText.innerHTML = '🟢 เปิดใช้งานปกติ';
      budgetStatusText.style.color = '#10b981';
    } else {
      budgetStatusText.innerHTML = '🟠 อยู่ระหว่างปรับปรุง';
      budgetStatusText.style.color = '#f59e0b';
    }
  }

  budgetStatusToggle?.addEventListener('change', async () => {
    const newStatus = budgetStatusToggle.checked ? 'active' : 'maintenance';
    updateBudgetStatusUI(newStatus);
    
    try {
      const res = await fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          settings: { budget_info_status: newStatus }
        })
      });
      if (!res.ok) {
        alert('ไม่สามารถบันทึกสถานะได้');
        loadBudgetStatus(); // revert on error
      }
    } catch (err) {
      console.error(err);
      alert('Error saving budget status');
      loadBudgetStatus(); // revert on error
    }
  });

  const renderBudgets = () => {
    if (!budgetListContainer) return;

    let totalAmount = 0;
    let completedCount = 0;

    budgetListContainer.innerHTML = allBudgets.length > 0 ? allBudgets.map(item => {
      totalAmount += parseFloat(item.amount || 0);
      if (item.status === 'ดำเนินการเสร็จสิ้น') completedCount++;

      let statusClass = 'status-pending';
      if (item.status === 'กำลังดำเนินการ') statusClass = 'status-progress';
      if (item.status === 'ดำเนินการเสร็จสิ้น') statusClass = 'status-success';
      if (item.status === 'ยกเลิก') statusClass = 'status-danger';

      return `
        <tr>
          <td style="text-align:center; color: var(--color-text-secondary); font-weight: 600;">${item.year}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${escapeHtml(item.title)}</div>
          </td>
          <td><span class="category-tag">${item.category}</span></td>
          <td>
            <div style="font-weight: 800; color: var(--color-accent-primary); font-family: 'Inter', sans-serif;">
              ฿${parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </td>
          <td><span class="status-badge ${statusClass}">${item.status}</span></td>
          <td>
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
              <button class="icon-btn" onclick="openBudgetModal('${item.id}')" title="แก้ไข">✏️</button>
              <button class="icon-btn danger" onclick="deleteBudget('${item.id}')" title="ลบ">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="6" style="text-align:center; padding: 3rem; color: #94a3b8;">ยังไม่มีข้อมูลรายการงบประมาณ</td></tr>`;

    // Update Stats
    if (document.getElementById('budget-total-amount')) {
      document.getElementById('budget-total-amount').textContent = '฿' + totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
    if (document.getElementById('budget-total-items')) {
      document.getElementById('budget-total-items').textContent = allBudgets.length;
    }
    if (document.getElementById('budget-completed-items')) {
      document.getElementById('budget-completed-items').textContent = completedCount;
    }
  };

  window.openBudgetModal = (id = null) => {
    budgetForm.reset();
    document.getElementById('budget-id').value = '';
    document.getElementById('budget-modal-title').textContent = 'เพิ่มรายการงบประมาณ';

    if (id) {
      const item = allBudgets.find(x => x.id === id);
      if (item) {
        document.getElementById('budget-modal-title').textContent = 'แก้ไขรายการงบประมาณ';
        document.getElementById('budget-id').value = item.id;
        document.getElementById('budget-year').value = item.year;
        document.getElementById('budget-title').value = item.title;
        document.getElementById('budget-category').value = item.category;
        document.getElementById('budget-amount').value = item.amount;
        document.getElementById('budget-status').value = item.status;
      }
    }
    budgetModal.classList.add('active');
  };

  window.deleteBudget = (id) => {
    if (!confirm('ต้องการลบรายการงบประมาณนี้ใช่หรือไม่?')) return;
    allBudgets = allBudgets.filter(x => x.id !== id);
    saveBudgets();
    renderBudgets();
  };

  document.getElementById('budget-add-btn')?.addEventListener('click', () => openBudgetModal());
  document.getElementById('budget-cancel-btn')?.addEventListener('click', () => budgetModal.classList.remove('active'));
  document.getElementById('budget-modal-close-btn')?.addEventListener('click', () => budgetModal.classList.remove('active'));

  budgetForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('budget-id').value;
    const itemData = {
      year: document.getElementById('budget-year').value,
      title: document.getElementById('budget-title').value.trim(),
      category: document.getElementById('budget-category').value,
      amount: parseFloat(document.getElementById('budget-amount').value),
      status: document.getElementById('budget-status').value
    };

    if (id) {
      const b = allBudgets.find(x => x.id === id);
      if (b) Object.assign(b, itemData);
    } else {
      itemData.id = 'budget_' + Date.now();
      allBudgets.push(itemData);
    }

    saveBudgets();
    renderBudgets();
    budgetModal.classList.remove('active');
  });

  // ─── SITE IMAGES PANEL ───────────────────────────────────────────────────────

  async function loadSiteImages() {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch('/api/site-images', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      renderImageGrid('hero-images-grid', data.heroImages || [], 'hero');
      renderImageGrid('subbanner-images-grid', data.subBannerImages || [], 'subbanner');
    } catch (e) {
      console.error('[SiteImages]', e);
    }
  }

  function renderImageGrid(gridId, images, type) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (images.length === 0) {
      grid.innerHTML = `<div style="text-align:center;color:var(--color-text-secondary);padding:2rem 0;width:100%;">
        ยังไม่มีรูปภาพ — กดปุ่มอัปโหลดเพื่อเพิ่ม 🖼️
      </div>`;
      return;
    }

    grid.innerHTML = images.map((url, idx) => `
      <div style="position:relative; border-radius:12px; overflow:hidden; width:200px; height:130px; border:2px solid rgba(112,66,248,0.2); flex-shrink:0; background:#0a0a14;">
        <img src="${escapeHtml(url)}" alt="รูปที่ ${idx + 1}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <div style="position:absolute;bottom:0;left:0;right:0;padding:0.4rem;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:space-between;">
          <span style="color:#fff;font-size:0.72rem;font-weight:600;">ภาพที่ ${idx + 1}${idx === 0 && type === 'hero' ? ' (default)' : ''}</span>
          <button onclick="deleteSiteImage('${type}', ${idx})"
            style="background:rgba(239,68,68,0.85);border:none;color:#fff;border-radius:6px;cursor:pointer;padding:2px 8px;font-size:0.75rem;font-weight:700;line-height:1.6;">
            ลบ
          </button>
        </div>
      </div>
    `).join('');
  }

  window.deleteSiteImage = async function(type, idx) {
    if (!confirm(`ต้องการลบรูปที่ ${idx + 1} ใช่หรือไม่?`)) return;
    const token = localStorage.getItem('adminToken');
    const endpoint = type === 'hero'
      ? `/api/site-images/hero/${idx}`
      : `/api/site-images/subbanner/${idx}`;
    try {
      const res = await fetch(endpoint, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'ลบไม่สำเร็จ');
      if (type === 'hero') renderImageGrid('hero-images-grid', data.heroImages || [], 'hero');
      else renderImageGrid('subbanner-images-grid', data.subBannerImages || [], 'subbanner');
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  };

  // Hero upload
  document.getElementById('hero-upload-input')?.addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;
    const token = localStorage.getItem('adminToken');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/site-images/hero', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'อัปโหลดไม่สำเร็จ');
      renderImageGrid('hero-images-grid', data.heroImages || [], 'hero');
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
    this.value = '';
  });

  // Sub-banner upload
  document.getElementById('subbanner-upload-input')?.addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;
    const token = localStorage.getItem('adminToken');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/site-images/subbanner', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'อัปโหลดไม่สำเร็จ');
      renderImageGrid('subbanner-images-grid', data.subBannerImages || [], 'subbanner');
    } catch (e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
    this.value = '';
  });

  // ─── INITIALIZE ALL COMPONENTS ──────────────────────────────────────────────
  loadPR();
  loadPersonnel();
  loadDocs();
  loadITA();
  loadStudentData();
  fetchUniqueDuties();
  loadFacilities();
  loadPartners();
  loadBudgets();
  loadSiteImages();

  // ─── ACHIEVEMENTS PANEL ───────────────────────────────────────────────────
  const achieveFormContainer = document.getElementById('achieve-form-container');
  const achieveForm = document.getElementById('achieve-form');
  const achieveTbody = document.getElementById('achieve-tbody');
  const achieveAddBtn = document.getElementById('achieve-add-btn');
  const achieveCancelBtn = document.getElementById('achieve-cancel-btn');

  async function loadAchievements() {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch('/api/achievements', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      renderAchievements(data);
    } catch (e) {
      console.error('[Achievements]', e);
    }
  }

  function renderAchievements(list) {
    if (!achieveTbody) return;
    if (list.length === 0) {
      achieveTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:3rem;">ยังไม่มีข้อมูลผลงานเด่น — กดปุ่ม "+ เพิ่มผลงาน" เพื่อเริ่มต้น ✨</td></tr>`;
      return;
    }

    achieveTbody.innerHTML = list.map(item => `
      <tr>
        <td style="font-weight:700;">#${item.order || 0}</td>
        <td>
          ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">` : '<span style="color:#cbd5e1;font-size:1.5rem;">🖼️</span>'}
        </td>
        <td>
          <div style="font-weight:700;">${escapeHtml(item.title)}</div>
          <div style="font-size:0.75rem;color:var(--color-accent-primary);">${escapeHtml(item.awardLabel || '')}</div>
        </td>
        <td><div style="font-size:0.85rem;color:var(--color-text-secondary);max-width:300px;" class="line-clamp-2">${escapeHtml(item.description)}</div></td>
        <td style="text-align:right;">
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button class="icon-btn edit-achieve-btn" data-id="${item.id}" title="แก้ไข">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="icon-btn danger delete-achieve-btn" data-id="${item.id}" title="ลบ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></polyline></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Re-attach listeners
    document.querySelectorAll('.edit-achieve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const token = localStorage.getItem('adminToken');
        const res = await fetch('/api/achievements', { headers: { 'Authorization': `Bearer ${token}` } });
        const list = await res.json();
        const item = list.find(x => x.id === id);
        if (item) {
          document.getElementById('achieve-id').value = item.id;
          document.getElementById('achieve-title').value = item.title;
          document.getElementById('achieve-description').value = item.description;
          document.getElementById('achieve-awardLabel').value = item.awardLabel || '';
          document.getElementById('achieve-awardText').value = item.awardText || '';
          document.getElementById('achieve-order').value = item.order || 0;
          
          document.getElementById('achieve-form-title').textContent = 'แก้ไขผลงานเด่น';
          achieveFormContainer.classList.remove('hide');
          achieveFormContainer.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('.delete-achieve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('ยืนยันการลบผลงานนี้?')) return;
        const id = btn.getAttribute('data-id');
        const token = localStorage.getItem('adminToken');
        try {
          const res = await fetch(`/api/achievements/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            alert('ลบข้อมูลสำเร็จ');
            loadAchievements();
          }
        } catch (e) { console.error(e); }
      });
    });
  }

  achieveAddBtn?.addEventListener('click', () => {
    achieveForm.reset();
    document.getElementById('achieve-id').value = '';
    document.getElementById('achieve-form-title').textContent = 'เพิ่มผลงานเด่น';
    achieveFormContainer.classList.remove('hide');
  });

  achieveCancelBtn?.addEventListener('click', () => {
    achieveFormContainer.classList.add('hide');
  });

  achieveForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('adminToken');
    const formData = new FormData(achieveForm);
    const id = document.getElementById('achieve-id').value;
    
    const url = id ? `/api/achievements/${id}` : '/api/achievements';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        alert('บันทึกข้อมูลสำเร็จ');
        achieveFormContainer.classList.add('hide');
        loadAchievements();
      } else {
        const error = await res.json();
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  });

  loadAchievements();

  // ─── DOWNLOAD DOCUMENTS PANEL ────────────────────────────────────────────────
  const dlPanel = document.getElementById('downloads-panel');
  const dlTbody = document.getElementById('dl-tbody');
  const dlAddBtn = document.getElementById('dl-add-btn');
  const dlFormContainer = document.getElementById('dl-form-container');
  const dlCancelBtn = document.getElementById('dl-cancel-btn');
  const dlForm = document.getElementById('dl-form');
  const subdivisionDataList = document.getElementById('subdivision-list');

  const predefinedSubDivisions = {
    'ฝ่ายบริหารทรัพยากร': ['งานบริหารทั่วไป', 'งานบุคลากร', 'งานการเงิน', 'งานการบัญชี', 'งานพัสดุ', 'งานอาคารสถานที่', 'งานทะเบียน', 'งานประชาสัมพันธ์'],
    'ฝ่ายยุทธศาสตร์และแผนงาน': ['งานวางแผนและงบประมาณ', 'งานศูนย์ความร่วมมือและอาชีวศึกษาทวิภาคี', 'งานมาตรฐานและการประกันคุณภาพการศึกษา', 'งานศูนย์ดิจิทัลและสื่อสารองค์กร', 'งานส่งเสริมการวิจัย นวัตกรรม และสิ่งประดิษฐ์', 'งานส่งเสริมธุรกิจและการเป็นผู้ประกอบการ', 'งานติดตามและประเมินผลการอาชีวศึกษา'],
    'ฝ่ายกิจการนักเรียน นักศึกษา': ['งานกิจกรรมนักเรียน นักศึกษา', 'งานครูที่ปรึกษาและการแนะแนว', 'งานปกครองและความปลอดภัยนักเรียน นักศึกษา', 'งานสวัสดิการนักเรียน นักศึกษา', 'งานโครงการพิเศษและการบริการ'],
    'ฝ่ายวิชาการ': ['แผนวิชา / ภาควิชา / คณะวิชา', 'งานพัฒนาหลักสูตรและการจัดการเรียนรู้', 'งานวัดผลและประเมินผล', 'งานอาชีวศึกษาระบบทวิภาคีและความร่วมมือ', 'งานวิทยบริการและเทคโนโลยีการศึกษา', 'งานการศึกษาพิเศษและความเสมอภาคทางการศึกษา', 'งานพัฒนาหลักสูตรสายเทคโนโลยีหรือสายปฏิบัติการ']
  };

  window.updateSubDivisions = (division) => {
    if (!subdivisionDataList) return;
    subdivisionDataList.innerHTML = '';
    if (predefinedSubDivisions[division]) {
      predefinedSubDivisions[division].forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        subdivisionDataList.appendChild(option);
      });
    }
  };

  async function loadDownloads() {
    if (!dlTbody) return;
    try {
      const res = await fetch('/api/downloads', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const docs = await res.json();
      
      dlTbody.innerHTML = docs.length > 0 ? docs.map(doc => `
        <tr>
          <td>
            <a href="${doc.fileUrl}" target="_blank" style="color:var(--color-accent-primary);font-weight:600;text-decoration:none;">
              ${escapeHtml(doc.title)}
            </a>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">📅 ${new Date(doc.createdAt).toLocaleDateString('th-TH')}</div>
          </td>
          <td><span class="category-tag">${escapeHtml(doc.division)}</span></td>
          <td><span class="category-tag" style="background:rgba(20,184,166,0.1);color:#0d9488;border-color:rgba(20,184,166,0.2);">${escapeHtml(doc.subDivision)}</span></td>
          <td style="text-align:right;">
            <div style="display:flex;gap:0.25rem;justify-content:flex-end;">
              <button class="icon-btn" onclick="editDownload('${doc.id}')" title="แก้ไข">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn danger" onclick="deleteDownload('${doc.id}')" title="ลบเอกสาร">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('') : `<tr><td colspan="4" style="text-align:center;">ไม่พบเอกสารดาวน์โหลด</td></tr>`;
    } catch (e) {
      dlTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">โหลดข้อมูลล้มเหลว</td></tr>`;
    }
  }

  window.editDownload = async (id) => {
    try {
      const res = await fetch('/api/downloads', { headers: getAuthHeaders() });
      const docs = await res.json();
      const item = docs.find(d => d.id === id);
      if (!item) return;

      document.getElementById('dl-id').value = item.id;
      document.getElementById('dl-title').value = item.title;
      document.getElementById('dl-division').value = item.division;
      updateSubDivisions(item.division);
      document.getElementById('dl-subdivision').value = item.subDivision;
      
      document.getElementById('dl-file').value = '';
      document.getElementById('dl-file').required = false;
      document.getElementById('dl-file-hint').style.display = 'block';
      document.getElementById('dl-form-title').textContent = 'แก้ไขเอกสารดาวน์โหลด';
      
      dlFormContainer.classList.remove('hide');
      dlFormContainer.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { console.error(e); }
  };

  window.deleteDownload = async (id) => {
    if (!confirm('ยืนยันการลบเอกสารนี้? ไฟล์จะถูกลบออกจากระบบถาวร')) return;
    try {
      const res = await fetch(`/api/downloads/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert('ลบเอกสารสำเร็จ');
        loadDownloads();
      } else {
        alert('ลบเอกสารล้มเหลว');
      }
    } catch (err) { alert('ลบเอกสารล้มเหลว: ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์'); }
  };

  dlAddBtn?.addEventListener('click', () => {
    dlForm.reset();
    document.getElementById('dl-id').value = '';
    document.getElementById('dl-form-title').textContent = 'เพิ่มเอกสารดาวน์โหลดใหม่';
    document.getElementById('dl-file').required = true;
    document.getElementById('dl-file-hint').style.display = 'none';
    updateSubDivisions('');
    dlFormContainer.classList.remove('hide');
    dlFormContainer.scrollIntoView({ behavior: 'smooth' });
  });

  dlCancelBtn?.addEventListener('click', () => {
    dlFormContainer.classList.add('hide');
  });

  dlForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = dlForm.querySelector('button[type="submit"]');
    const dlId = document.getElementById('dl-id').value;
    const isEdit = !!dlId;
    
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    
    try {
      const formData = new FormData(dlForm);
      const url = isEdit ? `/api/downloads/${dlId}` : '/api/downloads';
      const method = isEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: formData
      });
      if (res.ok) {
        alert('บันทึกข้อมูลสำเร็จ');
        dlFormContainer.classList.add('hide');
        loadDownloads();
      } else {
        const error = await res.json();
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } catch (err) { alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
    finally {
      btn.disabled = false; btn.textContent = 'บันทึกข้อมูล';
    }
  });

  if (document.getElementById('downloads-panel')) {
    loadDownloads();
  }

  // ─── FAQ PANEL ─────────────────────────────────────────────────────────────
  const faqPanel = document.getElementById('faq-panel');
  const faqTbody = document.getElementById('faq-tbody');
  const faqAddBtn = document.getElementById('faq-add-btn');
  const faqFormContainer = document.getElementById('faq-form-container');
  const faqCancelBtn = document.getElementById('faq-cancel-btn');
  const faqForm = document.getElementById('faq-form');

  async function loadFAQs() {
    if (!faqTbody) return;
    try {
      const res = await fetch('/api/faqs');
      const faqs = await res.json();
      faqTbody.innerHTML = faqs.map(item => `
        <tr>
          <td><span class="badge" style="background:var(--color-accent-primary);">${item.order}</span></td>
          <td><span class="badge" style="background:#f1f5f9; color:#64748b;">${escapeHtml(item.category)}</span></td>
          <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <strong>${escapeHtml(item.question)}</strong>
          </td>
          <td style="text-align:right;">
            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
              <button class="btn-icon" onclick="editFAQ('${item.id}')" title="แก้ไข">✏️</button>
              <button class="btn-icon" onclick="deleteFAQ('${item.id}')" title="ลบ">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
      faqTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }

  faqAddBtn?.addEventListener('click', () => {
    faqForm.reset();
    document.getElementById('faq-id').value = '';
    document.getElementById('faq-form-title').innerText = 'เพิ่มคำถามใหม่';
    faqFormContainer.classList.remove('hide');
  });

  faqCancelBtn?.addEventListener('click', () => faqFormContainer.classList.add('hide'));

  faqForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('faq-id').value;
    const body = {
      question: document.getElementById('faq-question').value,
      answer: document.getElementById('faq-answer').value,
      category: document.getElementById('faq-category').value,
      order: document.getElementById('faq-order').value
    };

    try {
      const url = id ? `/api/faqs/${id}` : '/api/faqs';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert('บันทึกข้อมูลสำเร็จ');
        faqFormContainer.classList.add('hide');
        loadFAQs();
      } else {
        const error = await res.json();
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  });

  window.editFAQ = async (id) => {
    try {
      const res = await fetch('/api/faqs'); // Optimization: could be separate GET /api/faqs/:id
      const faqs = await res.json();
      const item = faqs.find(f => f.id === id);
      if (!item) return;

      document.getElementById('faq-id').value = item.id;
      document.getElementById('faq-question').value = item.question;
      document.getElementById('faq-answer').value = item.answer;
      document.getElementById('faq-category').value = item.category;
      document.getElementById('faq-order').value = item.order;
      document.getElementById('faq-form-title').innerText = 'แก้ไข FAQ';
      faqFormContainer.classList.remove('hide');
      faqFormContainer.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error(err);
    }
  };

  window.deleteFAQ = async (id) => {
    if (!confirm('ยืนยันการลบคำถามนี้?')) return;
    try {
      const res = await fetch(`/api/faqs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadFAQs();
      } else {
        alert('ลบไม่สำเร็จ');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (faqPanel) loadFAQs();


  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  });
})();

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str || '').replace(/[&<>"']/g, m => map[m]);
}
