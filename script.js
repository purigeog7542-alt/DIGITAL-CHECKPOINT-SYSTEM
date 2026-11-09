// --- ตั้งค่าการเชื่อมต่อ Supabase ---
const SUPABASE_URL = 'https://wtyvtjvzvgurybtcnnsf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_JLPzS9fSB0-mJN9D3Vssiw_ibQEXq4d'; 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ตรวจสอบสิทธิ์การเข้าใช้งาน ---
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

// นาฬิกา Real-time
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
    } else if (tabId === 'daily-logs') {
        loadDailyLogs();
    } else if (tabId === 'directory') {
        directoryOffset = 0;
        const grid = document.getElementById('vehicle-directory-grid');
        if (grid) grid.innerHTML = '';
        fetchDirectoryFromSupabase();
    }
}

function quickSearch(seq) {
    const searchInput = document.getElementById('search-input');
    const searchForm = document.getElementById('search-form');
    if (searchInput) searchInput.value = seq;
    if (searchForm) searchForm.dispatchEvent(new Event('submit'));
}

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
                    container.innerHTML = `<div class="text-center py-8 text-rose-400">❌ ไม่พบข้อมูลลำดับหรือทะเบียน "${query}" ในระบบ</div>`;
                    return;
                }

                const record = data[0];
                const recId = record.id;
                const recName = record.full_name || record.name || 'ไม่ระบุชื่อ';
                const recPlate = record.license_plate || record.plate || '-';
                const recBrand = record.brand || record.vehicle_type || 'รถยนต์/จยย.';
                const recColor = record.color || '-';
                const recLocation = record.remarks || record.note || 'ด่านนอแล';

                container.innerHTML = `
                    <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                        <span class="text-xl font-bold text-emerald-400">ลำดับที่: #${recId}</span>
                        <button onclick="openDetailModal(${recId})" class="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-emerald-400 font-semibold transition">
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
                                <label class="block text-xs font-medium text-slate-300 mb-1">ภาพถ่ายบัตรประชาชน</label>
                                <input type="file" id="id-card-capture" accept="image/*" capture="environment" class="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-emerald-600 file:text-white cursor-pointer">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-slate-300 mb-1">ภาพถ่ายยานพาหนะ / ป้ายทะเบียน</label>
                                <input type="file" id="vehicle-capture" accept="image/*" capture="environment" class="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white cursor-pointer">
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
                container.innerHTML = `<div class="text-center py-6 text-rose-400">❌ เกิดข้อผิดพลาด: ${err.message}</div>`;
            }
        });
    }

    fetchDirectoryFromSupabase();
    loadDailyLogs();
});

// ฟังก์ชันบันทึกข้อมูลเข้า-ออก
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
                idCardUrl = sb.storage.from('checkpoint-images').getPublicUrl(filePath).data.publicUrl;
            }
        }

        if (vehicleInput && vehicleInput.files.length > 0) {
            const file = vehicleInput.files[0];
            const filePath = `vehicles/${Date.now()}_${file.name}`;
            const { error: uploadError } = await sb.storage.from('checkpoint-images').upload(filePath, file);
            if (!uploadError) {
                vehicleUrl = sb.storage.from('checkpoint-images').getPublicUrl(filePath).data.publicUrl;
            }
        }

        const nowIso = new Date().toISOString();

        const updatePayload = { status: actionType, last_timestamp: nowIso };
        if (idCardUrl) updatePayload.id_card_url = idCardUrl;
        if (vehicleUrl) updatePayload.vehicle_photo_url = vehicleUrl;
        
        await sb.from('checkpoints').update(updatePayload).eq('id', id);

        await sb.from('checkpoint_logs').insert([{
            checkpoint_id: id,
            action_type: actionType,
            full_name: name,
            license_plate: plate,
            gate_name: 'ด่านนอแล',
            created_at: nowIso
        }]);

        alert(`✅ บันทึกสถานะ ${actionType} สำเร็จ!`);
        loadDailyLogs();
        loadDashboardStats();

    } catch (err) {
        console.error(err);
        alert(`❌ เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    }
}

