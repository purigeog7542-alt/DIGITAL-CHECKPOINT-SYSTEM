// --- ตั้งค่าการเชื่อมต่อ Supabase ---
const SUPABASE_URL = 'https://wtyvtjvzvgurybtcnnsf.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_JLPzS9fSB0-mJN9D3Vssiw_ibQEXq4d'; 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// ฟังก์ชันบันทึกข้อมูลเข้า-ออก และบันทึกลงตาราง log ใน Supabase จริง
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

        // 1. อัปเดตสถานะล่าสุดในตาราง checkpoints
        const updatePayload = {
            status: actionType,
            last_timestamp: nowIso
        };
        if (idCardUrl) updatePayload.id_card_url = idCardUrl;
        if (vehicleUrl) updatePayload.vehicle_photo_url = vehicleUrl;
        
        await sb.from('checkpoints').update(updatePayload).eq('id', id);

        // 2. บันทึกลงตารางประวัติ (checkpoint_logs) เพื่อเก็บ Timestamp จริงทุกครั้งที่มีการกด
        await sb.from('checkpoint_logs').insert([{
            checkpoint_id: id,
            action_type: actionType,
            full_name: name,
            license_plate: plate,
            gate_name: 'ด่านนอแล',
            created_at: nowIso
        }]).catch(err => console.log('Log insert note:', err));

    } catch (err) {
        console.warn('Storage/DB update warning:', err);
    }

    alert(`✅ บันทึกสถานะ ${actionType} สำหรับลำดับที่ #${id} (${name}) สำเร็จเรียบร้อย!`);
    loadDailyLogs();
}

// โหลดประวัติการผ่านด่านรายวันจริงจาก Supabase
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

// 📁 ดึงและแสดงข้อมูลทั้งหมดใน Tab 4 (รองรับการค้นหาด้วย ID/ลำดับรถ, ชื่อ, ทะเบียน, ยี่ห้อ)
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
                <div onclick="openDetailModal(${recId})" class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/5 transition cursor-pointer flex flex-col justify-between group">
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-emerald-400 font-bold text-lg">#${recId}</span>
                            <span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-semibold border border-emerald-500/30">${recLocation}</span>
                        </div>
                        <h4 class="font-bold text-slate-100 group-hover:text-emerald-300 transition">${recName}</h4>
                        <p class="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><span>🚗</span> ${recBrand} | ทะเบียน: <strong class="text-white">${recPlate}</strong></p>
                        <p class="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><span>🎨</span> สี: ${recColor}</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                        <span class="text-emerald-400 font-medium group-hover:underline">👁️ ดูรูปถ่ายบัตร/รถ & Timestamp สะสม &rarr;</span>
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
        grid.innerHTML = `<div class="col-span-3 text-center py-8 text-rose-400">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</div>`;
    }
}

// ค้นหาในหน้า Directory
function searchDirectory(val) {
    currentSearchTerm = val.trim();
    directoryOffset = 0;
    fetchDirectoryFromSupabase();
}

// โหลดเพิ่ม
function loadMoreDirectory() {
    directoryOffset += PAGE_LIMIT;
    fetchDirectoryFromSupabase();
}

