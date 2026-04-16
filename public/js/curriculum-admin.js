// curriculum-admin.js
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('adminToken');
  if (!token) return; // Not logged in

  const panel = document.getElementById('curriculum-panel');
  if (!panel) return;

  const btnClose = document.getElementById('curr-cancel-btn');
  const btnAdd = document.getElementById('curr-add-btn');
  const formContainer = document.getElementById('curr-form-container');
  const tbody = document.getElementById('curr-tbody');
  const form = document.getElementById('curr-form');
  const formTitle = document.getElementById('curr-form-title');
  const idInput = document.getElementById('curr-id');

  // Load Data
  async function loadCurriculums() {
    try {
      const res = await fetch('/api/departments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const items = await res.json();
      tbody.innerHTML = '';
      if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>`;
        return;
      }
      
      items.forEach((item, index) => {
        const hasPdf = item.pdfUrl ? `<span style="color: green;">✔️ มีไฟล์</span>` : `<span style="color: gray;">❌ ไม่มี</span>`;
        const hasPlan = item.studyPlanUrl ? `<span style="color: green;">✔️ มีไฟล์</span>` : `<span style="color: gray;">❌ ไม่มี</span>`;

        // We store the whole object as JSON in a data attribute to easily edit it
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${index + 1}</td>
          <td><strong>${item.name}</strong><br><small style="color:#64748b;">${item.type || '-'} (${item.jobGroup || '-'})</small></td>
          <td><code>${item.slug}</code></td>
          <td>${hasPdf}</td>
          <td>${hasPlan}</td>
          <td style="text-align:right;">
            <button class="btn-outline btn-edit" style="padding:4px 8px; font-size:0.8rem;" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>แก้ไข</button>
            <button class="btn-outline btn-delete" style="padding:4px 8px; font-size:0.8rem; border-color:#fca5a5; color:#ef4444;" data-id="${item.id}" data-name="${item.name}">ลบ</button>
          </td>
        `;
        tbody.appendChild(row);
      });

      // Bind edit/delete
      tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const item = JSON.parse(e.currentTarget.getAttribute('data-item'));
          openEditForm(item);
        });
      });
      tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          deleteCurriculum(id, name);
        });
      });

    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">โหลดล้มเหลว</td></tr>`;
    }
  }

  // Tags logic for skills, jobs, pvc, hvc
  function setupTagInput(inputId, tagsContainerId, hiddenInputId) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(tagsContainerId);
    const hidden = document.getElementById(hiddenInputId);
    let tags = [];

    function renderTags() {
      container.innerHTML = '';
      tags.forEach((tag, idx) => {
        const el = document.createElement('div');
        el.className = 'skill-tag';
        el.style.cssText = 'background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;';
        el.innerHTML = `
          ${tag} <span style="cursor:pointer; color: #ef4444; font-weight: bold;" data-idx="${idx}">×</span>
        `;
        container.appendChild(el);
      });
      hidden.value = JSON.stringify(tags);

      // Bind removes
      container.querySelectorAll('span').forEach(sp => {
        sp.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
          tags.splice(idx, 1);
          renderTags();
        });
      });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
          tags.push(text);
          input.value = '';
          renderTags();
        }
      }
    });

    return {
      setTags: (newTags) => {
        tags = Array.isArray(newTags) ? newTags : [];
        renderTags();
      },
      getTags: () => tags
    };
  }

  // --- New Subject List Manager (Objects with Name & Desc) ---
  function setupSubjectList(nameInputId, descInputId, addBtnId, listContainerId, hiddenInputId) {
    const nameInput = document.getElementById(nameInputId);
    const descInput = document.getElementById(descInputId);
    const addBtn = document.getElementById(addBtnId);
    const container = document.getElementById(listContainerId);
    const hidden = document.getElementById(hiddenInputId);
    let items = [];

    function renderList() {
      container.innerHTML = '';
      items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'background: #f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 15px; display:flex; justify-content:space-between; align-items:center;';
        row.innerHTML = `
          <div style="flex:1;">
            <div style="font-weight:700; color:#1e293b; font-size:0.95rem;">${item.name}</div>
            <div style="font-size:0.85rem; color:#64748b;">${item.desc || '-'}</div>
          </div>
          <button type="button" class="btn-delete-sub" data-idx="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:5px;">&times;</button>
        `;
        container.appendChild(row);
      });
      hidden.value = JSON.stringify(items);

      container.querySelectorAll('.btn-delete-sub').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          items.splice(idx, 1);
          renderList();
        });
      });
    }

    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const desc = descInput.value.trim();
      if (name) {
        items.push({ name, desc });
        nameInput.value = '';
        descInput.value = '';
        renderList();
      } else {
        alert('กรุณาระบุชื่อวิชา');
      }
    });

    return {
      setItems: (newItems) => {
        // Migration logic: Handle old string array format
        items = Array.isArray(newItems) ? newItems.map(it => {
          if (typeof it === 'string') return { name: it, desc: '' };
          return it;
        }) : [];
        renderList();
      },
      getItems: () => items
    };
  }

  const skillsTags = setupTagInput('curr-skills-input', 'curr-skills-tags', 'curr-skills');
  const jobsTags = setupTagInput('curr-jobs-input', 'curr-jobs-tags', 'curr-jobs');
  
  const pvcList = setupSubjectList('curr-pvc-name-input', 'curr-pvc-desc-input', 'curr-pvc-add-btn', 'curr-pvc-list', 'curr-pvc');
  const hvcList = setupSubjectList('curr-hvc-name-input', 'curr-hvc-desc-input', 'curr-hvc-add-btn', 'curr-hvc-list', 'curr-hvc');

  // Utility to clear form
  function clearForm() {
    form.reset();
    idInput.value = '';
    formTitle.innerText = 'เพิ่มสาขาวิชา';
    skillsTags.setTags([]);
    jobsTags.setTags([]);
    pvcList.setItems([]);
    hvcList.setItems([]);
    
    // Clear gallery
    document.getElementById('curr-activity-preview').innerHTML = '';
    document.getElementById('curr-existingActivityImages').value = '[]';

    formContainer.classList.add('hide');
  }

  // Open Edit Form
  function openEditForm(item) {
    clearForm();
    formContainer.classList.remove('hide');
    formTitle.innerText = 'แก้ไขสาขาวิชา: ' + item.name;
    
    idInput.value = item.id;
    document.getElementById('curr-slug').value = item.slug || '';
    document.getElementById('curr-name').value = item.name || '';
    document.getElementById('curr-description').value = item.description || '';
    document.getElementById('curr-type').value = item.type || '';
    document.getElementById('curr-jobGroup').value = item.jobGroup || '';
    document.getElementById('curr-icon').value = item.icon || '';
    document.getElementById('curr-order').value = item.order || 0;
    
    document.getElementById('curr-pdfUrlText').value = item.pdfUrl && !item.pdfUrl.startsWith('/uploads') ? item.pdfUrl : '';

    skillsTags.setTags(item.skills || []);
    jobsTags.setTags(item.jobs || []);
    pvcList.setItems(item.curriculumPvc || []);
    hvcList.setItems(item.curriculumHvc || []);

    // Handle Activity Gallery Images
    const galleryPreview = document.getElementById('curr-activity-preview');
    const existingActInput = document.getElementById('curr-existingActivityImages');
    let currentGallery = Array.isArray(item.activityImages) ? item.activityImages : [];
    
    function renderGallery() {
      galleryPreview.innerHTML = '';
      currentGallery.forEach((img, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'position:relative; width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0;';
        div.innerHTML = `
          <img src="${img}" style="width:100%; height:100%; object-fit:cover;">
          <div class="delete-act" data-idx="${idx}" style="position:absolute; top:2px; right:2px; background:rgba(239, 68, 68, 0.8); color:white; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;">×</div>
        `;
        galleryPreview.appendChild(div);
      });
      existingActInput.value = JSON.stringify(currentGallery);
      
      galleryPreview.querySelectorAll('.delete-act').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          currentGallery.splice(idx, 1);
          renderGallery();
        };
      });
    }
    renderGallery();

    formContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Delete Action
  async function deleteCurriculum(id, name) {
    if (!confirm(`ยืนยันการลบสาขาวิชา ${name} ? ข้อมูลนี้จะไม่สามารถกู้คืนได้`)) return;
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('ลบข้อมูลสำเร็จ');
        loadCurriculums();
      } else {
        const d = await res.json();
        alert('ลบไม่สำเร็จ: ' + d.message);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  }

  // Bind Buttons
  btnAdd.addEventListener('click', () => {
    clearForm();
    formContainer.classList.remove('hide');
  });

  btnClose.addEventListener('click', clearForm);

  // Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = !!idInput.value;
    const url = isEdit ? `/api/departments/${idInput.value}` : `/api/departments`;
    const method = isEdit ? 'PUT' : 'POST';

    // Must submit as FormData to send files
    const fd = new FormData(form);

    // Provide default empty arrays stringified if tags are empty
    // but the hidden inputs already handle value through JSON.stringify so we just rely on FormData picking it up
    
    try {
      const btnSubmit = form.querySelector('button[type="submit"]');
      const originalText = btnSubmit.innerText;
      btnSubmit.innerText = 'กำลังบันทึก...';
      btnSubmit.disabled = true;

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });

      btnSubmit.innerText = originalText;
      btnSubmit.disabled = false;

      if (res.ok) {
        alert('บันทึกข้อมูลสาขาวิชาสำเร็จ');
        clearForm();
        loadCurriculums();
      } else {
        const d = await res.json();
        alert('บันทึกไม่สำเร็จ: ' + d.message);
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  });

  // Expose loader to global scope so it gets called when navigating to this panel
  window.loadCurriculums = loadCurriculums;

  // Load initially
  loadCurriculums();
});
