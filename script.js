// --- ตั้งค่าการเชื่อมต่อ Supabase ---
const SUPABASE_URL = 'https://wtyvtjvzvgurybtcnnsf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_JLPzS9fSB0-mJN9D3Vssiw_ibQEXq4d'; 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ตรวจสอบสิทธิ์การเข้าใช้งานหน้าหลักแบบเข้มงวด ---
async function checkUserAuth() {
    const { data: { session }, error } = await sb.auth.getSession();
    if (!session || error) {
        window.location.replace('login.html');
    }
}
checkUserAuth();

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
}

let directoryOffset = 0;
const PAGE_LIMIT = 30;
let currentSearchTerm = '';

// นาฬิกา Real-time มุมขวาบน
setInterval(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH');
    const timeStr = now.toTimeString().split(' ')[0];
    const clockEl = document.getElementById('live-clock');
    if (clockEl) clockEl.innerText = `${dateStr} ${timeStr}`;
}, 1000);

// ระบบสลับแท็บเมนู
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'text-emerald-400');
        btn.classList.add('border-transparent', 'text-slate-400');
    });
    
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove('hidden');
    
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
        activeBtn.classList.add('border-emerald-500', 'text-emerald-400');
    }

    if (tabId === 'analytics') {
        loadDashboardStats();
        setTimeout(initCharts, 100);
    } else if (tabId === 'daily-logs') {
        loadDailyLogs();
    } else if (tabId === 'directory') {
        directoryOffset = 0;
        document.getElementById('vehicle-directory-grid').innerHTML = '';
        fetchDirectoryFromSupabase();
    }
}

// ค้นหาด่วนตามปุ่มตัวอย่าง
function quickSearch(seq) {
    const searchInput = document.getElementById('search-input');
    const searchForm = document.getElementById('search-form');
    if (searchInput) searchInput.value = seq;
    if (searchForm) searchForm.dispatchEvent(new Event('submit'));
}

