// Arwa Enterprises - Admin Panel JavaScript
// Manages clients, subscriptions, and app access

// ============== SUPABASE CONFIG ==============
// IMPORTANT: Use the same credentials as your attendance system
const SUPABASE_URL = 'https://kyktwzwiraipwyglkhva.supabase.co';  // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5a3R3endpcmFpcHd5Z2xraHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTA2MTcsImV4cCI6MjA4NzU4NjYxN30.acOQWJkfE6Ew9PVyEKNeGxs7ri7QH_AarpPcoT34RBY';  // Replace with your Supabase anon key

let supabaseClient;

// ============== INITIALIZATION ==============
async function initAdmin() {
    try {
        // Initialize Supabase
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Test connection
        const { data, error } = await supabaseClient.from('clients').select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        document.getElementById('dbStatus').textContent = '🟢 Connected';
        document.getElementById('dbStatus').classList.add('connected');
        
        // Load data
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
            const apps = (client.subscribed_apps || []).map(app => {
                const icons = {
                    attendance: '📋',
                    inventory: '📦',
                    billing: '💰',
                    property: '🏠',
                    sales: '📊'
                };
                return icons[app] || app;
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
                    <td>${apps || '-'}</td>
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

// ============== ADD CLIENT MODAL ==============
function showAddClientModal() {
    document.getElementById('modalTitle').textContent = 'Add New Client';
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientCode').disabled = false;
    
    // Generate next client code
    generateNextClientCode();
    
    // Show admin user fields
    document.querySelectorAll('#clientForm h4, #clientForm .form-row:last-of-type, #clientForm .form-group:last-of-type')
        .forEach(el => el.style.display = '');
    
    document.getElementById('clientModal').classList.add('active');
}

async function generateNextClientCode() {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('client_code')
            .order('client_code', { ascending: false })
            .limit(1);
        
        if (data && data.length > 0) {
            const lastCode = data[0].client_code;
            const num = parseInt(lastCode.replace('AE', '')) || 0;
            document.getElementById('clientCode').value = 'AE' + (num + 1);
        } else {
            document.getElementById('clientCode').value = 'AE1';
        }
    } catch (error) {
        document.getElementById('clientCode').value = 'AE2';
    }
}

// ============== EDIT CLIENT ==============
async function editClient(clientId) {
    try {
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('modalTitle').textContent = 'Edit Client';
        document.getElementById('clientId').value = client.id;
        document.getElementById('clientCode').value = client.client_code || '';
        document.getElementById('clientCode').disabled = true; // Can't change code
        document.getElementById('businessName').value = client.business_name || '';
        document.getElementById('contactEmail').value = client.contact_email || '';
        document.getElementById('contactPhone').value = client.contact_phone || '';
        document.getElementById('address').value = client.address || '';
        document.getElementById('subscriptionStatus').value = client.subscription_status || 'trial';
        document.getElementById('subscriptionEndDate').value = client.subscription_end_date || '';
        
        // Set subscribed apps
        document.querySelectorAll('input[name="apps"]').forEach(cb => {
            cb.checked = (client.subscribed_apps || []).includes(cb.value);
        });
        
        // Hide admin user fields for edit
        document.getElementById('adminUsername').parentElement.parentElement.style.display = 'none';
        document.getElementById('adminName').parentElement.style.display = 'none';
        
        document.getElementById('clientModal').classList.add('active');
        
    } catch (error) {
        console.error('Edit client error:', error);
        alert('Error loading client details');
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
        
        // Get selected apps
        const selectedApps = [];
        document.querySelectorAll('input[name="apps"]:checked').forEach(cb => {
            selectedApps.push(cb.value);
        });
        
        if (selectedApps.length === 0) {
            alert('Please select at least one app');
            return;
        }
        
        const clientData = {
            client_code: document.getElementById('clientCode').value.toUpperCase().trim(),
            business_name: document.getElementById('businessName').value.trim(),
            owner_name: document.getElementById('businessName').value.trim(),
            contact_email: document.getElementById('contactEmail').value.trim() || null,
            contact_phone: document.getElementById('contactPhone').value.trim() || null,
            address: document.getElementById('address').value.trim() || null,
            subscription_status: document.getElementById('subscriptionStatus').value,
            subscription_end_date: document.getElementById('subscriptionEndDate').value || null,
            subscribed_apps: selectedApps,
            is_active: true
        };
        
        if (isNew) {
            // Check if client code exists
            const { data: existing } = await supabaseClient
                .from('clients')
                .select('id')
                .eq('client_code', clientData.client_code)
                .single();
            
            if (existing) {
                alert('Client code already exists!');
                return;
            }
            
            // Insert new client
            const { data: newClient, error: insertError } = await supabaseClient
                .from('clients')
                .insert(clientData)
                .select()
                .single();
            
            if (insertError) throw insertError;
            
            // Create admin user if provided
            const adminUsername = document.getElementById('adminUsername').value.trim();
            const adminPassword = document.getElementById('adminPassword').value.trim();
            const adminName = document.getElementById('adminName').value.trim();
            
            if (adminUsername && adminPassword) {
                const { error: userError } = await supabaseClient
                    .from('users')
                    .insert({
                        username: adminUsername.toLowerCase(),
                        password_hash: adminPassword,
                        name: adminName || adminUsername,
                        role: 'super_admin',
                        status: 'active',
                        client_id: newClient.id
                    });
                
                if (userError) {
                    console.error('User creation error:', userError);
                    alert('Client created but admin user creation failed: ' + userError.message);
                }
            }
            
            alert('Client created successfully!');
            
        } else {
            // Update existing client
            const { error: updateError } = await supabaseClient
                .from('clients')
                .update(clientData)
                .eq('id', clientId);
            
            if (updateError) throw updateError;
            
            alert('Client updated successfully!');
        }
        
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
        
        // Get laborer count (if attendance app)
        let laborerCount = 0;
        if ((client.subscribed_apps || []).includes('attendance')) {
            const { count } = await supabaseClient
                .from('laborers')
                .select('*', { count: 'exact', head: true })
                .eq('client_id', clientId);
            laborerCount = count || 0;
        }
        
        const apps = (client.subscribed_apps || []).map(app => {
            const names = {
                attendance: '📋 Attendance',
                inventory: '📦 Inventory',
                billing: '💰 Billing',
                property: '🏠 Property',
                sales: '📊 Sales'
            };
            return names[app] || app;
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
                    <label>Contact Email</label>
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
                    <span>${apps || '-'}</span>
                </div>
                <div class="view-item">
                    <label>Users</label>
                    <strong>${userCount || 0}</strong>
                </div>
                <div class="view-item">
                    <label>Laborers</label>
                    <strong>${laborerCount}</strong>
                </div>
                <div class="view-item">
                    <label>Created</label>
                    <span>${client.onboarded_at ? formatDate(client.onboarded_at) : formatDate(client.created_at)}</span>
                </div>
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
    if (confirm(`Are you sure you want to delete "${businessName}"?\n\nThis will NOT delete their data (users, laborers, etc.) but will prevent them from logging in.`)) {
        deleteClient(clientId);
    }
}

async function deleteClient(clientId) {
    try {
        // Soft delete - just set is_active to false
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

// ============== HELPERS ==============
function closeModal() {
    document.getElementById('clientModal').classList.remove('active');
}

function closeViewModal() {
    document.getElementById('viewModal').classList.remove('active');
}

function getStatusClass(status) {
    const classes = {
        'premium': 'status-premium',
        'active': 'status-active',
        'trial': 'status-trial',
        'expired': 'status-expired'
    };
    return classes[status] || '';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function logout() {
    sessionStorage.removeItem('arwa_admin_auth');
    window.location.href = 'index.html';
}

// Auto-uppercase client code
document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('clientCode');
    if (codeInput) {
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
});
