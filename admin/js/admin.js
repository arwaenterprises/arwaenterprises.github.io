// Arwa Enterprises - Admin Panel JavaScript
// Manages clients, subscriptions, and app access
// VERSION: With App-Level Tier Support (Pharmacy)
// ============== SUPABASE CONFIG ==============
const SUPABASE_URL = 'https://kyktwzwiraipwyglkhva.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5a3R3endpcmFpcHd5Z2xraHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTA2MTcsImV4cCI6MjA4NzU4NjYxN30.acOQWJkfE6Ew9PVyEKNeGxs7ri7QH_AarpPcoT34RBY';

const { createClient } = supabase;
let supabaseClient;
let currentEditingClientId = null;
let isEditMode = false;

// ============== INITIALIZATION ==============
async function initAdmin() {
    try {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data, error } = await supabaseClient.from('clients').select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        document.getElementById('dbStatus').textContent = '🟢 Connected';
        document.getElementById('dbStatus').classList.add('connected');
        
        await loadStats();
        await loadClients();
        
    } catch (error) {
        console.error('Init error:', error);
        document.getElementById('dbStatus').textContent = '🔴 Disconnected';
        document.getElementById('dbStatus').classList.add('disconnected');
        alert('Failed to connect to database. Check console for details.');
    }
}