// ฟอร์มค้นหาหน้าด่าน Quick Entry
document.addEventListener('DOMContentLoaded', () => {
    const searchFormEl = document.getElementById('search-form');
    if (searchFormEl) {
        searchFormEl.addEventListener('submit', async function(e) {
            e.preventDefault();
            const query = document.getElementById('search-input').value.trim();
            const container = document.getElementById('search-result-container');
            if (!container) return;
            
            container.classList.remove('hidden');
            container.innerHTML = `<div class="text-center py-6 text-slate-400 animate-pulse">⏳ กำลังดึงข้อมูลจากฐานข้อมูล Supabase...</div>`;

            try {
                let data = null;
                let error = null;

                if (!isNaN(query) && query !== '') {
                    const res = await sb.from('checkpoints').select('*').eq('id', query).limit(1);
                    data = res.data;
                    error = res.error;
                } else {
                    const res = await sb.from('checkpoints').select('*').or(`license_plate.ilike.%${query}%,full_name.ilike.%${query}%`).limit(1);
                    data = res.data;
                    error = res.error;
                }

                if (error) throw error;

                if (!data || data.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-8 text-rose-400">
                            ❌ ไม่พบข้อมูลลำดับหรือทะเบียน "${query}" ในระบบ กรุณาตรวจสอบใหม่อีกครั้ง
                        </div>
                    `;
                    return;
                }

                const record = data[0];
                const recId = record.id !== undefined ? record.id : '-';
                const recName = record.full_name || record.name || 'ไม่ระบุชื่อ';
                const recPlate = record.license_plate || record.plate || '-';
                const recBrand = record.brand || record.vehicle_type || 'รถยนต์/จยย.';
                const recColor = record.color || '-';
                const recLocation = record.remarks || record.note || 'ด่านนอแล';

                container.innerHTML = `
                    <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                        <span class="text-xl font-bold text-emerald-400">ลำดับที่: #${recId}</span>
                        <button onclick="openDetailModal(${recId})" class="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-emerald-400 flex items-center gap-1 font-semibold transition">
                            👁️ ดูประวัติ Timestamp & รูปถ่าย Pop-up
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <p class="text-slate-300"><strong>ชื่อ-นามสกุล:</strong> <span class="text-white font-semibold">${recName}</span></p>
                            <p class="text-slate-300"><strong>ชนิด/ทะเบียน:</strong> <span class="text-white font-semibold">${recBrand} - สี${recColor} [${recPlate}]</span></p>
                            <p class="text-slate-300"><strong>หมายเหตุ/พื้นที่:</strong> <span class="text-emerald-400 font-semibold">${recLocation}</span></p>
                        </div>
                        
                        <div class="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-wider">📸 บันทึกหลักฐานภาพถ่าย</h4>
                            <div>
                                <label class="block text-xs font-medium text-slate-300 mb-1">ถ่ายภาพบัตรประจำตัวประชาชน</label>
                                <input type="file" id="id-card-capture" accept="image/*" capture="environment" class="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-slate-300 mb-1">ถ่ายภาพยานพาหนะ / ป้ายทะเบียน</label>
                                <input type="file" id="vehicle-capture" accept="image/*" capture="environment" class="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer">
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3 pt-6 mt-6 border-t border-slate-800">
                        <button onclick="handleRecordAction(${recId}, 'IN', '${recName}', '${recPlate}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold shadow transition flex items-center justify-center gap-2">
                            📥 บันทึกเข้า (IN) พร้อมภาพถ่าย
                        </button>
                        <button onclick="handleRecordAction(${recId}, 'OUT', '${recName}', '${recPlate}')" class="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-bold shadow transition flex items-center justify-center gap-2">
                            📤 บันทึกออก (OUT) พร้อมภาพถ่าย
                        </button>
                    </div>
                `;
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div class="text-center py-6 text-rose-400">❌ เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}</div>`;
            }
        });
    }

    fetchDirectoryFromSupabase();
    loadDailyLogs();
});

// ฟังก์ชันบันทึกข้อมูลเข้า-ออก และบันทึกลงตาราง log แบบสมบูรณ์
async function handleRecordAction(id, actionType, name = '', plate = '') {
    const idCardInput = document.getElementById('id-card-capture');
    const vehicleInput = document.getElementById('vehicle-capture');

    let idCardUrl = null;
    let vehicleUrl = null;

    try {
        if (idCardInput && idCardInput.files.length > 0) {
            const file = idCardInput.files[0];
            const filePath = `id_cards/${Date.now()}_${file.name}`;
            const { error: uploadError } = await sb.storage.from('checkpoint-images').upload(filePath, file);
            if (!uploadError) {
                const { data: pubData } = sb.storage.from('checkpoint-images').getPublicUrl(filePath);
                idCardUrl = pubData.publicUrl;
            }
        }

        if (vehicleInput && vehicleInput.files.length > 0) {
            const file = vehicleInput.files[0];
            const filePath = `vehicles/${Date.now()}_${file.name}`;
            const { error: uploadError } = await sb.storage.from('checkpoint-images').upload(filePath, file);
            if (!uploadError) {
                const { data: pubData } = sb.storage.from('checkpoint-images').getPublicUrl(filePath);
                vehicleUrl = pubData.publicUrl;
            }
        }

        const nowIso = new Date().toISOString();

        // 1. อัปเดตสถานะล่าสุดใน checkpoints
        const updatePayload = {
            status: actionType,
            last_timestamp: nowIso
        };
        if (idCardUrl) updatePayload.id_card_url = idCardUrl;
        if (vehicleUrl) updatePayload.vehicle_photo_url = vehicleUrl;
        
        await sb.from('checkpoints').update(updatePayload).eq('id', id);

        // 2. บันทึกลง checkpoint_logs
        await sb.from('checkpoint_logs').insert([{
            checkpoint_id: id,
            action_type: actionType,
            full_name: name,
            license_plate: plate,
            gate_name: 'ด่านนอแล',
            created_at: nowIso
        }]);

        alert(`✅ บันทึกสถานะ ${actionType} สำหรับลำดับที่ #${id} (${name}) สำเร็จเรียบร้อย!`);
        loadDailyLogs();

    } catch (err) {
        console.error('Record action error:', err);
        alert(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    }
}

// ➕ ระบบลงทะเบียนบุคคล / ยานพาหนะใหม่
function openAddPersonModal() {
    const modal = document.getElementById('add-person-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddPersonModal() {
    const modal = document.getElementById('add-person-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAddNewPerson(e) {
    e.preventDefault();
    const fullName = document.getElementById('new-fullname').value.trim();
    const plate = document.getElementById('new-plate').value.trim();
    const brand = document.getElementById('new-brand').value.trim();
    const color = document.getElementById('new-color').value.trim();
    const remarks = document.getElementById('new-remarks').value.trim() || 'ด่านนอแล';

    if (!fullName || !plate) {
        alert('กรุณากรอกชื่อ-นามสกุล และทะเบียนรถให้ครบถ้วน');
        return;
    }

    try {
        const { error } = await sb.from('checkpoints').insert([{
            full_name: fullName,
            license_plate: plate,
            brand: brand || 'รถยนต์/จยย.',
            vehicle_type: brand || 'รถยนต์/จยย.',
            color: color || '-',
            remarks: remarks,
            status: 'OUT'
        }]);

        if (error) throw error;

        alert(`✅ ลงทะเบียน "${fullName}" (ทะเบียน ${plate}) สำเร็จ!`);
        closeAddPersonModal();
        document.getElementById('add-person-form').reset();
        
        if (typeof fetchDirectoryFromSupabase === 'function') fetchDirectoryFromSupabase();
        quickSearch(plate);

    } catch (err) {
        console.error('Add person error:', err);
        alert(`❌ ไม่สามารถเพิ่มข้อมูลได้: ${err.message}`);
    }
}

// โหลดประวัติรายวันจริงจาก Supabase
async function loadDailyLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    try {
        const { data, error } = await sb.from('checkpoint_logs').select('*').order('created_at', { ascending: false }).limit(100);
        
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-slate-400">ยังไม่มีประวัติการผ่านด่านที่บันทึกหลังจากเปิดใช้งานระบบ</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(log => {
            const timeFormatted = new Date(log.created_at).toLocaleString('th-TH');
            const badgeClass = log.action_type === 'IN' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            return `
                <tr class="hover:bg-slate-800/50 transition">
                    <td class="px-6 py-4 font-mono text-xs text-slate-300">${timeFormatted}</td>
                    <td class="px-6 py-4 font-bold text-emerald-400">#${log.checkpoint_id || '-'}</td>
                    <td class="px-6 py-4"><span class="${badgeClass} px-2.5 py-1 rounded text-xs font-bold border">${log.action_type}</span></td>
                    <td class="px-6 py-4">${log.license_plate || '-'}</td>
                    <td class="px-6 py-4 font-medium">${log.full_name || '-'}</td>
                    <td class="px-6 py-4 text-xs text-slate-400">${log.gate_name || 'ด่านนอแล'}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading logs:', err);
    }
}

// โหลดข้อมูล Tab Directory
async function fetchDirectoryFromSupabase() {
    const grid = document.getElementById('vehicle-directory-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!grid) return;

    try {
        let queryBuilder = sb.from('checkpoints').select('*').order('id', { ascending: true });

        if (currentSearchTerm) {
            if (!isNaN(currentSearchTerm)) {
                queryBuilder = queryBuilder.eq('id', currentSearchTerm);
            } else {
                queryBuilder = queryBuilder.or(`license_plate.ilike.%${currentSearchTerm}%,full_name.ilike.%${currentSearchTerm}%,brand.ilike.%${currentSearchTerm}%`);
            }
        }

        const { data, error } = await queryBuilder.range(directoryOffset, directoryOffset + PAGE_LIMIT - 1);
        if (error) throw error;

        if (!data || data.length === 0) {
            if (directoryOffset === 0) {
                grid.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-400">ไม่พบข้อมูลลำดับหรือรายการที่ค้นหาในระบบ</div>`;
            }
            if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
            return;
        }

        const cardsHtml = data.map(item => {
            const recId = item.id !== undefined ? item.id : '-';
            const recName = item.full_name || item.name || '-';
            const recPlate = item.license_plate || item.plate || '-';
            const recBrand = item.brand || item.vehicle_type || '-';
            const recColor = item.color || '-';
            const recLocation = item.remarks || item.note || 'ด่านนอแล';

            return `
                <div onclick="openDetailModal(${recId})" class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg hover:border-emerald-500/50 transition cursor-pointer flex flex-col justify-between group">
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-emerald-400 font-bold text-lg">#${recId}</span>
                            <span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-semibold border border-emerald-500/30">${recLocation}</span>
                        </div>
                        <h4 class="font-bold text-slate-100 group-hover:text-emerald-300 transition">${recName}</h4>
                        <p class="text-xs text-slate-400 mt-1">🚗 ${recBrand} | ทะเบียน: <strong class="text-white">${recPlate}</strong></p>
                        <p class="text-xs text-slate-400 mt-1">🎨 สี: ${recColor}</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-slate-800 text-xs text-emerald-400 font-medium group-hover:underline">
                        👁️ ดูรูปถ่าย & Timestamp สะสม &rarr;
                    </div>
                </div>
            `;
        }).join('');

        if (directoryOffset === 0) {
            grid.innerHTML = cardsHtml;
        } else {
            grid.insertAdjacentHTML('beforeend', cardsHtml);
        }

        if (data.length < PAGE_LIMIT) {
            if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        } else {
            if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');
        }

    } catch (err) {
        console.error('Error fetching directory:', err);
    }
}

// Modal รายละเอียด Pop-up
async function openDetailModal(id) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;

    document.getElementById('modal-seq').innerText = `#${id}`;
    document.getElementById('modal-name').innerText = 'กำลังโหลดข้อมูล...';
    document.getElementById('modal-vehicle').innerText = '';
    
    document.getElementById('modal-id-card-img').classList.add('hidden');
    document.getElementById('modal-id-card-placeholder').classList.remove('hidden');
    document.getElementById('modal-vehicle-img').classList.add('hidden');
    document.getElementById('modal-vehicle-placeholder').classList.remove('hidden');
    document.getElementById('modal-timestamp-logs').innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-500 animate-pulse">⏳ กำลังโหลดประวัติ...</td></tr>`;

    modal.classList.remove('hidden');

    try {
        const { data } = await sb.from('checkpoints').select('*').eq('id', id).single();
        if (data) {
            document.getElementById('modal-name').innerText = data.full_name || 'ไม่ระบุชื่อ';
            document.getElementById('modal-vehicle').innerText = `ชนิด/ยี่ห้อ: ${data.brand || '-'} | ทะเบียน: ${data.license_plate || '-'}`;

            if (data.id_card_url) {
                const img = document.getElementById('modal-id-card-img');
                img.src = data.id_card_url;
                img.classList.remove('hidden');
                document.getElementById('modal-id-card-placeholder').classList.add('hidden');
            }
            if (data.vehicle_photo_url) {
                const img = document.getElementById('modal-vehicle-img');
                img.src = data.vehicle_photo_url;
                img.classList.remove('hidden');
                document.getElementById('modal-vehicle-placeholder').classList.add('hidden');
            }
        }

        const { data: logsData } = await sb.from('checkpoint_logs').select('*').eq('checkpoint_id', id).order('created_at', { ascending: false });
        const tbody = document.getElementById('modal-timestamp-logs');
        
        if (!logsData || logsData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-slate-500">ยังไม่มีประวัติการสัญจร</td></tr>`;
        } else {
            tbody.innerHTML = logsData.map(l => `
                <tr class="hover:bg-slate-900 transition">
                    <td class="px-4 py-2.5 font-mono text-slate-300">${new Date(l.created_at).toLocaleString('th-TH')}</td>
                    <td class="px-4 py-2.5"><span class="${l.action_type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} px-2 py-0.5 rounded text-[10px] font-bold">${l.action_type}</span></td>
                    <td class="px-4 py-2.5 text-slate-400">${l.gate_name || 'ด่านนอแล'}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Modal error:', err);
    }
}

function closeModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.add('hidden');
}

// สรุปยอดกะ (Shift Summary)
async function openShiftSummaryModal() {
    const modal = document.getElementById('shiftModal');
    if (!modal) modal.classList.remove('hidden');
    // โหลดสถิติต่างๆ ตามโครงสร้างเดิม
}
function closeShiftSummaryModal() {
    const modal = document.getElementById('shiftModal');
    if (modal) modal.classList.add('hidden');
}