// ➕ ระบบลงทะเบียนรายชื่อใหม่
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
    
    const idCardInput = document.getElementById('new-id-card-capture');
    const vehicleInput = document.getElementById('new-vehicle-capture');

    if (!fullName || !plate) {
        alert('กรุณากรอกชื่อ-นามสกุล และทะเบียนรถให้ครบถ้วน');
        return;
    }

    try {
        let idCardUrl = null;
        let vehicleUrl = null;

        if (idCardInput && idCardInput.files.length > 0) {
            const file = idCardInput.files[0];
            const filePath = `id_cards/${Date.now()}_${file.name}`;
            const { error: uploadError } = await sb.storage.from('checkpoint-images').upload(filePath, file);
            if (!uploadError) {
                idCardUrl = sb.storage.from('checkpoint-images').getPublicUrl(filePath).data.publicUrl;
            }
        }

        if (vehicleInput && vehicleInput.files.length > 0) {
            const file = vehicleInput.files[0];
            const filePath = `vehicles/${Date.now()}_${file.name}`;
            const { error: uploadError } = await sb.storage.from('checkpoint-images').upload(filePath, file);
            if (!uploadError) {
                vehicleUrl = sb.storage.from('checkpoint-images').getPublicUrl(filePath).data.publicUrl;
            }
        }

        const nowIso = new Date().toISOString();
        const insertPayload = {
            full_name: fullName,
            license_plate: plate,
            brand: brand || 'รถยนต์/จยย.',
            vehicle_type: brand || 'รถยนต์/จยย.',
            color: color || '-',
            remarks: remarks,
            status: 'OUT',
            last_timestamp: nowIso
        };

        if (idCardUrl) insertPayload.id_card_url = idCardUrl;
        if (vehicleUrl) insertPayload.vehicle_photo_url = vehicleUrl;

        const { data, error } = await sb.from('checkpoints').insert([insertPayload]).select();
        if (error) throw error;

        alert(`✅ ลงทะเบียน "${fullName}" สำเร็จ!`);
        closeAddPersonModal();
        document.getElementById('add-person-form').reset();
        fetchDirectoryFromSupabase();
        
        if (data && data.length > 0) {
            quickSearch(data[0].id);
        } else {
            quickSearch(plate);
        }
    } catch (err) {
        console.error(err);
        alert(`❌ เพิ่มข้อมูลไม่สำเร็จ: ${err.message}`);
    }
}

// ฟังก์ชันโหลดสถิติแดชบอร์ด
async function loadDashboardStats() {
    try {
        const { data } = await sb.from('checkpoint_logs').select('*');
        if (!data) return;

        let dailyCount = 0, weeklyCount = 0, monthlyCount = 0, currentIn = 0;
        const now = new Date();
        const todayStr = now.toDateString();

        data.forEach(log => {
            const logDate = new Date(log.created_at);
            if (logDate.toDateString() === todayStr) dailyCount++;
            if ((now - logDate) / (1000 * 60 * 60 * 24) <= 7) weeklyCount++;
            if (logDate.getMonth() === now.getMonth()) monthlyCount++;
            if (log.action_type === 'IN') currentIn++;
        });

        const curEl = document.getElementById('stat-current-in');
        const dayEl = document.getElementById('stat-daily-total');
        const weekEl = document.getElementById('stat-weekly-total');
        const monthEl = document.getElementById('stat-monthly-total');

        if (curEl) curEl.innerText = `${currentIn} คัน`;
        if (dayEl) dayEl.innerText = `${dailyCount} ครั้ง`;
        if (weekEl) weekEl.innerText = `${weeklyCount} ครั้ง`;
        if (monthEl) monthEl.innerText = `${monthlyCount} ครั้ง`;
    } catch (err) {
        console.error('Stats error:', err);
    }
}