// ============== LOAD STATS ==============
async function loadStats() {
    try {
        const { data: clients, error } = await supabaseClient
            .from('clients')
            .select('subscription_status');
        
        if (error) throw error;
        
        const total = clients.length;
        const active = clients.filter(c => c.subscription_status === 'active' || c.subscription_status === 'premium').length;
        const trial = clients.filter(c => c.subscription_status === 'trial').length;
        const expired = clients.filter(c => c.subscription_status === 'expired').length;
        
        document.getElementById('totalClients').textContent = total;
        document.getElementById('activeClients').textContent = active;
        document.getElementById('trialClients').textContent = trial;
        document.getElementById('expiredClients').textContent = expired;
        
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// ============== LOAD CLIENTS ==============
async function loadClients() {
    try {
        const { data: clients, error } = await supabaseClient
            .from('clients')
            .select('*')
            .order('client_code');
        
        if (error) throw error;
        
        const tbody = document.getElementById('clientsTableBody');
        
        if (!clients || clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No clients found</td></tr>';
            return;
        }
        
        tbody.innerHTML = clients.map(client => {
            // Parse subscribed_apps - handle both string and array
            let apps = parseApps(client.subscribed_apps);
            
            const appIcons = apps.map(app => {
                const icons = {
                    attendance: '📋',
                    pharmacy: '💊',
                    inventory: '📦',
                    billing: '💰',
                    property: '🏠',
                    sales: '📊'
                };
                // Add tier badge for pharmacy
                let icon = icons[app] || app;
                if (app === 'pharmacy' && client.pharmacy_tier) {
                    const tierBadge = getTierBadgeSmall(client.pharmacy_tier);
                    icon += tierBadge;
                }
                return icon;
            }).join(' ');
            
            const statusClass = getStatusClass(client.subscription_status);
            const expiryText = client.subscription_end_date 
                ? formatDate(client.subscription_end_date)
                : (client.subscription_status === 'premium' ? 'Never' : '-');
            
            return `
                <tr>
                    <td><strong>${client.client_code || '-'}</strong></td>
                    <td>${client.business_name || '-'}</td>
                    <td>
                        <div class="contact-info">
                            ${client.contact_email ? `<small>📧 ${client.contact_email}</small>` : ''}
                            ${client.contact_phone ? `<small>📱 ${client.contact_phone}</small>` : ''}
                        </div>
                    </td>
                    <td>${appIcons || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${client.subscription_status || '-'}</span></td>
                    <td>${expiryText}</td>
                    <td class="actions-cell">
                        <button class="btn btn-sm" onclick="viewClient('${client.id}')">👁️</button>
                        <button class="btn btn-sm" onclick="editClient('${client.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${client.id}', '${client.business_name}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Load clients error:', error);
        document.getElementById('clientsTableBody').innerHTML = 
            '<tr><td colspan="7" class="error-cell">Error loading clients</td></tr>';
    }
}

// ============== PARSE APPS HELPER ==============
function parseApps(subscribed_apps) {
    let apps = [];
    if (subscribed_apps) {
        if (typeof subscribed_apps === 'string') {
            try {
                apps = JSON.parse(subscribed_apps);
            } catch (e) {
                apps = [];
            }
        } else if (Array.isArray(subscribed_apps)) {
            apps = subscribed_apps;
        }
    }
    return apps;
}

// ============== ADD CLIENT MODAL ==============
function showAddClientModal() {
    isEditMode = false;
    currentEditingClientId = null;
    
    document.getElementById('modalTitle').textContent = 'Add New Client';
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientCode').disabled = false;
    
    // Clear all app checkboxes
    document.querySelectorAll('input[name="apps"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Reset pharmacy tier
    const pharmacyTier = document.getElementById('pharmacyTier');
    pharmacyTier.value = 'basic';
    pharmacyTier.disabled = true;
    
    // Show password as required for new clients
    const passwordRequired = document.getElementById('passwordRequired');
    if (passwordRequired) passwordRequired.style.display = 'inline';
    
    const adminPassword = document.getElementById('adminPassword');
    adminPassword.required = true;
    adminPassword.value = '';
    adminPassword.type = 'password';
    
    const passwordHelp = document.getElementById('passwordHelp');
    if (passwordHelp) passwordHelp.textContent = 'Initial password for admin login';
    
    // Hide reset password button for new clients
    const resetSection = document.getElementById('resetPasswordSection');
    if (resetSection) resetSection.style.display = 'none';
    
    const adminNote = document.getElementById('adminSectionNote');
    if (adminNote) adminNote.textContent = 'Set login credentials for this client\'s admin user';
    
    // Generate next client code
    generateNextClientCode();
    
    // Show modal
    document.getElementById('clientModal').classList.add('active');
}

async function generateNextClientCode() {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('client_code')
            .order('client_code', { ascending: false })
            .limit(10);
        
        if (data && data.length > 0) {
            let maxNum = 0;
            data.forEach(row => {
                const match = row.client_code.match(/^AE(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxNum) maxNum = num;
                }
            });
            document.getElementById('clientCode').value = 'AE' + (maxNum + 1);
        } else {
            document.getElementById('clientCode').value = 'AE1';
        }
    } catch (error) {
        console.error('Generate code error:', error);
        document.getElementById('clientCode').value = 'AE2';
    }
}

// ============== EDIT CLIENT ==============
async function editClient(clientId) {
    try {
        isEditMode = true;
        currentEditingClientId = clientId;
        
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('modalTitle').textContent = 'Edit Client';
        document.getElementById('clientId').value = client.id;
        document.getElementById('clientCode').value = client.client_code || '';
        document.getElementById('clientCode').disabled = true;
        document.getElementById('businessName').value = client.business_name || '';
        document.getElementById('contactEmail').value = client.contact_email || '';
        document.getElementById('contactPhone').value = client.contact_phone || '';
        document.getElementById('address').value = client.address || '';
        document.getElementById('logoUrl').value = client.logo_url || '';
        document.getElementById('subscriptionStatus').value = client.subscription_status || 'trial';
        document.getElementById('subscriptionEndDate').value = client.subscription_end_date || '';

        // Clear all app checkboxes first
        document.querySelectorAll('input[name="apps"]').forEach(cb => {
            cb.checked = false;
        });

        // Parse and check the subscribed apps
        let apps = parseApps(client.subscribed_apps);
        
        apps.forEach(app => {
            const checkbox = document.getElementById('app_' + app);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        
        // Set pharmacy tier
        const pharmacyTier = document.getElementById('pharmacyTier');
        const pharmacyCheckbox = document.getElementById('app_pharmacy');
        
        if (pharmacyCheckbox.checked) {
            pharmacyTier.disabled = false;
            pharmacyTier.value = client.pharmacy_tier || 'basic';
        } else {
            pharmacyTier.disabled = true;
            pharmacyTier.value = 'basic';
        }

        // Password is optional for editing
        const passwordRequired = document.getElementById('passwordRequired');
        if (passwordRequired) passwordRequired.style.display = 'none';
        
        const adminPassword = document.getElementById('adminPassword');
        adminPassword.required = false;
        adminPassword.value = '';
        adminPassword.type = 'password';
        
        const passwordHelp = document.getElementById('passwordHelp');
        if (passwordHelp) passwordHelp.textContent = 'Leave blank to keep existing password';
        
        const adminNote = document.getElementById('adminSectionNote');
        if (adminNote) adminNote.textContent = 'Update login credentials (password optional)';
        
        // Show reset password button for existing clients
        const resetSection = document.getElementById('resetPasswordSection');
        if (resetSection) resetSection.style.display = 'block';

        // Show modal
        document.getElementById('clientModal').classList.add('active');
        
    } catch (error) {
        console.error('Edit client error:', error);
        alert('Error loading client: ' + error.message);
    }
}

// ============== SAVE CLIENT ==============
async function saveClient(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const clientId = document.getElementById('clientId').value;
        const isNew = !clientId;
        
        // Get selected apps as ARRAY
        const selectedApps = [];
        document.querySelectorAll('input[name="apps"]:checked').forEach(cb => {
            selectedApps.push(cb.value);
        });
        
        if (selectedApps.length === 0) {
            alert('Please select at least one app');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Client';
            return;
        }
        
        const contactEmail = document.getElementById('contactEmail').value.trim();
        
        if (!contactEmail) {
            alert('Contact Email is required - it will be used as the login username');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Client';
            return;
        }
        
        const clientCode = document.getElementById('clientCode').value.toUpperCase().trim();
        const businessName = document.getElementById('businessName').value.trim();
        
        // Get pharmacy tier (only if pharmacy is selected)
        const pharmacyCheckbox = document.getElementById('app_pharmacy');
        const pharmacyTier = pharmacyCheckbox.checked 
            ? document.getElementById('pharmacyTier').value 
            : null;
        
        const clientData = {
            client_code: clientCode,
            business_name: businessName,
            owner_name: businessName,
            contact_email: contactEmail,
            contact_phone: document.getElementById('contactPhone').value.trim() || null,
            address: document.getElementById('address').value.trim() || null,
            logo_url: document.getElementById('logoUrl').value.trim() || null,
            subscription_status: document.getElementById('subscriptionStatus').value,
            subscription_end_date: document.getElementById('subscriptionEndDate').value || null,
            subscribed_apps: selectedApps,
            pharmacy_tier: pharmacyTier,
            is_active: true
        };
        
        console.log('Saving client data:', clientData);
        
        if (isNew) {
            // Check if client code exists
            const { data: existing } = await supabaseClient
                .from('clients')
                .select('id')
                .eq('client_code', clientCode)
                .maybeSingle();
            
            if (existing) {
                alert('Client code already exists!');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Client';
                return;
            }
            
            // Password is required for new clients
            const adminPassword = document.getElementById('adminPassword').value.trim();
            if (!adminPassword) {
                alert('Password is required for new clients');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Client';
                return;
            }
            
            // Insert new client
            const { data: newClient, error: insertError } = await supabaseClient
                .from('clients')
                .insert(clientData)
                .select()
                .single();
            
            if (insertError) {
                console.error('Insert error:', insertError);
                throw insertError;
            }
            
            console.log('New client created:', newClient);
            
            // Create admin user
            const adminName = document.getElementById('adminName').value.trim();
            
            const userData = {
                username: contactEmail.toLowerCase(),
                password_hash: adminPassword,
                name: adminName || contactEmail.split('@')[0],
                role: 'super_admin',
                status: 'active',
                client_id: newClient.id
            };
            
            console.log('Creating user:', userData);
            
            const { data: newUser, error: userError } = await supabaseClient
                .from('users')
                .insert(userData)
                .select()
                .single();
            
            if (userError) {
                console.error('User creation error:', userError);
                alert('Client created but admin user creation failed: ' + userError.message);
            } else {
                console.log('User created:', newUser);
                
                let tierInfo = '';
                if (selectedApps.includes('pharmacy')) {
                    tierInfo = '\nPharmacy Tier: ' + (pharmacyTier || 'basic');
                }
                
                alert('✅ Client created successfully!\n\nLogin credentials:\nClient Code: ' + clientCode + '\nUsername: ' + contactEmail + '\nPassword: ' + adminPassword + tierInfo);
            }
            
        } else {
            // Update existing client
            const { error: updateError } = await supabaseClient
                .from('clients')
                .update(clientData)
                .eq('id', clientId);
            
            if (updateError) {
                console.error('Update error:', updateError);
                throw updateError;
            }
            
            // Update password if provided
            const adminPassword = document.getElementById('adminPassword').value.trim();
            if (adminPassword) {
                const { error: pwError } = await supabaseClient
                    .from('users')
                    .update({ password_hash: adminPassword })
                    .eq('client_id', clientId)
                    .eq('role', 'super_admin');
                
                if (pwError) {
                    console.error('Password update error:', pwError);
                }
            }
            
            // Update username (email) for admin user
            const { error: emailError } = await supabaseClient
                .from('users')
                .update({ 
                    username: contactEmail.toLowerCase(),
                    name: document.getElementById('adminName').value.trim() || contactEmail.split('@')[0]
                })
                .eq('client_id', clientId)
                .eq('role', 'super_admin');
            
            if (emailError) {
                console.error('Email update error:', emailError);
            }
            
            alert('✅ Client updated successfully!');
        }
        
        // Close modal and refresh
        closeModal();
        await loadStats();
        await loadClients();
        
    } catch (error) {
        console.error('Save client error:', error);
        alert('Error saving client: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Client';
    }
}

// ============== RESET PASSWORD ==============
function resetClientPassword() {
    const clientName = document.getElementById('businessName').value;
    document.getElementById('resetClientName').textContent = clientName;
    document.getElementById('newPassword').value = '';
    document.getElementById('newPassword').type = 'password';
    document.getElementById('resetPasswordModal').classList.add('active');
}

function closeResetModal() {
    document.getElementById('resetPasswordModal').classList.remove('active');
}

async function confirmResetPassword() {
    const newPassword = document.getElementById('newPassword').value.trim();
    
    if (!newPassword) {
        alert('Please enter a new password');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('users')
            .update({ password_hash: newPassword })
            .eq('client_id', currentEditingClientId)
            .eq('role', 'super_admin');
        
        if (error) throw error;
        
        const contactEmail = document.getElementById('contactEmail').value;
        const clientCode = document.getElementById('clientCode').value;
        
        alert('✅ Password reset successfully!\n\nNew credentials:\nClient Code: ' + clientCode + '\nUsername: ' + contactEmail + '\nPassword: ' + newPassword);
        
        closeResetModal();
        
    } catch (error) {
        console.error('Reset password error:', error);
        alert('Error resetting password: ' + error.message);
    }
}

// ============== VIEW CLIENT ==============
async function viewClient(clientId) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
        
        if (error) throw error;
        
        // Get user count
        const { count: userCount } = await supabaseClient
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
        
        // Parse subscribed_apps
        let apps = parseApps(client.subscribed_apps);
        
        const appNames = apps.map(app => {
            const names = {
                attendance: '📋 Attendance',
                pharmacy: '💊 Pharmacy',
                inventory: '📦 Inventory',
                billing: '💰 Billing',
                property: '🏠 Property',
                sales: '📊 Sales'
            };
            let name = names[app] || app;
            if (app === 'pharmacy' && client.pharmacy_tier) {
                name += ' <small>(' + client.pharmacy_tier + ')</small>';
            }
            return name;
        }).join('<br>');
        
        document.getElementById('viewModalContent').innerHTML = `
            <div class="view-grid">
                <div class="view-item">
                    <label>Client Code</label>
                    <strong>${client.client_code}</strong>
                </div>
                <div class="view-item">
                    <label>Business Name</label>
                    <strong>${client.business_name}</strong>
                </div>
                <div class="view-item">
                    <label>Login Email</label>
                    <span>${client.contact_email || '-'}</span>
                </div>
                <div class="view-item">
                    <label>Contact Phone</label>
                    <span>${client.contact_phone || '-'}</span>
                </div>
                <div class="view-item">
                    <label>Address</label>
                    <span>${client.address || '-'}</span>
                </div>
                <div class="view-item">
                    <label>Status</label>
                    <span class="status-badge ${getStatusClass(client.subscription_status)}">${client.subscription_status}</span>
                </div>
                <div class="view-item">
                    <label>Subscription Ends</label>
                    <span>${client.subscription_end_date ? formatDate(client.subscription_end_date) : 'Never'}</span>
                </div>
                <div class="view-item">
                    <label>Subscribed Apps</label>
                    <span>${appNames || '-'}</span>
                </div>
                <div class="view-item">
                    <label>Users</label>
                    <strong>${userCount || 0}</strong>
                </div>
                <div class="view-item">
                    <label>Created</label>
                    <span>${client.onboarded_at ? formatDate(client.onboarded_at) : formatDate(client.created_at)}</span>
                </div>
                ${client.logo_url ? `
                <div class="view-item">
                    <label>Logo</label>
                    <img src="${client.logo_url}" alt="Logo" style="height: 40px; border-radius: 4px;">
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('viewModal').classList.add('active');
        
    } catch (error) {
        console.error('View client error:', error);
        alert('Error loading client details');
    }
}

// ============== DELETE CLIENT ==============
function confirmDelete(clientId, businessName) {
    if (confirm(`Are you sure you want to deactivate "${businessName}"?\n\nThis will NOT delete their data but will prevent them from logging in.`)) {
        deleteClient(clientId);
    }
}

async function deleteClient(clientId) {
    try {
        const { error } = await supabaseClient
            .from('clients')
            .update({ is_active: false, subscription_status: 'expired' })
            .eq('id', clientId);
        
        if (error) throw error;
        
        alert('Client deactivated successfully');
        await loadStats();
        await loadClients();
        
    } catch (error) {
        console.error('Delete client error:', error);
        alert('Error deactivating client');
    }
}

// ============== MODAL HELPERS ==============
function closeModal() {
    const modal = document.getElementById('clientModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentEditingClientId = null;
    isEditMode = false;
}

function closeViewModal() {
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============== UTILITY HELPERS ==============
function getStatusClass(status) {
    const classes = {
        'premium': 'status-premium',
        'active': 'status-active',
        'trial': 'status-trial',
        'expired': 'status-expired'
    };
    return classes[status] || '';
}

function getTierBadgeSmall(tier) {
    const colors = {
        'basic': '#1976d2',
        'standard': '#f57c00',
        'premium': '#7b1fa2'
    };
    const color = colors[tier] || colors['basic'];
    return `<sup style="font-size:9px;color:${color};margin-left:2px;">${tier[0].toUpperCase()}</sup>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function logout() {
    sessionStorage.removeItem('arwa_admin_auth');
    sessionStorage.removeItem('arwa_admin_name');
    window.location.href = 'index.html';
}

// ============== EVENT LISTENERS ==============
document.addEventListener('DOMContentLoaded', () => {
    // Auto-uppercase client code
    const codeInput = document.getElementById('clientCode');
    if (codeInput) {
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
});
