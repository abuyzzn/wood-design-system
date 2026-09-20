// Global variables
let currentUser = null;
let currentPeriod = 'week';
const API_BASE = '/api';

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await fetch(API_BASE + '/user').then(r => r.json());

        if (!currentUser.userId) {
            window.location.href = '/login';
            return;
        }

        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userRole').textContent = currentUser.role;

        // Load audit link for owner
        if (currentUser.role === 'المالك') {
            document.getElementById('auditLinkContainer').innerHTML =
                '<a href="javascript:showAuditLogs()">📋 عرض سجل التعديلات الكاملة</a>';
        }

        // Setup period selector
        document.getElementById('periodSelector').addEventListener('change', (e) => {
            currentPeriod = e.target.value;
            loadDashboard();
        });

        // Load dashboard
        loadDashboard();

        // Setup input sections based on user role
        setupInputSections();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        window.location.href = '/login';
    }
});

async function loadDashboard() {
    try {
        // Load metrics
        const metrics = await fetch(`${API_BASE}/metrics?period=${currentPeriod}`).then(r => r.json());

        // Load targets
        const targets = await fetch(`${API_BASE}/targets`).then(r => r.json());

        // Load inventory
        const inventory = await fetch(`${API_BASE}/inventory`).then(r => r.json());

        // Calculate KPIs
        const kpis = calculateKPIs(metrics, targets, inventory);

        // Render dashboard
        renderDashboard(kpis);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function calculateKPIs(metrics, targets, inventory) {
    const targetObj = {};
    targets.forEach(t => {
        targetObj[t.department] = t;
    });

    const kpis = [];

    // Sales KPI
    const salesTarget = targetObj['المبيعات']?.monthly_target || 236500;
    const salesActual = metrics.sales?.total || 0;
    const salesPercent = (salesActual / salesTarget) * 100;
    kpis.push({
        title: 'المبيعات',
        department: 'المبيعات',
        target: salesTarget.toLocaleString('ar-SA'),
        actual: salesActual.toLocaleString('ar-SA'),
        percentage: salesPercent.toFixed(1),
        status: getStatus(salesPercent),
        description: 'المبلغ المالي'
    });

    // Production KPI
    const productionTarget = targetObj['الإنتاج']?.monthly_target || 275;
    const productionActual = metrics.production?.manufactured || 0;
    const productionPercent = (productionActual / productionTarget) * 100;
    kpis.push({
        title: 'الإنتاج',
        department: 'الإنتاج',
        target: productionTarget.toLocaleString('ar-SA'),
        actual: productionActual.toLocaleString('ar-SA'),
        percentage: productionPercent.toFixed(1),
        status: getStatus(productionPercent),
        description: 'عدد الأبواب المصنعة'
    });

    // Installation KPI
    const installTarget = targetObj['التركيب']?.monthly_target || 275;
    const installActual = metrics.production?.installed || 0;
    const installPercent = (installActual / installTarget) * 100;
    kpis.push({
        title: 'التركيب',
        department: 'التركيب',
        target: installTarget.toLocaleString('ar-SA'),
        actual: installActual.toLocaleString('ar-SA'),
        percentage: installPercent.toFixed(1),
        status: getStatus(installPercent),
        description: 'عدد الأبواب المركبة'
    });

    // Rework KPI
    const reworkCount = metrics.production?.rework || 0;
    const reworkPercent = 100 - ((reworkCount / (productionActual || 1)) * 100);
    kpis.push({
        title: 'إعادة العمل',
        department: 'الجودة',
        target: 'أقل من 5%',
        actual: reworkCount.toString(),
        percentage: reworkPercent.toFixed(1),
        status: reworkPercent > 95 ? 'green' : (reworkPercent > 80 ? 'yellow' : 'red'),
        description: 'عدد حالات الإعادة'
    });

    // Finance KPIs
    const receipts = metrics.finance?.receipts || 0;
    const payments = metrics.finance?.payments || 0;
    const netCash = receipts - payments;

    kpis.push({
        title: 'المقبوضات',
        department: 'المالية',
        target: 'متتبع',
        actual: receipts.toLocaleString('ar-SA'),
        percentage: 100,
        status: 'blue',
        description: 'النقد الداخل'
    });

    kpis.push({
        title: 'المدفوعات',
        department: 'المالية',
        target: 'متتبع',
        actual: payments.toLocaleString('ar-SA'),
        percentage: 100,
        status: 'blue',
        description: 'النقد الخارج'
    });

    kpis.push({
        title: 'صافي التدفق النقدي',
        department: 'المالية',
        target: 'موجب',
        actual: netCash.toLocaleString('ar-SA'),
        percentage: netCash > 0 ? 100 : 50,
        status: netCash > 0 ? 'green' : 'red',
        description: 'المقبوضات - المدفوعات'
    });

    // Inventory KPI (inverse - lower is better)
    const inventoryValue = inventory?.inventory_value || 326557.53;
    const inventoryTarget = 261000;
    const inventoryPercent = (inventoryTarget / inventoryValue) * 100;
    kpis.push({
        title: 'المخزون',
        department: 'المخزون',
        target: inventoryTarget.toLocaleString('ar-SA'),
        actual: inventoryValue.toLocaleString('ar-SA'),
        percentage: inventoryPercent.toFixed(1),
        status: inventoryPercent >= 100 ? 'green' : (inventoryPercent >= 80 ? 'yellow' : 'red'),
        description: 'قيمة المخزون'
    });

    // Fixed obligations
    kpis.push({
        title: 'القرض الشهري',
        department: 'الالتزامات',
        target: '10,000 ريال',
        actual: '10,000 ريال',
        percentage: 100,
        status: 'blue',
        description: 'التزام ثابت'
    });

    kpis.push({
        title: 'الإيجار الشهري',
        department: 'الالتزامات',
        target: '10,000 ريال',
        actual: '10,000 ريال',
        percentage: 100,
        status: 'blue',
        description: 'التزام ثابت'
    });

    return kpis;
}

function getStatus(percentage) {
    if (percentage >= 100) return 'green';
    if (percentage >= 80) return 'yellow';
    return 'red';
}

function renderDashboard(kpis) {
    const grid = document.getElementById('kpiGrid');

    // Count critical items
    const criticalCount = kpis.filter(k => k.status === 'red').length;
    document.getElementById('criticalCount').textContent = criticalCount;

    // Overall status
    const allStatuses = kpis.filter(k => k.status !== 'blue').map(k => k.status);
    let overallStatus = 'green';
    if (allStatuses.includes('red')) overallStatus = 'red';
    else if (allStatuses.includes('yellow')) overallStatus = 'yellow';

    const statusText = {
        'green': '🟢 مستقر',
        'yellow': '🟡 يحتاج متابعة',
        'red': '🔴 يحتاج تدخل'
    };

    document.getElementById('overallStatus').className = 'status-badge status-' + overallStatus;
    document.getElementById('overallStatus').textContent = statusText[overallStatus];

    // Render KPI cards
    grid.innerHTML = kpis.map(kpi => `
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-title">${kpi.title}</span>
                <span class="kpi-status status-${kpi.status}">${getStatusEmoji(kpi.status)}</span>
            </div>
            <div class="kpi-content">
                <div class="kpi-row">
                    <span class="kpi-label">الهدف</span>
                    <span class="kpi-value">${kpi.target}</span>
                </div>
                <div class="kpi-row">
                    <span class="kpi-label">الفعلي</span>
                    <span class="kpi-value">${kpi.actual}</span>
                </div>
                <div class="kpi-row">
                    <span class="kpi-label">النسبة</span>
                    <span class="kpi-value">${kpi.percentage}%</span>
                </div>
                ${kpi.status !== 'blue' ? `
                    <div class="progress-bar">
                        <div class="progress-fill progress-${kpi.status}" style="width: ${Math.min(kpi.percentage, 100)}%"></div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function setupInputSections() {
    const inputContainer = document.getElementById('inputSections');
    const sections = [];

    // Sales input
    if (['المبيعات', 'المالك', 'مدير المصنع'].includes(currentUser.role)) {
        sections.push({
            title: '📊 إضافة عملية بيع',
            id: 'sales-input',
            fields: [
                { label: 'تاريخ العملية', name: 'work_date', type: 'date', required: true },
                { label: 'قيمة العقد', name: 'contract_value', type: 'number', required: false },
                { label: 'الدفعة', name: 'payment_amount', type: 'number', required: false },
                { label: 'عدد الأبواب', name: 'doors_count', type: 'number', required: true },
                { label: 'نوع العملية', name: 'operation_type', type: 'select',
                  options: ['عقد جديد', 'دفعة من عقد جديد', 'تحصيل دفعة متأخرة'],
                  required: true }
            ],
            endpoint: '/api/sales',
            onSubmit: loadDashboard
        });
    }

    // Production input
    if (['مدير الإنتاج', 'المالك', 'مدير المصنع'].includes(currentUser.role)) {
        sections.push({
            title: '🏭 إضافة بيانات الإنتاج',
            id: 'production-input',
            fields: [
                { label: 'تاريخ العملية', name: 'work_date', type: 'date', required: true },
                { label: 'عدد الأبواب المصنعة', name: 'doors_manufactured', type: 'number', required: true },
                { label: 'عدد الأبواب المركبة', name: 'doors_installed', type: 'number', required: true },
                { label: 'حالات إعادة العمل', name: 'rework_count', type: 'number', required: false },
                { label: 'سبب المشكلة', name: 'problem_reason', type: 'text', required: false }
            ],
            endpoint: '/api/production',
            onSubmit: loadDashboard
        });
    }

    // Finance input
    if (['المالية', 'المالك', 'مدير المصنع'].includes(currentUser.role)) {
        sections.push({
            title: '💰 إضافة بيانات مالية',
            id: 'finance-input',
            fields: [
                { label: 'تاريخ العملية', name: 'work_date', type: 'date', required: true },
                { label: 'المقبوضات', name: 'receipts', type: 'number', required: false },
                { label: 'المدفوعات', name: 'payments', type: 'number', required: false },
                { label: 'المشتريات المحلية', name: 'local_purchases', type: 'number', required: false },
                { label: 'الرصيد النقدي', name: 'cash_balance', type: 'number', required: false },
                { label: 'الرصيد البنكي', name: 'bank_balance', type: 'number', required: false }
            ],
            endpoint: '/api/finance',
            onSubmit: loadDashboard
        });
    }

    // Inventory input
    if (['المخزون والمشتريات', 'المالك', 'مدير المصنع'].includes(currentUser.role)) {
        sections.push({
            title: '📦 تحديث المخزون',
            id: 'inventory-input',
            fields: [
                { label: 'تاريخ الجرد', name: 'work_date', type: 'date', required: true },
                { label: 'قيمة المخزون الحالية', name: 'inventory_value', type: 'number', required: true }
            ],
            endpoint: '/api/inventory',
            onSubmit: loadDashboard
        });
    }

    // Render input sections
    inputContainer.innerHTML = sections.map(section => `
        <div class="input-section">
            <h3>${section.title}</h3>
            <form id="${section.id}Form" class="input-form">
                <div class="form-row">
                    ${section.fields.map(field => `
                        <div class="form-group">
                            <label>${field.label}</label>
                            ${field.type === 'select' ? `
                                <select name="${field.name}" ${field.required ? 'required' : ''}>
                                    <option value="">اختر...</option>
                                    ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                                </select>
                            ` : `
                                <input type="${field.type}" name="${field.name}"
                                       placeholder="${field.label}"
                                       ${field.required ? 'required' : ''}>
                            `}
                        </div>
                    `).join('')}
                </div>
                <div class="btn-group">
                    <button type="submit" class="btn btn-primary">➕ إضافة</button>
                </div>
                <div id="${section.id}Message"></div>
            </form>
        </div>
    `).join('');

    // Attach submit handlers
    sections.forEach(section => {
        const form = document.getElementById(section.id + 'Form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const data = Object.fromEntries(formData);

                // Convert numeric fields
                Object.keys(data).forEach(key => {
                    if (key !== 'work_date' && key !== 'operation_type' && key !== 'problem_reason' && data[key]) {
                        data[key] = parseFloat(data[key]) || data[key];
                    }
                });

                try {
                    const response = await fetch(section.endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();

                    const msgDiv = document.getElementById(section.id + 'Message');
                    if (response.ok) {
                        msgDiv.innerHTML = '<div class="alert alert-success">✅ تم الإضافة بنجاح</div>';
                        form.reset();
                        section.onSubmit();
                        setTimeout(() => msgDiv.innerHTML = '', 3000);
                    } else {
                        msgDiv.innerHTML = `<div class="alert alert-error">❌ ${result.error}</div>`;
                    }
                } catch (error) {
                    document.getElementById(section.id + 'Message').innerHTML =
                        `<div class="alert alert-error">❌ خطأ في الإرسال</div>`;
                }
            });
        }
    });
}

function getStatusEmoji(status) {
    const emojis = {
        'green': '🟢',
        'yellow': '🟡',
        'red': '🔴',
        'blue': '🔵'
    };
    return emojis[status] || '⚪';
}

function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        window.location.href = '/logout';
    }
}

function showAuditLogs() {
    alert('سجل التعديلات قيد التطوير. سيتم إضافة صفحة متكاملة قريباً.');
}
