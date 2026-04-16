/**
 * Main Homepage Interactions
 * Handles: Navbar, Hero hover, Dept Modal, Scroll reveal
 */

// ─── NAVBAR ─────────────────────────────────────────────────────────────────
(function () {
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    const isOpen = mobileMenu.classList.contains('open');
    hamburger.innerHTML = isOpen
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  });

  // Close on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
    });
  });
})();

// ─── HERO HOVER REVEAL ───────────────────────────────────────────────────────
(function () {
  const heroZone    = document.getElementById('hero-hover-zone');
  const heroCanvas  = document.getElementById('hero-canvas');   // particle canvas
  const heroBg      = document.getElementById('hero-bg-image');
  const heroLogo    = document.getElementById('hero-logo');
  const heroTitleGroup = document.getElementById('hero-title-group');
  const heroHoverBtns  = document.getElementById('hero-hover-btns');
  const heroActionBtns = document.getElementById('hero-action-btns');
  const corners     = document.querySelectorAll('.hero-corner');

  if (!heroZone) return;

  heroZone.addEventListener('mouseenter', () => {
    if (heroCanvas) heroCanvas.style.opacity = '0';
    if (heroBg) heroBg.style.opacity = '1';
    if (heroLogo) heroLogo.style.opacity = '0';
    if (heroTitleGroup) { heroTitleGroup.style.opacity = '0'; heroTitleGroup.style.transform = 'translateY(-20px)'; }
    if (heroHoverBtns) heroHoverBtns.classList.add('visible');
    if (heroActionBtns) heroActionBtns.style.transform = 'translateY(20px)';
    corners.forEach(c => c.style.opacity = '0');
  });

  heroZone.addEventListener('mouseleave', () => {
    if (heroCanvas) heroCanvas.style.opacity = '1';
    if (heroBg) heroBg.style.opacity = '0';
    if (heroLogo) heroLogo.style.opacity = '1';
    if (heroTitleGroup) { heroTitleGroup.style.opacity = '1'; heroTitleGroup.style.transform = 'translateY(0)'; }
    if (heroHoverBtns) heroHoverBtns.classList.remove('visible');
    if (heroActionBtns) heroActionBtns.style.transform = 'translateY(0)';
    corners.forEach(c => c.style.opacity = '0.3');
  });
})();


// ─── DEPARTMENTS MODAL ───────────────────────────────────────────────────────
(function () {
  const departments = [
    {
      id: 'digital-business',
      name: 'เทคโนโลยีธุรกิจดิจิทัล',
      color: '#8b5cf6',
      studyPlan: [
        { semester: 'ภาคเรียนที่ 1 (ปี 1)', subjects: ['การเขียนโปรแกรมเบื้องต้น', 'ระบบปฏิบัติการเบื้องต้น', 'คณิตศาสตร์คอมพิวเตอร์', 'พิมพ์ดีดไทย-อังกฤษ'] },
        { semester: 'ภาคเรียนที่ 2 (ปี 1)', subjects: ['การพัฒนาเว็บไซต์เบื้องต้น', 'ระบบฐานข้อมูล', 'เครือข่ายคอมพิวเตอร์', 'การใช้โปรแกรมกราฟิก'] },
      ],
    },
    {
      id: 'acc',
      name: 'การบัญชี',
      color: '#f59e0b',
      studyPlan: [
        { semester: 'ภาคเรียนที่ 1 (ปี 1)', subjects: ['หลักการบัญชีเบื้องต้น 1', 'การพิมพ์ไทยเบื้องต้น', 'ธุรกิจทั่วไป', 'คณิตศาสตร์พาณิชยกรรม'] },
        { semester: 'ภาคเรียนที่ 2 (ปี 1)', subjects: ['หลักการบัญชีเบื้องต้น 2', 'การใช้โปรแกรมตารางงาน', 'กฎหมายพาณิชย์', 'ภาษาอังกฤษธุรกิจ'] },
      ],
    },
    {
      id: 'mech',
      name: 'ช่างยนต์',
      color: '#ef4444',
      studyPlan: [
        { semester: 'ภาคเรียนที่ 1 (ปี 1)', subjects: ['งานเครื่องยนต์เบื้องต้น', 'งานฝึกฝีมือ', 'เขียนแบบเทคนิคเบื้องต้น', 'วัสดุช่างยนต์'] },
        { semester: 'ภาคเรียนที่ 2 (ปี 1)', subjects: ['งานไฟฟ้ายานยนต์', 'งานเครื่องแก๊สโซลีน', 'คณิตศาสตร์อุตสาหกรรม', 'งานเชื่อมและโลหะแผ่น'] },
      ],
    },
    {
      id: 'elec',
      name: 'ช่างไฟฟ้ากำลัง',
      color: '#10b981',
      studyPlan: [
        { semester: 'ภาคเรียนที่ 1 (ปี 1)', subjects: ['วงจรไฟฟ้ากระแสตรง', 'งานฝึกฝีมือช่างไฟฟ้า', 'เครื่องมือวัดไฟฟ้า', 'วัสดุงานไฟฟ้า'] },
        { semester: 'ภาคเรียนที่ 2 (ปี 1)', subjects: ['วงจรไฟฟ้ากระแสสลับ', 'การติดตั้งไฟฟ้าในอาคาร', 'อุปกรณ์อิเล็กทรอนิกส์', 'กฎและมาตรฐานทางไฟฟ้า'] },
      ],
    },
    {
      id: 'electronics',
      name: 'อิเล็กทรอนิกส์',
      color: '#06b6d4',
      studyPlan: [
        { semester: 'ภาคเรียนที่ 1 (ปี 1)', subjects: ['อุปกรณ์อิเล็กทรอนิกส์', 'วงจรไฟฟ้ากระแสตรง', 'เขียนแบบอิเล็กทรอนิกส์', 'งานฝึกฝีมืออิเล็กทรอนิกส์'] },
        { semester: 'ภาคเรียนที่ 2 (ปี 1)', subjects: ['วงจรดิจิตอล', 'เครื่องมือวัดอิเล็กทรอนิกส์', 'โปรแกรมคอมพิวเตอร์', 'วงจรไฟฟ้ากระแสสลับ'] },
      ],
    },
  ];

  const overlay = document.getElementById('dept-modal-overlay');
  if (!overlay) return;

  const modalBox = overlay.querySelector('.modal-box');
  const closeBtn = document.getElementById('dept-modal-close');

  function openModal(deptId) {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;

    const iconEl = modalBox.querySelector('.modal-icon');
    iconEl.style.background = `linear-gradient(135deg, ${dept.color}40, ${dept.color})`;

    modalBox.querySelector('.modal-dept-name').textContent = `แผนกวิชา${dept.name}`;
    modalBox.querySelector('.modal-dept-sub').textContent = 'จำลองแผนการเรียนระดับ ปวช. ปี 1';
    modalBox.style.borderTop = `3px solid ${dept.color}`;

    const planGrid = modalBox.querySelector('.study-plan-grid');
    planGrid.innerHTML = dept.studyPlan.map(term => `
      <div class="study-term">
        <div class="study-term-title" style="color: ${dept.color}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          ${term.semester}
        </div>
        <ul>
          ${term.subjects.map(s => `
            <li>
              <span style="background:${dept.color}; border-radius:50%; width:6px; height:6px; display:inline-block; margin-top:0.45rem; flex-shrink:0;"></span>
              ${s}
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Open on dept card click
  document.querySelectorAll('[data-dept]').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.dept));
  });

  // Close handlers
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
})();

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
(function () {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 120);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach(el => {
    observer.observe(el);
  });
})();