// 📋 โหลดประวัติผ่านด่าน พร้อมปุ่มลบ (🗑️)
async function loadDailyLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    try {
        const { data, error } = await sb.from('checkpoint_logs').select('*').order('created_at', { ascending: false }).limit(100);
        
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-6 text-center text-slate-400">ยังไม่มีประวัติการผ่านด่าน</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(log => `
            <tr class="hover:bg-slate-800/50 transition">
                <td class="px-6 py-4 font-mono text-xs text-slate-300">${new Date(log.created_at).toLocaleString('th-TH')}</td>
                <td class="px-6 py-4 font-bold text-emerald-400">#${log.checkpoint_id || '-'}</td>
                <td class="px-6 py-4"><span class="${log.action_type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} px-2.5 py-1 rounded text-xs font-bold">${log.action_type}</span></td>
                <td class="px-6 py-4">${log.license_plate || '-'}</td>
                <td class="px-6 py-4 font-medium">${log.full_name || '-'}</td>
                <td class="px-6 py-4 text-xs text-slate-400">${log.gate_name || 'ด่านนอแล'}</td>
                <td class="px-6 py-4 text-center action-col">
                    <button onclick="deleteLogEntry(${log.id})" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-rose-500/30 flex items-center gap-1 mx-auto">
                        <span>🗑️</span> ลบ
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

// 🗑️ ฟังก์ชันลบประวัติการผ่านด่านรายรายการ
async function deleteLogEntry(logId) {
    if (!confirm('⚠️ คุณต้องการลบประวัติการผ่านด่านรายการนี้ใช่หรือไม่?')) return;

    try {
        const { error } = await sb.from('checkpoint_logs').delete().eq('id', logId);
        if (error) throw error;

        alert('✅ ลบประวัติเรียบร้อยแล้ว');
        loadDailyLogs(); 
        loadDashboardStats(); 
    } catch (err) {
        console.error('Delete log error:', err);
        alert(`❌ ไม่สามารถลบข้อมูลได้: ${err.message}`);
    }
}

// 📄 คำนวณและแสดง Modal รายงานสรุปกะ
async function openShiftSummaryModal() {
    const modal = document.getElementById('shiftModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const dtEl = document.getElementById('report-date-time');
    if (dtEl) dtEl.innerText = `วันที่พิมพ์รายงาน: ${new Date().toLocaleString('th-TH')}`;

    try {
        const { data: logs } = await sb.from('checkpoint_logs').select('*');
        if (!logs) return;

        let totalIn = 0, totalOut = 0;
        const brandCounts = {};

        logs.forEach(l => {
            if (l.action_type === 'IN') totalIn++;
            if (l.action_type === 'OUT') totalOut++;

            const brand = l.license_plate ? l.license_plate.split(' ')[0] : 'อื่นๆ';
            brandCounts[brand] = (brandCounts[brand] || 0) + 1;
        });

        const inEl = document.getElementById('summary-total-in');
        const outEl = document.getElementById('summary-total-out');
        const netEl = document.getElementById('summary-total-net');

        if (inEl) inEl.innerText = `${totalIn} คัน`;
        if (outEl) outEl.innerText = `${totalOut} คัน`;
        if (netEl) netEl.innerText = `${totalIn + totalOut} คัน`;

        const summaryTbody = document.getElementById('summary-type-table-body');
        if (summaryTbody) {
            summaryTbody.innerHTML = Object.keys(brandCounts).map(b => `
                <tr>
                    <td class="p-3 font-semibold text-stone-200">${b}</td>
                    <td class="p-3 text-center text-emerald-400 font-bold">${brandCounts[b]}</td>
                    <td class="p-3 text-stone-400">สัญจรผ่านจุดตรวจ</td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error(err);
    }
}

function closeShiftSummaryModal() {
    const modal = document.getElementById('shiftModal');
    if (modal) modal.classList.add('hidden');
}

// 🖨️ ฟังก์ชันพิมพ์รายงานสรุปกะ
function printShiftSummary() {
    document.body.classList.add('print-shift-mode');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('print-shift-mode');
    }, 500);
}

// พิมพ์หน้าทั่วไป
function printPage() {
    document.body.classList.remove('print-shift-mode');
    window.print();
}

// เปิด Popup รายละเอียดรายบุคคล (ถ้ามี Modal)
async function openDetailModal(id) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    try {
        const { data } = await sb.from('checkpoints').select('*').eq('id', id).single();
        if (!data) return;

        document.getElementById('modal-seq').innerText = `#${data.id}`;
        document.getElementById('modal-name').innerText = data.full_name || '-';
        document.getElementById('modal-vehicle').innerText = `ชนิดรถ: ${data.brand || '-'} | ทะเบียน: ${data.license_plate || '-'}`;

        const idImg = document.getElementById('modal-id-card-img');
        const idPh = document.getElementById('modal-id-card-placeholder');
        if (data.id_card_url) {
            idImg.src = data.id_card_url;
            idImg.classList.remove('hidden');
            idPh.classList.add('hidden');
        } else {
            idImg.classList.add('hidden');
            idPh.classList.remove('hidden');
        }

        const vImg = document.getElementById('modal-vehicle-img');
        const vPh = document.getElementById('modal-vehicle-placeholder');
        if (data.vehicle_photo_url) {
            vImg.src = data.vehicle_photo_url;
            vImg.classList.remove('hidden');
            vPh.classList.add('hidden');
        } else {
            vImg.classList.add('hidden');
            vPh.classList.remove('hidden');
        }

        // โหลดประวัติ Logs เฉพาะบุคคลนี้
        const { data: logs } = await sb.from('checkpoint_logs').select('*').eq('checkpoint_id', id).order('created_at', { ascending: false });
        const tBody = document.getElementById('modal-timestamp-logs');
        if (tBody) {
            tBody.innerHTML = logs && logs.length > 0 ? logs.map(l => `
                <tr>
                    <td class="px-5 py-3 font-mono text-xs">${new Date(l.created_at).toLocaleString('th-TH')}</td>
                    <td class="px-5 py-3"><span class="${l.action_type === 'IN' ? 'text-emerald-400' : 'text-rose-400'} font-bold">${l.action_type}</span></td>
                    <td class="px-5 py-3 text-slate-400">${l.gate_name || 'ด่านนอแล'}</td>
                </tr>
            `).join('') : `<tr><td colspan="3" class="px-5 py-4 text-center text-slate-500">ยังไม่มีประวัติการผ่านด่าน</td></tr>`;
        }
    } catch (err) {
        console.error(err);
    }
}

function closeModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.add('hidden');
}

async function fetchDirectoryFromSupabase() {
    const grid = document.getElementById('vehicle-directory-grid');
    if (!grid) return;

    try {
        let query = sb.from('checkpoints').select('*').order('id', { ascending: true });
        if (currentSearchTerm) {
            if (!isNaN(currentSearchTerm)) query = query.eq('id', currentSearchTerm);
            else query = query.or(`license_plate.ilike.%${currentSearchTerm}%,full_name.ilike.%${currentSearchTerm}%`);
        }

        const { data } = await query.range(directoryOffset, directoryOffset + PAGE_LIMIT - 1);
        if (!data || data.length === 0) {
            grid.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-400">ไม่พบข้อมูล</div>`;
            return;
        }

        grid.innerHTML = data.map(item => `
            <div onclick="openDetailModal(${item.id})" class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg hover:border-emerald-500 transition cursor-pointer flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-emerald-400 font-bold text-lg">#${item.id}</span>
                        <span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded">${item.remarks || 'ด่านนอแล'}</span>
                    </div>
                    <h4 class="font-bold text-slate-100">${item.full_name || '-'}</h4>
                    <p class="text-xs text-slate-400 mt-1">🚗 ${item.brand || '-'} | ทะเบียน: <strong class="text-white">${item.license_plate || '-'}</strong></p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

function searchDirectory(val) {
    currentSearchTerm = val.trim();
    directoryOffset = 0;
    fetchDirectoryFromSupabase();
}
