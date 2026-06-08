export const TAMPERMONKEY_SCRIPT_CODE = `// ==UserScript==
// @name         Pearl Store CRM - Instagram Connector
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Connects Instagram profiles and DM chats to Pearl Store CRM with visual highlights and template auto-inserts.
// @author       Antigravity AI
// @match        *://instagram.com/*
// @match        *://*.instagram.com/*
// @match        *://localhost:*/*
// @match        *://127.0.0.1:*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const IS_CRM = window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1');

    if (IS_CRM) {
        console.log('[Pearl CRM Connector] Active on CRM Dashboard.');

        // 1. Receive monitored customers and settings from the CRM React app
        window.addEventListener('pearlcrm:sync_monitored', (e) => {
            if (e.detail && e.detail.customers) {
                GM_setValue('pearl_monitored_customers', JSON.stringify(e.detail.customers));
                GM_setValue('pearl_settings', JSON.stringify(e.detail.settings));
                console.log('[Pearl CRM Connector] Synced ' + e.detail.customers.length + ' customers and settings from CRM.');
            }
        });

        // 2. Relay detected events to the CRM page React app
        setInterval(() => {
            const detectedStr = GM_getValue('pearl_detected_events', '[]');
            const detected = JSON.parse(detectedStr);
            if (detected && detected.length > 0) {
                window.dispatchEvent(new CustomEvent('pearlcrm:inject_events', { detail: detected }));
                GM_setValue('pearl_detected_events', '[]');
                console.log('[Pearl CRM Connector] Injected events to CRM UI:', detected);
            }
        }, 1000);

    } else {
        console.log('[Pearl CRM Connector] Active on Instagram Web.');

        let activeCustomer = null;
        let activeChatCustomer = null;

        // ── 1. PROFILE CHECK (BAR AT TOP) ───────────────────
        function checkCurrentProfile() {
            const path = window.location.pathname.replace(/\\//g, '').trim().toLowerCase();
            if (!path || ['explore', 'direct', 'reels', 'stories', 'emails', 'accounts'].includes(path)) {
                removeCRMBar();
                activeCustomer = null;
                return;
            }

            const customers = JSON.parse(GM_getValue('pearl_monitored_customers', '[]'));
            const match = customers.find(c => {
                if (!c.instagram) return false;
                const igClean = c.instagram.replace(/@/g, '').trim().toLowerCase();
                return igClean === path;
            });

            if (match) {
                if (!activeCustomer || activeCustomer.id !== match.id) {
                    activeCustomer = match;
                    injectCRMBar(match);
                }
            } else {
                removeCRMBar();
                activeCustomer = null;
            }
        }

        function injectCRMBar(customer) {
            removeCRMBar();

            const bar = document.createElement('div');
            bar.id = 'pearl-crm-bar';
            bar.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; z-index: 999999; padding: 12px 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.45); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c3aed; transition: all 0.3s ease;';

            const style = document.createElement('style');
            style.id = 'pearl-crm-bar-styles';
            style.innerHTML = \`
                .pearl-btn {
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.18);
                    color: white;
                    padding: 8px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 700;
                    margin-left: 8px;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .pearl-btn:hover {
                    background: #7c3aed;
                    border-color: #8b5cf6;
                    transform: translateY(-1px);
                }
                .pearl-btn-grieving:hover {
                    background: #ef4444 !important;
                    border-color: #f87171 !important;
                }
            \`;
            document.head.appendChild(style);

            bar.innerHTML = \`
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="background: #7c3aed; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px #8b5cf6;"></div>
                    <div>
                        <span style="font-weight: 800; color: #a78bfa; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase;">Pearl CRM Partner</span>
                        <div style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 1px;">Sapa Pelanggan: <span style="color: #e2e8f0;">\${customer.nama}</span> (\${customer.wa || 'Tanpa WA'})</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="font-size: 12px; color: #94a3b8; font-weight: 600; margin-right: 6px;">Catat Momen:</span>
                    <button class="pearl-btn" id="pearl-btn-vacation">🏖️ Liburan</button>
                    <button class="pearl-btn" id="pearl-btn-achievement">🎓 Pencapaian</button>
                    <button class="pearl-btn" id="pearl-btn-birthday">🎂 Ultah</button>
                    <button class="pearl-btn pearl-btn-grieving" id="pearl-btn-grieving">😔 Sakit/Duka</button>
                </div>
            \`;

            document.body.appendChild(bar);
            document.body.style.transform = 'translateY(55px)';

            document.getElementById('pearl-btn-vacation').onclick = () => logEvent('vacation');
            document.getElementById('pearl-btn-achievement').onclick = () => logEvent('achievement');
            document.getElementById('pearl-btn-birthday').onclick = () => logEvent('birthday');
            document.getElementById('pearl-btn-grieving').onclick = () => logEvent('grieving');

            function logEvent(type) {
                let detail = '';
                let title = '';
                let risk = 'low';

                if (type === 'vacation') {
                    detail = prompt('Ke mana pelanggan sedang berlibur? (Contoh: Jepang, Bali, Lombok):');
                    if (detail === null) return;
                    title = 'Sedang Liburan di ' + (detail || 'luar kota');
                } else if (type === 'achievement') {
                    detail = prompt('Momen kelulusan/promosi/pencapaian apa? (Contoh: Buka Toko Baru, Lulus Kuliah):');
                    if (detail === null) return;
                    title = 'Merayakan ' + (detail || 'pencapaian barunya');
                } else if (type === 'birthday') {
                    title = 'Merayakan Ulang Tahun';
                } else if (type === 'grieving') {
                    detail = prompt('Keterangan duka/sakit (Contoh: Sakit di RS, Musibah):');
                    if (detail === null) return;
                    title = 'Sedang Sakit / Berduka';
                    risk = 'high';
                }

                const detected = JSON.parse(GM_getValue('pearl_detected_events', '[]'));
                const newEvent = {
                    customerId: customer.id,
                    type,
                    title,
                    detail,
                    riskLevel: risk,
                    dateDetected: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                };

                detected.push(newEvent);
                GM_setValue('pearl_detected_events', JSON.stringify(detected));
                showToast('✅ Berhasil dicatat ke CRM Pearl Store!');
            }
        }

        function removeCRMBar() {
            const bar = document.getElementById('pearl-crm-bar');
            if (bar) bar.remove();
            const styles = document.getElementById('pearl-crm-bar-styles');
            if (styles) styles.remove();
            document.body.style.transform = '';
        }

        // ── 2. INSTAGRAM DM CHAT HELPER ─────────────────────
        function checkActiveChat() {
            if (!window.location.pathname.includes('/direct/')) {
                removeDMHelper();
                activeChatCustomer = null;
                return;
            }

            const customers = JSON.parse(GM_getValue('pearl_monitored_customers', '[]'));
            if (customers.length === 0) return;

            // Search for name in the conversation headers
            const pageElements = document.querySelectorAll('span, h2, a');
            let matched = null;

            for (const el of pageElements) {
                const txt = el.textContent ? el.textContent.trim().toLowerCase() : '';
                if (!txt || txt.length < 3) continue;

                const found = customers.find(c => {
                    const igClean = c.instagram ? c.instagram.replace(/@/g, '').trim().toLowerCase() : '';
                    const nameClean = c.nama ? c.nama.trim().toLowerCase() : '';
                    return (igClean && txt === igClean) || (nameClean && txt === nameClean);
                });

                if (found) {
                    matched = found;
                    break;
                }
            }

            if (matched) {
                if (!activeChatCustomer || activeChatCustomer.id !== matched.id) {
                    activeChatCustomer = matched;
                    injectDMHelper(matched);
                }
            } else {
                // If it is direct page but no active customer detected on screen, remove helper
                // (Wait 3 seconds before removing to avoid flickering during loading)
                if (activeChatCustomer) {
                    removeDMHelper();
                    activeChatCustomer = null;
                }
            }
        }

        function injectDMHelper(customer) {
            removeDMHelper();

            const helper = document.createElement('div');
            helper.id = 'pearl-dm-helper';
            helper.style.cssText = 'position: fixed; bottom: 80px; right: 24px; width: 320px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(124,58,237,0.1); color: white; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 99999; display: flex; flex-direction: column; gap: 12px; transition: all 0.3s ease;';

            helper.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                    <span style="font-weight: 800; font-size: 11.5px; color: #a78bfa; letter-spacing: 0.5px;">💎 PEARL CRM DM HELPER</span>
                    <button id="pearl-dm-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;">✕</button>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #fff;">
                    Pelanggan: <span style="color: #67e8f9;">\${customer.nama}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
                    <button class="pearl-btn" id="pearl-dm-btn-bday" style="margin: 0; width: 100%; justify-content: center; background: rgba(139, 92, 246, 0.2); border-color: rgba(139, 92, 246, 0.4);">🎂 Kirim Ucapan Ultah</button>
                    
                    <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; margin-top: 4px; display: flex; flex-direction: column; gap: 6px;">
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Update Pengiriman:</span>
                        <input type="text" id="pearl-dm-input-courier" placeholder="Kurir (e.g. JNE, J&T)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px; color: white; font-size: 12px; outline: none;" value="JNE">
                        <input type="text" id="pearl-dm-input-resi" placeholder="Nomor Resi" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px; color: white; font-size: 12px; outline: none;">
                        <button class="pearl-btn" id="pearl-dm-btn-resi" style="margin: 0; width: 100%; justify-content: center; background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.4);">📦 Kirim Info Resi</button>
                    </div>
                </div>
            \`;

            document.body.appendChild(helper);

            document.getElementById('pearl-dm-close').onclick = () => removeDMHelper();

            // Birthday greeting insertion
            document.getElementById('pearl-dm-btn-bday').onclick = () => {
                const settings = JSON.parse(GM_getValue('pearl_settings', '{}'));
                const storeName = settings.storeName || 'Pearl Store';
                const bdayTemplate = settings.birthdayMessageTemplate || 'Selamat Ulang Tahun Kak {customerName}! 🎂';
                
                const finalMsg = bdayTemplate
                    .replace(/{customerName}/g, customer.nama)
                    .replace(/{storeName}/g, storeName)
                    .replace(/{vipNote}/g, '');

                insertIntoChatBox(finalMsg);
            };

            // Shipping status insertion
            document.getElementById('pearl-dm-btn-resi').onclick = () => {
                const courier = document.getElementById('pearl-dm-input-courier').value.trim() || 'Kurir';
                const resi = document.getElementById('pearl-dm-input-resi').value.trim();
                if (!resi) {
                    alert('Harap masukkan nomor resi terlebih dahulu!');
                    return;
                }

                const settings = JSON.parse(GM_getValue('pearl_settings', '{}'));
                const storeName = settings.storeName || 'Pearl Store';
                const resiTemplate = settings.shippingMessageTemplate || 'Halo Kak {customerName}! Pesanan Kakak telah dikirim via {courierName} dengan resi *{resi}*. 📦';

                const finalMsg = resiTemplate
                    .replace(/{customerName}/g, customer.nama)
                    .replace(/{storeName}/g, storeName)
                    .replace(/{courierName}/g, courier)
                    .replace(/{productName}/g, 'perhiasan')
                    .replace(/{resi}/g, resi);

                insertIntoChatBox(finalMsg);
            };
        }

        function insertIntoChatBox(text) {
            const textbox = document.querySelector('div[role="textbox"]');
            if (textbox) {
                textbox.focus();
                document.execCommand('insertText', false, text);
                
                // Dispatch input event for React inside Instagram
                const event = new Event('input', { bubbles: true });
                textbox.dispatchEvent(event);
                showToast('💬 Pesan disisipkan ke kotak input!');
            } else {
                navigator.clipboard.writeText(text);
                showToast('📋 Pesan disalin ke clipboard! (Buka kotak chat untuk menempelkan)');
            }
        }

        function removeDMHelper() {
            const el = document.getElementById('pearl-dm-helper');
            if (el) el.remove();
        }

        // ── 3. MONITORED USER HIGHLIGHTER ───────────────────
        function highlightMonitoredUsers() {
            const links = document.querySelectorAll('a[href^="/"]');
            const customers = JSON.parse(GM_getValue('pearl_monitored_customers', '[]'));
            if (customers.length === 0) return;

            links.forEach(link => {
                if (link.dataset.pearlHighlight) return;
                const href = link.getAttribute('href');
                if (!href) return;
                const username = href.replace(/\\//g, '').trim().toLowerCase();
                if (!username || ['explore', 'direct', 'reels', 'stories', 'emails', 'accounts'].includes(username)) return;

                const match = customers.find(c => {
                    const igClean = c.instagram ? c.instagram.replace(/@/g, '').trim().toLowerCase() : '';
                    return igClean === username;
                });

                if (match) {
                    link.dataset.pearlHighlight = 'true';
                    link.style.color = '#a78bfa';
                    link.style.fontWeight = '800';
                    link.style.textShadow = '0 0 6px rgba(167, 139, 250, 0.3)';
                    
                    const badge = document.createElement('span');
                    badge.innerText = ' 💎';
                    badge.title = 'Pearl CRM: ' + match.nama;
                    badge.style.fontSize = '10px';
                    badge.style.cursor = 'help';
                    link.appendChild(badge);
                }
            });
        }

        // ── UTILS ──────────────────────────────────────────
        function showToast(text) {
            const oldToast = document.getElementById('pearl-toast');
            if (oldToast) oldToast.remove();

            const toast = document.createElement('div');
            toast.id = 'pearl-toast';
            toast.style.cssText = 'position: fixed; bottom: 24px; left: 24px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; box-shadow: 0 10px 25px rgba(16,185,129,0.3); z-index: 1000000; animation: toastIn 0.3s ease; font-family: sans-serif;';
            toast.innerText = text;
            
            const toastStyle = document.createElement('style');
            toastStyle.id = 'pearl-toast-styles';
            toastStyle.innerHTML = \`
                @keyframes toastIn {
                    from { transform: translateY(100%) scale(0.9); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            \`;
            document.head.appendChild(toastStyle);
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px) scale(0.95)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    toast.remove();
                    toastStyle.remove();
                }, 300);
            }, 3000);
        }

        // Monitoring intervals
        setInterval(checkCurrentProfile, 1500);
        setInterval(checkActiveChat, 1500);
        setInterval(highlightMonitoredUsers, 2500);
        
        checkCurrentProfile();
        checkActiveChat();
        highlightMonitoredUsers();
    }
})();
`;
