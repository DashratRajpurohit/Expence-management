import React, { useState, useEffect } from 'react';
import './App.css';

// Global variables for demo data
let users = [];
let companies = [];
let expenses = [];
let approvalRules = [];

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expensesList, setExpensesList] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [approvalRulesList, setApprovalRulesList] = useState([]);
  
  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    name: '', email: '', password: '', companyName: '', country: 'United States', currency: 'USD' 
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: '', currency: 'USD', category: 'travel', description: '', date: new Date().toISOString().split('T')[0]
  });
  const [userForm, setUserForm] = useState({
    name: '', email: '', role: 'employee', managerId: '', isManagerApprover: false
  });
  const [ruleForm, setRuleForm] = useState({
    ruleType: 'multi_level',
    approvalSequence: [{ type: 'manager', order: 1 }],
    percentageThreshold: 60,
    specificApprover: ''
  });

  // Initialize demo data on first load
  useEffect(() => {
    initializeDemoData();
  }, []);

  const initializeDemoData = () => {
    if (users.length === 0) {
      const demoCompany = {
        id: '1', name: 'Demo Corp', country: 'United States', currency: 'USD', createdAt: new Date()
      };
      companies.push(demoCompany);

      const adminUser = {
        id: '1', name: 'Admin User', email: 'admin@demo.com', password: 'admin',
        role: 'admin', company: '1', isManagerApprover: true, createdAt: new Date()
      };
      users.push(adminUser);

      const managerUser = {
        id: '2', name: 'Manager User', email: 'manager@demo.com', password: 'manager',
        role: 'manager', company: '1', isManagerApprover: true, createdAt: new Date()
      };
      users.push(managerUser);

      const employeeUser = {
        id: '3', name: 'Employee User', email: 'employee@demo.com', password: 'employee',
        role: 'employee', company: '1', managerId: '2', isManagerApprover: false, createdAt: new Date()
      };
      users.push(employeeUser);

      const defaultRule = {
        id: '1', companyId: '1', ruleType: 'multi_level',
        approvalSequence: [
          { type: 'manager', order: 1 },
          { type: 'finance', order: 2 }
        ],
        percentageThreshold: 60,
        specificApprover: null,
        isActive: true
      };
      approvalRules.push(defaultRule);
    }
  };

  // Auth functions
  const handleSignup = async (e) => {
    e.preventDefault();
    // Demo fallback - no backend call
    const newUser = {
      id: Date.now().toString(),
      name: signupData.name,
      email: signupData.email,
      role: 'admin',
      company: {
        id: Date.now().toString(),
        name: signupData.companyName,
        currency: signupData.currency,
        country: signupData.country
      },
      isManagerApprover: true
    };
    setUser(newUser);
    setCompanyUsers([newUser]);
    alert('Company created successfully! You are the admin.');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    // Demo login - check against our demo users
    const foundUser = users.find(u => u.email === loginData.email && u.password === loginData.password);
    if (foundUser) {
      const company = companies.find(c => c.id === foundUser.company) || companies[0];
      setUser({ ...foundUser, company });
      loadCompanyData(foundUser.company);
    } else {
      alert('Invalid credentials. Use demo accounts: admin@demo.com/admin, manager@demo.com/manager, employee@demo.com/employee');
    }
  };

  const loadCompanyData = (companyId) => {
    loadUsers(companyId);
    loadApprovalRules(companyId);
    if (user) {
      loadExpenses();
      loadPendingApprovals();
    }
  };

  const loadUsers = (companyId) => {
    setCompanyUsers(users.filter(u => u.company === companyId));
  };

  const loadApprovalRules = (companyId) => {
    setApprovalRulesList(approvalRules.filter(r => r.companyId === companyId));
  };

  const loadExpenses = () => {
    if (!user) return;
    setExpensesList(expenses.filter(e => e.employeeId === user.id));
  };

  const loadPendingApprovals = () => {
    if (!user || (user.role !== 'manager' && user.role !== 'admin')) return;
    setPendingApprovals(expenses.filter(e => 
      e.approvalFlow && e.approvalFlow.some(flow => flow.approverId === user.id && flow.status === 'pending')
    ));
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    const newExpense = {
      id: Date.now().toString(),
      ...expenseForm,
      employeeId: user.id,
      employeeName: user.name,
      companyId: user.company.id,
      amountInCompanyCurrency: parseFloat(expenseForm.amount), // Simple conversion for demo
      status: 'submitted',
      approvalFlow: [],
      createdAt: new Date()
    };

    // Add approval flow if user has a manager
    const employee = users.find(u => u.id === user.id);
    if (employee && employee.managerId) {
      newExpense.approvalFlow.push({
        approverId: employee.managerId,
        approverName: users.find(u => u.id === employee.managerId)?.name || 'Manager',
        sequenceOrder: 1,
        status: 'pending',
        comments: '',
        actedAt: null
      });
      newExpense.status = 'in_review';
    }

    expenses.push(newExpense);
    setExpensesList([...expensesList, newExpense]);
    setExpenseForm({
      amount: '', currency: 'USD', category: 'travel', description: '', 
      date: new Date().toISOString().split('T')[0]
    });
    alert('✅ Expense submitted for approval!');
  };

  const approveExpense = (expenseId, action) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (expense) {
      const approvalStep = expense.approvalFlow.find(step => step.approverId === user.id && step.status === 'pending');
      if (approvalStep) {
        approvalStep.status = action;
        approvalStep.comments = `${action} by ${user.name}`;
        approvalStep.actedAt = new Date();
        
        if (action === 'reject') {
          expense.status = 'rejected';
        } else {
          // Check if there are more approvers
          const nextStep = expense.approvalFlow.find(step => step.status === 'waiting');
          if (nextStep) {
            nextStep.status = 'pending';
          } else {
            expense.status = 'approved';
          }
        }
        
        setExpensesList([...expensesList]);
        setPendingApprovals(pendingApprovals.filter(e => e.id !== expenseId));
        alert(`Expense ${action}d successfully!`);
      }
    }
  };

  const createUser = (e) => {
    e.preventDefault();
    const newUser = {
      id: Date.now().toString(),
      ...userForm,
      company: user.company.id,
      password: 'welcome123',
      createdAt: new Date()
    };
    users.push(newUser);
    setCompanyUsers([...companyUsers, newUser]);
    setUserForm({ name: '', email: '', role: 'employee', managerId: '', isManagerApprover: false });
    alert('User created successfully!');
  };

  const createApprovalRule = (e) => {
    e.preventDefault();
    const newRule = {
      id: Date.now().toString(),
      companyId: user.company.id,
      ...ruleForm,
      isActive: true
    };
    approvalRules.push(newRule);
    setApprovalRulesList([...approvalRulesList, newRule]);
    setRuleForm({
      ruleType: 'multi_level',
      approvalSequence: [{ type: 'manager', order: 1 }],
      percentageThreshold: 60,
      specificApprover: ''
    });
    alert('Approval rule created successfully!');
  };

  if (!user) {
    return (
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', color: '#2c3e50', marginBottom: '40px' }}>
          💰 Advanced Expense Management System
        </h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          {/* Login Form */}
          <div style={{ border: '1px solid #ddd', padding: '30px', borderRadius: '10px', backgroundColor: '#f8f9fa' }}>
            <h2>🔐 Login</h2>
            <form onSubmit={handleLogin}>
              <div style={{ margin: '15px 0' }}>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={loginData.email}
                  onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                  style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>
              <div style={{ margin: '15px 0' }}>
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>
              <button 
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px' }}
              >
                Login
              </button>
            </form>
            
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '5px' }}>
              <h4>Demo Accounts:</h4>
              <p><strong>Admin:</strong> admin@demo.com / admin</p>
              <p><strong>Manager:</strong> manager@demo.com / manager</p>
              <p><strong>Employee:</strong> employee@demo.com / employee</p>
            </div>
          </div>

          {/* Signup Form */}
          <div style={{ border: '1px solid #ddd', padding: '30px', borderRadius: '10px', backgroundColor: '#f0f8f0' }}>
            <h2>🚀 Create Company</h2>
            <form onSubmit={handleSignup}>
              <div style={{ margin: '10px 0' }}>
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  value={signupData.name}
                  onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                  style={{ width: '100%', padding: '10px', margin: '5px 0', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>
              <div style={{ margin: '10px 0' }}>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={signupData.email}
                  onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                  style={{ width: '100%', padding: '10px', margin: '5px 0', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>
              <div style={{ margin: '10px 0' }}>
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={signupData.password}
                  onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                  style={{ width: '100%', padding: '10px', margin: '5px 0', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>
              <div style={{ margin: '10px 0' }}>
                <input 
                  type="text" 
                  placeholder="Company Name" 
                  value={signupData.companyName}
                  onChange={(e) => setSignupData({...signupData, companyName: e.target.value})}
                  style={{ width: '100%', padding: '10px', margin: '5px 0', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>
              <div style={{ margin: '10px 0' }}>
                <select 
                  value={signupData.currency}
                  onChange={(e) => setSignupData({...signupData, currency: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                >
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="GBP">British Pound (GBP)</option>
                  <option value="INR">Indian Rupee (INR)</option>
                </select>
              </div>
              <button 
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px' }}
              >
                Create Company & Admin Account
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '2px solid #3498db', 
        paddingBottom: '15px',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>💰 {user.company.name} Expense Manager</h1>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            Welcome, <strong>{user.name}</strong> ({user.role}) | Currency: {user.company.currency}
          </p>
        </div>
        <button 
          onClick={() => setUser(null)}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#e74c3c', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </header>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button 
          onClick={() => setActiveTab('dashboard')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'dashboard' ? '#3498db' : 'transparent',
            color: activeTab === 'dashboard' ? 'white' : '#3498db',
            border: '1px solid #3498db',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          📊 Dashboard
        </button>
        
        <button 
          onClick={() => setActiveTab('submit')}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: activeTab === 'submit' ? '#3498db' : 'transparent',
            color: activeTab === 'submit' ? 'white' : '#3498db',
            border: '1px solid #3498db',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          ➕ Submit Expense
        </button>

        {(user.role === 'manager' || user.role === 'admin') && (
          <button 
            onClick={() => setActiveTab('approvals')}
            style={{ 
              padding: '10px 20px', 
              marginRight: '10px',
              backgroundColor: activeTab === 'approvals' ? '#3498db' : 'transparent',
              color: activeTab === 'approvals' ? 'white' : '#3498db',
              border: '1px solid #3498db',
              borderRadius: '5px 5px 0 0',
              cursor: 'pointer'
            }}
          >
            👥 Pending Approvals ({pendingApprovals.length})
          </button>
        )}

        {user.role === 'admin' && (
          <>
            <button 
              onClick={() => setActiveTab('users')}
              style={{ 
                padding: '10px 20px', 
                marginRight: '10px',
                backgroundColor: activeTab === 'users' ? '#3498db' : 'transparent',
                color: activeTab === 'users' ? 'white' : '#3498db',
                border: '1px solid #3498db',
                borderRadius: '5px 5px 0 0',
                cursor: 'pointer'
              }}
            >
              👥 User Management
            </button>
            
            <button 
              onClick={() => setActiveTab('rules')}
              style={{ 
                padding: '10px 20px', 
                marginRight: '10px',
                backgroundColor: activeTab === 'rules' ? '#3498db' : 'transparent',
                color: activeTab === 'rules' ? 'white' : '#3498db',
                border: '1px solid #3498db',
                borderRadius: '5px 5px 0 0',
                cursor: 'pointer'
              }}
            >
              ⚙️ Approval Rules
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '500px' }}>
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <h2>📊 Expense Dashboard</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ padding: '20px', backgroundColor: '#e8f6f3', borderRadius: '10px', textAlign: 'center' }}>
                <h3>Total Expenses</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                  {expensesList.length}
                </p>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#fef9e7', borderRadius: '10px', textAlign: 'center' }}>
                <h3>Pending Approval</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f39c12' }}>
                  {expensesList.filter(e => e.status === 'in_review').length}
                </p>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#e8f4fd', borderRadius: '10px', textAlign: 'center' }}>
                <h3>Approved</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                  {expensesList.filter(e => e.status === 'approved').length}
                </p>
              </div>
            </div>

            <h3>Recent Expenses</h3>
            {expensesList.length === 0 ? (
              <p>No expenses submitted yet.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {expensesList.slice(-5).reverse().map(expense => (
                  <div key={expense.id} style={{ 
                    border: '1px solid #ddd', 
                    padding: '15px', 
                    margin: '10px 0', 
                    borderRadius: '8px',
                    backgroundColor: expense.status === 'approved' ? '#f8fff8' : 
                                   expense.status === 'rejected' ? '#fff8f8' : '#fffef0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '18px', color: '#27ae60' }}>
                        {expense.currency} {expense.amount} 
                        {expense.currency !== user.company.currency && (
                          <span style={{ fontSize: '14px', color: '#7f8c8d' }}>
                            ({user.company.currency} {expense.amountInCompanyCurrency})
                          </span>
                        )}
                      </strong>
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: '15px', 
                        backgroundColor: 
                          expense.status === 'approved' ? '#27ae60' :
                          expense.status === 'rejected' ? '#e74c3c' : '#f39c12',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {expense.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <strong>Category:</strong> {expense.category} | 
                      <strong> Description:</strong> {expense.description}
                    </div>
                    {expense.approvalFlow && expense.approvalFlow.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#7f8c8d' }}>
                        <strong>Approval Flow:</strong> {expense.approvalFlow.map(flow => 
                          `${flow.approverName} (${flow.status})`
                        ).join(' → ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submit Expense */}
        {activeTab === 'submit' && (
          <div style={{ maxWidth: '600px' }}>
            <h2>➕ Submit New Expense</h2>
            <form onSubmit={submitExpense} style={{ border: '1px solid #ddd', padding: '25px', borderRadius: '10px', backgroundColor: '#f8f9fa' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Amount:</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                    required 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Currency:</label>
                  <select 
                    value={expenseForm.currency}
                    onChange={(e) => setExpenseForm({...expenseForm, currency: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div style={{ margin: '15px 0' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category:</label>
                <select 
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                >
                  <option value="travel">Travel</option>
                  <option value="food">Food & Dining</option>
                  <option value="accommodation">Accommodation</option>
                  <option value="office">Office Supplies</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ margin: '15px 0' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description:</label>
                <input 
                  type="text" 
                  placeholder="What was this expense for?"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>

              <div style={{ margin: '15px 0' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date:</label>
                <input 
                  type="date" 
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  required 
                />
              </div>

              <button 
                type="submit"
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  backgroundColor: '#27ae60', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '5px', 
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Submit Expense for Approval
              </button>
            </form>
          </div>
        )}

        {/* Pending Approvals */}
        {activeTab === 'approvals' && (user.role === 'manager' || user.role === 'admin') && (
          <div>
            <h2>👥 Pending Approvals</h2>
            {pendingApprovals.length === 0 ? (
              <p>No pending approvals.</p>
            ) : (
              <div>
                {pendingApprovals.map(expense => (
                  <div key={expense.id} style={{ 
                    border: '1px solid #ddd', 
                    padding: '20px', 
                    margin: '15px 0', 
                    borderRadius: '8px',
                    backgroundColor: '#fffef0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                          {expense.currency} {expense.amount} - {expense.category}
                        </h4>
                        <p><strong>Employee:</strong> {expense.employeeName}</p>
                        <p><strong>Description:</strong> {expense.description}</p>
                        <p><strong>Date:</strong> {new Date(expense.date).toLocaleDateString()}</p>
                        
                        {expense.approvalFlow && (
                          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                            <strong>Approval Flow:</strong>
                            {expense.approvalFlow.map((flow, index) => (
                              <div key={index} style={{ 
                                margin: '5px 0',
                                padding: '5px',
                                backgroundColor: flow.status === 'pending' ? '#fff3cd' : 
                                               flow.status === 'approved' ? '#d4edda' : 'transparent'
                              }}>
                                {flow.sequenceOrder}. {flow.approverName} - 
                                <span style={{ 
                                  color: flow.status === 'approved' ? '#27ae60' : 
                                         flow.status === 'rejected' ? '#e74c3c' : '#f39c12',
                                  fontWeight: 'bold'
                                }}>
                                  {flow.status.toUpperCase()}
                                </span>
                                {flow.comments && ` - ${flow.comments}`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginLeft: '20px' }}>
                        <button 
                          onClick={() => approveExpense(expense.id, 'approve')}
                          style={{ 
                            display: 'block',
                            padding: '10px 20px', 
                            marginBottom: '10px',
                            backgroundColor: '#27ae60', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '5px',
                            cursor: 'pointer',
                            width: '120px'
                          }}
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => approveExpense(expense.id, 'reject')}
                          style={{ 
                            display: 'block',
                            padding: '10px 20px', 
                            backgroundColor: '#e74c3c', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '5px',
                            cursor: 'pointer',
                            width: '120px'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User Management */}
        {activeTab === 'users' && user.role === 'admin' && (
          <div>
            <h2>👥 User Management</h2>
            
            {/* Create User Form */}
            <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '10px', marginBottom: '30px', backgroundColor: '#f8f9fa' }}>
              <h3>Create New User</h3>
              <form onSubmit={createUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label>Name:</label>
                    <input 
                      type="text" 
                      value={userForm.name}
                      onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                      required 
                    />
                  </div>
                  <div>
                    <label>Email:</label>
                    <input 
                      type="email" 
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                      required 
                    />
                  </div>
                  <div>
                    <label>Role:</label>
                    <select 
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div>
                    <label>Manager:</label>
                    <select 
                      value={userForm.managerId}
                      onChange={(e) => setUserForm({...userForm, managerId: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                    >
                      <option value="">No Manager</option>
                      {companyUsers.filter(u => u.role === 'manager').map(manager => (
                        <option key={manager.id} value={manager.id}>{manager.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ margin: '15px 0' }}>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={userForm.isManagerApprover}
                      onChange={(e) => setUserForm({...userForm, isManagerApprover: e.target.checked})}
                      style={{ marginRight: '8px' }}
                    />
                    Can approve expenses as manager
                  </label>
                </div>
                <button 
                  type="submit"
                  style={{ 
                    padding: '10px 20px', 
                    backgroundColor: '#3498db', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Create User
                </button>
              </form>
            </div>

            {/* Users List */}
            <h3>Company Users ({companyUsers.length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Name</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Email</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Role</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Manager</th>
                    <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Can Approve</th>
                  </tr>
                </thead>
                <tbody>
                  {companyUsers.map(user => (
                    <tr key={user.id}>
                      <td style={{ border: '1px solid #ddd', padding: '12px' }}>{user.name}</td>
                      <td style={{ border: '1px solid #ddd', padding: '12px' }}>{user.email}</td>
                      <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          backgroundColor: user.role === 'admin' ? '#e74c3c' : user.role === 'manager' ? '#3498db' : '#27ae60',
                          color: 'white',
                          fontSize: '12px'
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                        {user.managerId ? companyUsers.find(m => m.id === user.managerId)?.name : 'None'}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                        {user.isManagerApprover ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Approval Rules */}
        {activeTab === 'rules' && user.role === 'admin' && (
          <div>
            <h2>⚙️ Approval Rules</h2>
            
            {/* Create Rule Form */}
            <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '10px', marginBottom: '30px', backgroundColor: '#f8f9fa' }}>
              <h3>Create New Approval Rule</h3>
              <form onSubmit={createApprovalRule}>
                <div style={{ margin: '15px 0' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Rule Type:</label>
                  <select 
                    value={ruleForm.ruleType}
                    onChange={(e) => setRuleForm({...ruleForm, ruleType: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                  >
                    <option value="multi_level">Multi-Level Approval</option>
                    <option value="percentage">Percentage Based</option>
                    <option value="specific_approver">Specific Approver</option>
                  </select>
                </div>

                {ruleForm.ruleType === 'multi_level' && (
                  <div style={{ margin: '15px 0' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Approval Sequence:</label>
                    {ruleForm.approvalSequence.map((step, index) => (
                      <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <select 
                          value={step.type}
                          onChange={(e) => {
                            const newSequence = [...ruleForm.approvalSequence];
                            newSequence[index].type = e.target.value;
                            setRuleForm({...ruleForm, approvalSequence: newSequence});
                          }}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }}
                        >
                          <option value="manager">Manager</option>
                          <option value="finance">Finance</option>
                          <option value="director">Director</option>
                        </select>
                        <span style={{ lineHeight: '35px' }}>Step {step.order}</span>
                        {ruleForm.approvalSequence.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newSequence = ruleForm.approvalSequence.filter((_, i) => i !== index);
                              setRuleForm({...ruleForm, approvalSequence: newSequence});
                            }}
                            style={{ 
                              padding: '8px 12px', 
                              backgroundColor: '#e74c3c', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => {
                        const newSequence = [...ruleForm.approvalSequence, { 
                          type: 'manager', 
                          order: ruleForm.approvalSequence.length + 1 
                        }];
                        setRuleForm({...ruleForm, approvalSequence: newSequence});
                      }}
                      style={{ 
                        padding: '8px 12px', 
                        backgroundColor: '#27ae60', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      Add Approval Step
                    </button>
                  </div>
                )}

                {ruleForm.ruleType === 'percentage' && (
                  <div style={{ margin: '15px 0' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Approval Threshold (%):</label>
                    <input 
                      type="number" 
                      min="1"
                      max="100"
                      value={ruleForm.percentageThreshold}
                      onChange={(e) => setRuleForm({...ruleForm, percentageThreshold: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                    />
                  </div>
                )}

                <button 
                  type="submit"
                  style={{ 
                    padding: '12px 24px', 
                    backgroundColor: '#3498db', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Create Approval Rule
                </button>
              </form>
            </div>

            {/* Current Rules */}
            <h3>Current Approval Rules</h3>
            {approvalRulesList.length === 0 ? (
              <p>No approval rules defined.</p>
            ) : (
              <div>
                {approvalRulesList.map(rule => (
                  <div key={rule.id} style={{ 
                    border: '1px solid #ddd', 
                    padding: '15px', 
                    margin: '10px 0', 
                    borderRadius: '8px',
                    backgroundColor: rule.isActive ? '#e8f6f3' : '#f8f9fa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>{rule.ruleType.replace('_', ' ').toUpperCase()} Rule</h4>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: rule.isActive ? '#27ae60' : '#95a5a6',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    {rule.ruleType === 'multi_level' && (
                      <p><strong>Sequence:</strong> {rule.approvalSequence.map(s => s.type).join(' → ')}</p>
                    )}
                    {rule.ruleType === 'percentage' && (
                      <p><strong>Threshold:</strong> {rule.percentageThreshold}% approval required</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;