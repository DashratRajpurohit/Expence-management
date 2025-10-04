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

// Currency conversion helper
async function convertCurrency(amount, fromCurrency, toCurrency) {
  // Mock conversion rates for demo
  const rates = {
    USD: { EUR: 0.85, INR: 83, GBP: 0.73 },
    EUR: { USD: 1.18, INR: 87, GBP: 0.86 },
    INR: { USD: 0.012, EUR: 0.011, GBP: 0.0096 },
    GBP: { USD: 1.37, EUR: 1.16, INR: 100 }
  };
  
  if (fromCurrency === toCurrency) return amount;
  return amount * (rates[fromCurrency]?.[toCurrency] || 1);
}

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, companyName, country, currency } = req.body;
  
  // Create company
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
    createdAt: new Date()
  };
  users.push(user);

  // Create default approval rule
  const rule = {
    id: Date.now().toString(),
    companyId: company.id,
    ruleType: 'multi_level',
    approvalSequence: [
      { type: 'manager', order: 1 },
      { type: 'finance', order: 2 }
    ],
    percentageThreshold: 60,
    specificApprover: null,
    isActive: true
  };
  approvalRules.push(rule);
  
  res.json({
    token: 'demo-token',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: company
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
        isManagerApprover: user.isManagerApprover
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// User Management
app.get('/api/users', (req, res) => {
  const companyId = req.query.companyId;
  const companyUsers = users.filter(u => u.company === companyId)
    .map(user => ({
      ...user,
      managerName: users.find(m => m.id === user.managerId)?.name || 'None'
    }));
  res.json(companyUsers);
});

app.post('/api/users', (req, res) => {
  const { name, email, role, companyId, managerId, isManagerApprover } = req.body;
  
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password: 'welcome123', // Default password
    role: role || 'employee',
    company: companyId,
    managerId: managerId || null,
    isManagerApprover: isManagerApprover || false,
    createdAt: new Date()
  };
  
  users.push(user);
  res.json(user);
});

// Expense submission with approval workflow
app.post('/api/expenses', async (req, res) => {
  const { amount, currency, category, description, date, employeeId, companyId } = req.body;
  
  const employee = users.find(u => u.id === employeeId);
  const company = companies.find(c => c.id === companyId);
  
  if (!employee || !company) {
    return res.status(404).json({ message: 'Employee or company not found' });
  }

  // Convert to company currency
  const amountInCompanyCurrency = await convertCurrency(amount, currency, company.currency);

  const expense = {
    id: Date.now().toString(),
    amount,
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
    createdAt: new Date()
  };

  // Initialize approval flow
  const rule = approvalRules.find(r => r.companyId === companyId && r.isActive);
  if (rule && rule.ruleType === 'multi_level') {
    for (const step of rule.approvalSequence) {
      let approverId = null;
      
      if (step.type === 'manager' && employee.managerId) {
        approverId = employee.managerId;
      } else if (step.type === 'finance') {
        // Find finance users
        const financeUser = users.find(u => u.company === companyId && u.role === 'manager');
        approverId = financeUser?.id;
      }
      
      if (approverId) {
        expense.approvalFlow.push({
          approverId,
          sequenceOrder: step.order,
          status: step.order === 1 ? 'pending' : 'waiting',
          comments: '',
          actedAt: null
        });
      }
    }
    
    if (expense.approvalFlow.length > 0) {
      expense.status = 'in_review';
    }
  }

  expenses.push(expense);
  
  // Populate approver names for response
  const expenseWithDetails = {
    ...expense,
    approvalFlow: expense.approvalFlow.map(flow => ({
      ...flow,
      approverName: users.find(u => u.id === flow.approverId)?.name || 'Unknown'
    }))
  };
  
  res.json(expenseWithDetails);
});

// Get expenses for user
app.get('/api/expenses/my-expenses', (req, res) => {
  const employeeId = req.query.employeeId;
  const userExpenses = expenses
    .filter(e => e.employeeId === employeeId)
    .map(expense => ({
      ...expense,
      approvalFlow: expense.approvalFlow.map(flow => ({
        ...flow,
        approverName: users.find(u => u.id === flow.approverId)?.name || 'Unknown'
      }))
    }));
  res.json(userExpenses);
});

// Get pending approvals
app.get('/api/expenses/pending-approval', (req, res) => {
  const approverId = req.query.approverId;
  const pendingExpenses = expenses
    .filter(e => 
      e.approvalFlow.some(flow => 
        flow.approverId === approverId && flow.status === 'pending'
      )
    )
    .map(expense => ({
      ...expense,
      approvalFlow: expense.approvalFlow.map(flow => ({
        ...flow,
        approverName: users.find(u => u.id === flow.approverId)?.name || 'Unknown'
      }))
    }));
  res.json(pendingExpenses);
});

// Approve/Reject expense
app.post('/api/expenses/:id/approve', (req, res) => {
  const { action, comments, approverId } = req.body; // action: 'approve' or 'reject'
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

  if (action === 'reject') {
    expense.status = 'rejected';
  } else {
    // Move to next approver or complete
    const nextStep = expense.approvalFlow.find(step => step.status === 'waiting');
    if (nextStep) {
      nextStep.status = 'pending';
      expense.currentApproverIndex++;
    } else {
      expense.status = 'approved';
    }
  }

  res.json(expense);
});

// Approval rules management
app.get('/api/approval-rules', (req, res) => {
  const companyId = req.query.companyId;
  const rules = approvalRules.filter(r => r.companyId === companyId);
  res.json(rules);
});

app.post('/api/approval-rules', (req, res) => {
  const { companyId, ruleType, approvalSequence, percentageThreshold, specificApprover } = req.body;
  
  // Deactivate other rules
  approvalRules.forEach(rule => {
    if (rule.companyId === companyId) {
      rule.isActive = false;
    }
  });

  const rule = {
    id: Date.now().toString(),
    companyId,
    ruleType,
    approvalSequence,
    percentageThreshold,
    specificApprover,
    isActive: true
  };
  
  approvalRules.push(rule);
  res.json(rule);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Backend running on http://localhost:${PORT}`);
  console.log(`📊 Features: Multi-level approvals, User management, Currency conversion`);
});