const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Enhanced data storage
let companies = [];
let users = [];
let expenses = [];
let approvalRules = [];
let approvalFlows = [];

// Currency conversion helper
const exchangeRates = {
  USD: { EUR: 0.85, INR: 83, GBP: 0.73, USD: 1 },
  EUR: { USD: 1.18, INR: 87, GBP: 0.86, EUR: 1 },
  INR: { USD: 0.012, EUR: 0.011, GBP: 0.0096, INR: 1 },
  GBP: { USD: 1.37, EUR: 1.16, INR: 100, GBP: 1 }
};

function convertCurrency(amount, fromCurrency, toCurrency) {
  return amount * (exchangeRates[fromCurrency]?.[toCurrency] || 1);
}

// Auto-create company and admin on first signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, companyName, country, currency } = req.body;
  
  // Create company with selected currency
  const company = {
    id: Date.now().toString(),
    name: companyName,
    country: country || 'United States',
    currency: currency || 'USD',
    createdAt: new Date()
  };
  companies.push(company);
  
  // Create admin user
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password,
    role: 'admin',
    company: company.id,
    isManagerApprover: true,
    managerId: null,
    createdAt: new Date()
  };
  users.push(user);

  // Create default approval flow
  const approvalFlow = {
    id: Date.now().toString(),
    companyId: company.id,
    name: 'Default Approval Flow',
    steps: [
      { type: 'manager', order: 1, required: true },
      { type: 'role', role: 'finance', order: 2, required: false }
    ],
    ruleType: 'multi_level',
    percentageThreshold: 60,
    specificApprover: null,
    isActive: true
  };
  approvalFlows.push(approvalFlow);
  
  res.json({
    token: 'demo-token',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: company,
      isManagerApprover: user.isManagerApprover
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    const company = companies.find(c => c.id === user.company);
    res.json({
      token: 'demo-token',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: company,
        isManagerApprover: user.isManagerApprover,
        managerId: user.managerId
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// User Management - Admin only
app.get('/api/users', (req, res) => {
  const companyId = req.query.companyId;
  const companyUsers = users.filter(u => u.company === companyId)
    .map(user => ({
      ...user,
      managerName: users.find(m => m.id === user.managerId)?.name || 'None',
      password: undefined // Don't send password back
    }));
  res.json(companyUsers);
});

app.post('/api/users', (req, res) => {
  const { name, email, role, companyId, managerId, isManagerApprover } = req.body;
  
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password: 'welcome123',
    role: role || 'employee',
    company: companyId,
    managerId: managerId || null,
    isManagerApprover: isManagerApprover || false,
    createdAt: new Date()
  };
  
  users.push(user);
  res.json({ ...user, password: undefined });
});

// Update user role/manager
app.put('/api/users/:id', (req, res) => {
  const { role, managerId, isManagerApprover } = req.body;
  const user = users.find(u => u.id === req.params.id);
  
  if (user) {
    if (role) user.role = role;
    if (managerId !== undefined) user.managerId = managerId;
    if (isManagerApprover !== undefined) user.isManagerApprover = isManagerApprover;
    
    res.json({ ...user, password: undefined });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Expense submission with multi-level approval
app.post('/api/expenses', async (req, res) => {
  const { amount, currency, category, description, date, employeeId, companyId } = req.body;
  
  const employee = users.find(u => u.id === employeeId);
  const company = companies.find(c => c.id === companyId);
  
  if (!employee || !company) {
    return res.status(404).json({ message: 'Employee or company not found' });
  }

  // Convert to company currency
  const amountInCompanyCurrency = convertCurrency(amount, currency, company.currency);

  const expense = {
    id: Date.now().toString(),
    amount: parseFloat(amount),
    currency,
    amountInCompanyCurrency: Math.round(amountInCompanyCurrency * 100) / 100,
    category,
    description,
    date,
    employeeId,
    employeeName: employee.name,
    companyId,
    status: 'submitted',
    approvalFlow: [],
    currentApproverIndex: 0,
    approvers: [],
    createdAt: new Date()
  };

  // Get active approval flow for company
  const activeFlow = approvalFlows.find(f => f.companyId === companyId && f.isActive);
  
  if (activeFlow) {
    // Build approval sequence based on flow rules
    const approvalSequence = [];
    
    for (const step of activeFlow.steps) {
      let approver = null;
      
      if (step.type === 'manager' && employee.managerId) {
        approver = users.find(u => u.id === employee.managerId && u.isManagerApprover);
      } else if (step.type === 'role') {
        approver = users.find(u => u.company === companyId && u.role === step.role && u.isManagerApprover);
      } else if (step.type === 'specific') {
        approver = users.find(u => u.id === step.userId);
      }
      
      if (approver) {
        approvalSequence.push({
          approverId: approver.id,
          approverName: approver.name,
          sequenceOrder: step.order,
          status: step.order === 1 ? 'pending' : 'waiting',
          comments: '',
          actedAt: null
        });
      }
    }
    
    expense.approvalFlow = approvalSequence;
    expense.approvers = approvalSequence.map(a => a.approverId);
    
    if (approvalSequence.length > 0) {
      expense.status = 'in_review';
    }
  }

  expenses.push(expense);
  res.json(expense);
});

// Get expenses for user based on role
app.get('/api/expenses', (req, res) => {
  const { userId, companyId, role } = req.query;
  
  let userExpenses = [];
  
  if (role === 'admin') {
    // Admin sees all company expenses
    userExpenses = expenses.filter(e => e.companyId === companyId);
  } else if (role === 'manager') {
    // Manager sees team expenses and expenses pending their approval
    const managedUsers = users.filter(u => u.managerId === userId);
    const managedUserIds = managedUsers.map(u => u.id);
    
    userExpenses = expenses.filter(e => 
      e.companyId === companyId && 
      (managedUserIds.includes(e.employeeId) || e.approvers.includes(userId))
    );
  } else {
    // Employee sees only their expenses
    userExpenses = expenses.filter(e => e.employeeId === userId);
  }
  
  res.json(userExpenses);
});

// Get pending approvals for manager/admin
app.get('/api/expenses/pending-approval', (req, res) => {
  const approverId = req.query.approverId;
  const pendingExpenses = expenses.filter(e => 
    e.approvalFlow.some(flow => 
      flow.approverId === approverId && flow.status === 'pending'
    ) && e.status === 'in_review'
  );
  res.json(pendingExpenses);
});

// Approve/Reject expense with comments
app.post('/api/expenses/:id/approve', (req, res) => {
  const { action, comments, approverId } = req.body;
  const expense = expenses.find(e => e.id === req.params.id);
  
  if (!expense) {
    return res.status(404).json({ message: 'Expense not found' });
  }

  const currentStep = expense.approvalFlow.find(step => 
    step.approverId === approverId && step.status === 'pending'
  );

  if (!currentStep) {
    return res.status(403).json({ message: 'Not authorized to approve this expense' });
  }

  currentStep.status = action;
  currentStep.comments = comments;
  currentStep.actedAt = new Date();

  // Get approval flow rules
  const activeFlow = approvalFlows.find(f => f.companyId === expense.companyId && f.isActive);
  
  if (action === 'reject') {
    expense.status = 'rejected';
  } else {
    // Check approval rules
    if (activeFlow && activeFlow.ruleType === 'percentage') {
      const approvedCount = expense.approvalFlow.filter(step => step.status === 'approved').length + 1;
      const totalApprovers = expense.approvalFlow.length;
      const approvalPercentage = (approvedCount / totalApprovers) * 100;
      
      if (approvalPercentage >= activeFlow.percentageThreshold) {
        expense.status = 'approved';
      } else {
        // Move to next approver
        const nextStep = expense.approvalFlow.find(step => step.status === 'waiting');
        if (nextStep) {
          nextStep.status = 'pending';
        }
      }
    } else {
      // Multi-level approval - move to next step
      const nextStep = expense.approvalFlow.find(step => step.status === 'waiting');
      if (nextStep) {
        nextStep.status = 'pending';
      } else {
        expense.status = 'approved';
      }
    }
  }

  res.json(expense);
});

// Approval flows management
app.get('/api/approval-flows', (req, res) => {
  const companyId = req.query.companyId;
  const flows = approvalFlows.filter(f => f.companyId === companyId);
  res.json(flows);
});

app.post('/api/approval-flows', (req, res) => {
  const { companyId, name, steps, ruleType, percentageThreshold, specificApprover } = req.body;
  
  // Deactivate other flows
  approvalFlows.forEach(flow => {
    if (flow.companyId === companyId) {
      flow.isActive = false;
    }
  });

  const flow = {
    id: Date.now().toString(),
    companyId,
    name,
    steps,
    ruleType: ruleType || 'multi_level',
    percentageThreshold: percentageThreshold || 60,
    specificApprover: specificApprover || null,
    isActive: true
  };
  
  approvalFlows.push(flow);
  res.json(flow);
});

// Override approval (Admin only)
app.post('/api/expenses/:id/override', (req, res) => {
  const { action, comments } = req.body;
  const expense = expenses.find(e => e.id === req.params.id);
  
  if (!expense) {
    return res.status(404).json({ message: 'Expense not found' });
  }

  expense.status = action;
  expense.override = {
    by: req.body.adminId,
    at: new Date(),
    comments: comments || `Manually ${action} by admin`
  };
  
  res.json(expense);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Complete Expense Manager Backend running on port ${PORT}`);
  console.log(`📊 Features: Multi-level approvals, Flexible rules, Currency conversion, User management`);
});