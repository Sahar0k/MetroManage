import { useState, useMemo, useCallback } from 'react';
import { store } from '../store';
import { Employee, Department, Warehouse, Role } from '../types';
import { hasPermission } from '../utils/domain';
import { playSuccess, playError } from '../utils/audio';
import { useNotification } from '../contexts/NotificationContext';
import { Plus, Edit2, Trash2, X, Users, Building2, Package } from 'lucide-react';

interface PersonnelProps { theme: 'dark' | 'light'; userId: string | null; userRole: Role; }

export default function Personnel({ theme, userId, userRole }: PersonnelProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'departments' | 'warehouses'>('employees');
  const [employees, setEmployees] = useState(store.getEmployees());
  const [departments, setDepartments] = useState(store.getDepartments());
  const [warehouses, setWarehouses] = useState(store.getWarehouses());
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ fullName: '', tabNumber: '', departmentId: '', comment: '', warehouseId: '' });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '' });
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });

  const isDark = theme === 'dark';
  const canManage = hasPermission(userRole, 'manage_users');
  const notification = useNotification();

  const filteredEmployees = useMemo(() => { const f = employeeFilter.toLowerCase(); return employees.filter(e => e.fullName.toLowerCase().includes(f) || e.tabNumber.includes(employeeFilter)); }, [employees, employeeFilter]);
  const getDeptName = useCallback((deptId: string) => departments.find(d => d.id === deptId)?.name || '—', [departments]);
  const getDeptCode = useCallback((deptId: string) => departments.find(d => d.id === deptId)?.code || '—', [departments]);
  const getWarehouseName = useCallback((warehouseId: string | null) => warehouseId ? warehouses.find(w => w.id === warehouseId)?.name || '—' : '—', [warehouses]);
  const refreshEmployees = useCallback(() => setEmployees(store.getEmployees()), []);
  const refreshDepartments = useCallback(() => setDepartments(store.getDepartments()), []);
  const refreshWarehouses = useCallback(() => setWarehouses(store.getWarehouses()), []);

  const openAddEmployee = useCallback(() => { setEditEmployee(null); setEmployeeForm({ fullName: '', tabNumber: '', departmentId: departments[0]?.id || '', comment: '', warehouseId: warehouses[0]?.id || '' }); setShowEmployeeForm(true); }, [departments, warehouses]);
  const openEditEmployee = useCallback((emp: Employee) => { setEditEmployee(emp); setEmployeeForm({ fullName: emp.fullName, tabNumber: emp.tabNumber, departmentId: emp.departmentId, comment: emp.comment, warehouseId: emp.warehouseId }); setShowEmployeeForm(true); }, []);
  const handleSaveEmployee = useCallback(() => { if (!employeeForm.fullName || !employeeForm.tabNumber) { playError(); return; } if (editEmployee) { store.updateEmployee(editEmployee.id, employeeForm); } else { store.addEmployee(employeeForm); } playSuccess(); refreshEmployees(); setShowEmployeeForm(false); }, [employeeForm, editEmployee, refreshEmployees]);
  const handleDeleteEmployee = useCallback((id: string) => { if (confirm('Удалить сотрудника?')) { store.deleteEmployee(id); playSuccess(); refreshEmployees(); } }, [refreshEmployees]);

  const handleSaveDepartment = useCallback(() => { if (!departmentForm.name || !departmentForm.code) { playError(); return; } if (editDepartment) { store.updateDepartment(editDepartment.id, departmentForm); } else { store.addDepartment(departmentForm); } playSuccess(); refreshDepartments(); setShowDepartmentForm(false); }, [departmentForm, editDepartment, refreshDepartments]);
  const handleDeleteDepartment = useCallback((id: string) => { const result = store.deleteDepartment(id); if (!result.success) { playError(); notification.error('Ошибка', result.message); return; } playSuccess(); refreshDepartments(); }, [refreshDepartments, notification]);

  const handleSaveWarehouse = useCallback(() => { if (!warehouseForm.name) { playError(); return; } if (editWarehouse) { store.updateWarehouse(editWarehouse.id, warehouseForm); } else { store.addWarehouse(warehouseForm); } playSuccess(); refreshWarehouses(); setShowWarehouseForm(false); }, [warehouseForm, editWarehouse, refreshWarehouses]);
  const handleDeleteWarehouse = useCallback((id: string) => { const result = store.deleteWarehouse(id); if (!result.success) { playError(); notification.error('Ошибка', result.message); return; } playSuccess(); refreshWarehouses(); }, [refreshWarehouses, notification]);

  const inputClass = `w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveTab('employees')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'employees' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><Users size={16} />Сотрудники ({employees.length})</button>
        <button onClick={() => setActiveTab('departments')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'departments' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><Building2 size={16} />Отделы ({departments.length})</button>
        <button onClick={() => setActiveTab('warehouses')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'warehouses' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><Package size={16} />Склады ({warehouses.length})</button>
      </div>

      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <input value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} placeholder="Поиск..." className={`flex-1 w-full px-4 py-2.5 rounded-lg text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`} />
            {canManage && <button onClick={openAddEmployee} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={16} />Добавить</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center bg-cyan-500/20"><Users size={18} className="text-cyan-500" /></div><div><p className="font-medium text-sm">{emp.fullName}</p><p className="text-xs text-slate-400">Таб. №{emp.tabNumber}</p></div></div>
                  {canManage && <div className="flex gap-1"><button onClick={() => openEditEmployee(emp)} className="p-1.5 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-cyan-400"><Edit2 size={13} /></button><button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button></div>}
                </div>
                <div className="mt-3 space-y-1">{emp.comment && <p className="text-xs text-slate-400">{emp.comment}</p>}<p className="text-xs text-cyan-400">{getDeptCode(emp.departmentId)} — {getDeptName(emp.departmentId)}</p><p className="text-xs flex items-center gap-1 text-purple-400"><Package size={12} />{getWarehouseName(emp.warehouseId)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-end">{canManage && <button onClick={() => { setEditDepartment(null); setDepartmentForm({ name: '', code: '' }); setShowDepartmentForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={16} />Добавить отдел</button>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{departments.map(dept => (<div key={dept.id} className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20"><Building2 size={18} className="text-purple-500" /></div><div><p className="font-medium text-sm">{dept.name}</p><p className="text-xs font-mono text-slate-400">{dept.code}</p></div></div>{canManage && <div className="flex gap-1"><button onClick={() => { setEditDepartment(dept); setDepartmentForm({ name: dept.name, code: dept.code }); setShowDepartmentForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-cyan-400"><Edit2 size={13} /></button><button onClick={() => handleDeleteDepartment(dept.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button></div>}</div></div>))}</div>
        </div>
      )}

      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex justify-end">{canManage && <button onClick={() => { setEditWarehouse(null); setWarehouseForm({ name: '', location: '' }); setShowWarehouseForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={16} />Добавить склад</button>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{warehouses.map(warehouse => (<div key={warehouse.id} className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20"><Package size={18} className="text-amber-500" /></div><div><p className="font-medium text-sm">{warehouse.name}</p><p className="text-xs text-slate-400">{warehouse.location || '—'}</p></div></div>{canManage && <div className="flex gap-1"><button onClick={() => { setEditWarehouse(warehouse); setWarehouseForm({ name: warehouse.name, location: warehouse.location }); setShowWarehouseForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-cyan-400"><Edit2 size={13} /></button><button onClick={() => handleDeleteWarehouse(warehouse.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button></div>}</div></div>))}</div>
        </div>
      )}

      {showEmployeeForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{editEmployee ? 'Редактировать' : 'Новый сотрудник'}</h2><button onClick={() => setShowEmployeeForm(false)} className="p-1 rounded-lg hover:bg-slate-700/30"><X size={20} /></button></div><div className="space-y-3"><div><label className="text-xs text-slate-400 mb-1 block">ФИО</label><input value={employeeForm.fullName} onChange={e => setEmployeeForm({...employeeForm, fullName: e.target.value})} className={inputClass} /></div><div><label className="text-xs text-slate-400 mb-1 block">Табельный №</label><input value={employeeForm.tabNumber} onChange={e => setEmployeeForm({...employeeForm, tabNumber: e.target.value})} className={inputClass} /></div><div><label className="text-xs text-slate-400 mb-1 block">Отдел</label><select value={employeeForm.departmentId} onChange={e => setEmployeeForm({...employeeForm, departmentId: e.target.value})} className={inputClass}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div><label className="text-xs text-slate-400 mb-1 block">Склад</label><select value={employeeForm.warehouseId} onChange={e => setEmployeeForm({...employeeForm, warehouseId: e.target.value})} className={inputClass}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div><div><label className="text-xs text-slate-400 mb-1 block">Комментарий</label><textarea value={employeeForm.comment} onChange={e => setEmployeeForm({...employeeForm, comment: e.target.value})} className={`${inputClass} resize-none`} rows={3} /></div></div><div className="flex gap-3 mt-5"><button onClick={handleSaveEmployee} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{editEmployee ? 'Сохранить' : 'Создать'}</button><button onClick={() => setShowEmployeeForm(false)} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button></div></div></div>)}
      {showDepartmentForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{editDepartment ? 'Редактировать' : 'Новый отдел'}</h2><button onClick={() => setShowDepartmentForm(false)} className="p-1 rounded-lg hover:bg-slate-700/30"><X size={20} /></button></div><div className="space-y-3"><div><label className="text-xs text-slate-400 mb-1 block">Название</label><input value={departmentForm.name} onChange={e => setDepartmentForm({...departmentForm, name: e.target.value})} className={inputClass} /></div><div><label className="text-xs text-slate-400 mb-1 block">Код</label><input value={departmentForm.code} onChange={e => setDepartmentForm({...departmentForm, code: e.target.value})} className={inputClass} /></div></div><div className="flex gap-3 mt-5"><button onClick={handleSaveDepartment} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{editDepartment ? 'Сохранить' : 'Создать'}</button><button onClick={() => setShowDepartmentForm(false)} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button></div></div></div>)}
      {showWarehouseForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{editWarehouse ? 'Редактировать' : 'Новый склад'}</h2><button onClick={() => setShowWarehouseForm(false)} className="p-1 rounded-lg hover:bg-slate-700/30"><X size={20} /></button></div><div className="space-y-3"><div><label className="text-xs text-slate-400 mb-1 block">Название</label><input value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} className={inputClass} /></div><div><label className="text-xs text-slate-400 mb-1 block">Местоположение</label><input value={warehouseForm.location} onChange={e => setWarehouseForm({...warehouseForm, location: e.target.value})} className={inputClass} /></div></div><div className="flex gap-3 mt-5"><button onClick={handleSaveWarehouse} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{editWarehouse ? 'Сохранить' : 'Создать'}</button><button onClick={() => setShowWarehouseForm(false)} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button></div></div></div>)}
    </div>
  );
}