// 📌 ฟังก์ชันเปิด POP-UP MODAL แสดงรูปภาพ & ประวัติ Timestamp จริงที่บันทึกสะสม
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

    document.getElementById('modal-timestamp-logs').innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-500 animate-pulse">⏳ กำลังโหลดประวัติ Timestamp สะสม...</td></tr>`;

    modal.classList.remove('hidden');

    try {
        const { data, error } = await sb.from('checkpoints').select('*').eq('id', id).single();
        if (!error && data) {
            const name = data.full_name || data.name || 'ไม่ระบุชื่อ';
            const plate = data.license_plate || data.plate || '-';
            const brand = data.brand || data.vehicle_type || '-';
            const color = data.color || '-';

            document.getElementById('modal-name').innerText = name;
            document.getElementById('modal-vehicle').innerText = `ชนิด/ยี่ห้อ: ${brand} | ทะเบียน: ${plate} | สี: ${color}`;

            if (data.id_card_url) {
                const imgEl = document.getElementById('modal-id-card-img');
                imgEl.src = data.id_card_url;
                imgEl.classList.remove('hidden');
                document.getElementById('modal-id-card-placeholder').classList.add('hidden');
            }

            if (data.vehicle_photo_url) {
                const imgEl = document.getElementById('modal-vehicle-img');
                imgEl.src = data.vehicle_photo_url;
                imgEl.classList.remove('hidden');
                document.getElementById('modal-vehicle-placeholder').classList.add('hidden');
            }
        }

        // ดึงประวัติ Timestamp จริงจากตาราง checkpoint_logs เฉพาะ ID นี้
        const { data: logsData } = await sb.from('checkpoint_logs').select('*').eq('checkpoint_id', id).order('created_at', { ascending: false });
        
        const tbody = document.getElementById('modal-timestamp-logs');
        if (!logsData || logsData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-slate-500">ยังไม่มีประวัติการสัญจรเข้า-ออก บันทึกหลังจากเปิดระบบ</td></tr>`;
        } else {
            tbody.innerHTML = logsData.map(l => `
                <tr class="hover:bg-slate-900 transition">
                    <td class="px-4 py-2.5 font-mono text-slate-300">${new Date(l.created_at).toLocaleString('th-TH')}</td>
                    <td class="px-4 py-2.5">
                        <span class="${l.action_type === 'IN' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'} px-2 py-0.5 rounded text-[10px] font-bold border">
                            ${l.action_type}
                        </span>
                    </td>
                    <td class="px-4 py-2.5 text-slate-400">${l.gate_name || 'ด่านนอแล'}</td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error('Error opening modal:', err);
    }
}

// ปิด POP-UP Modal
function closeModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.add('hidden');
}

// โหลดสถิติจริงจากตาราง logs
async function loadDashboardStats() {
    try {
        const { data, error } = await sb.from('checkpoint_logs').select('*');
        if (error || !data) return;

        const now = new Date();
        const todayStr = now.toDateString();

        let dailyCount = 0;
        let weeklyCount = 0;
        let monthlyCount = 0;
        let currentIn = 0;

        data.forEach(log => {
            const logDate = new Date(log.created_at);
            if (logDate.toDateString() === todayStr) dailyCount++;
            
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            if (diffDays <= 7) weeklyCount++;

            if (logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()) monthlyCount++;
            if (log.action_type === 'IN') currentIn++;
        });

        document.getElementById('stat-current-in').innerText = `${currentIn} คัน`;
        document.getElementById('stat-daily-total').innerText = `${dailyCount} ครั้ง`;
        document.getElementById('stat-weekly-total').innerText = `${weeklyCount} ครั้ง`;
        document.getElementById('stat-monthly-total').innerText = `${monthlyCount} ครั้ง`;

    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// 📊 ฟังก์ชัน Export ข้อมูล (รองรับทั้ง Export ทั้งหมด หรือ Export เฉพาะกลุ่ม/รายชื่อที่กำลังค้นหาอยู่)
async function exportDirectoryToExcel() {
    try {
        let confirmMsg = currentSearchTerm 
            ? `⏳ กำลังสร้างไฟล์ Excel สำหรับรายชื่อที่ตรงกับคำค้นหา "${currentSearchTerm}" กรุณารอสักครู่...`
            : '⏳ กำลังสร้างไฟล์ Excel สำหรับฐานข้อมูลทั้งหมด กรุณารอสักครู่...';
        
        alert(confirmMsg);

        let queryBuilder = sb.from('checkpoints').select('*').order('id', { ascending: true });

        // ถ้ามีการพิมพ์ค้นหาอยู่ (เช่น นามสกุล หรือชื่อ) ให้ดึงเฉพาะข้อมูลที่กรองมาส่งออก
        if (currentSearchTerm) {
            if (!isNaN(currentSearchTerm)) {
                queryBuilder = queryBuilder.eq('id', currentSearchTerm);
            } else {
                queryBuilder = queryBuilder.or(`license_plate.ilike.%${currentSearchTerm}%,full_name.ilike.%${currentSearchTerm}%,brand.ilike.%${currentSearchTerm}%`);
            }
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;

        if (!data || data.length === 0) {
            alert('❌ ไม่พบข้อมูลตามเงื่อนไขที่ค้นหาเพื่อส่งออก');
            return;
        }

        // ดึงประวัติ Logs ล่าสุดมาผูกรวมด้วย (ถ้ามี)
        const { data: logsData } = await sb.from('checkpoint_logs').select('*').order('created_at', { ascending: false });

        const excelData = data.map(item => {
            // หาประวัติการเข้า-ออกล่าสุดของบุคคลนี้
            const userLogs = logsData ? logsData.filter(l => l.checkpoint_id == item.id) : [];
            const lastLog = userLogs.length > 0 ? userLogs[0] : null;

            return {
                'ลำดับ (ID)': item.id || '',
                'ชื่อ-นามสกุล': item.full_name || item.name || '',
                'ชนิดรถ': item.vehicle_type || item.brand || '',
                'ยี่ห้อ/รุ่น': item.brand || '',
                'สีรถ': item.color || '',
                'ทะเบียนรถ': item.license_plate || item.plate || '',
                'หมายเหตุ / พื้นที่': item.remarks || item.note || 'ด่านนอแล',
                'สถานะสัญจรล่าสุด': lastLog ? lastLog.action_type : (item.status || 'ยังไม่เคยบันทึก'),
                'เวลา Timestamp ล่าสุด': lastLog ? new Date(lastLog.created_at).toLocaleString('th-TH') : (item.last_timestamp ? new Date(item.last_timestamp).toLocaleString('th-TH') : '-'),
                'จำนวนครั้งที่ผ่านด่านรวม': userLogs.length
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        
        const sheetName = currentSearchTerm ? `ผลการค้นหา_${currentSearchTerm}` : "ฐานข้อมูลด่านนอแลทั้งหมด";
        XLSX.utils.book_append_sheet(workbook, worksheet, "รายชื่อและประวัติ");

        worksheet['!cols'] = [
            { wch: 12 }, { wch: 28 }, { wch: 15 }, { wch: 18 }, 
            { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, 
            { wch: 24 }, { wch: 20 }
        ];

        const fileTag = currentSearchTerm ? `กลุ่ม_${currentSearchTerm}` : `ทั้งหมด`;
        const fileName = `รายงานสัญจร_${fileTag}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        alert(`✅ ส่งออกไฟล์ Excel (${fileName}) จำนวน ${data.length} รายการสำเร็จเรียบร้อย!`);

    } catch (err) {
        console.error('Export Excel error:', err);
        alert(`❌ เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ${err.message}`);
    }
}
// Chart.js Initialization
let chartsInitialized = false;
function initCharts() {
    if(chartsInitialized) return;
    chartsInitialized = true;

    const peakCtx = document.getElementById('peakHoursChart');
    if (peakCtx && window.Chart) {
        new Chart(peakCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
                datasets: [
                    { label: 'เข้า (IN)', data: [10, 42, 25, 34, 22, 47, 30, 12], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true },
                    { label: 'ออก (OUT)', data: [5, 28, 30, 38, 20, 52, 58, 15], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: `true` }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } } } }
        });
    }

    const donutCtx = document.getElementById('vehicleDonutChart');
    if (donutCtx && window.Chart) {
        new Chart(donutCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['จักรยานยนต์', 'รถเก๋ง', 'รถกระบะ', 'รถบรรทุก'],
                datasets: [{ data: [55, 25, 15, 5], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } } } }
        });
    }
}