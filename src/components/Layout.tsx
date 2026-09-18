import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { store, scannerStatus } from '../store';
import { User, MeasuringInstrument } from '../types';
import { getRoleLabel } from '../utils/domain';
import { unlockAudio } from '../utils/audio';
import { LayoutDashboard, Wrench, ArrowLeftRight, Users, ScrollText, Radio, LogIn, LogOut, Menu, X, Calendar, Search, Upload, Settings, HardDrive, Server, Database } from 'lucide-react';
import { getStorageConfig, getStorageAdapter } from '../services/storage';
import SearchContextMenu from './SearchContextMenu';
import InstrumentDetailModal from './InstrumentDetailModal';
import InstrumentCard from './InstrumentCard';
import ConfirmDialog from './ConfirmDialog';

interface LayoutProps { 
  children: React.ReactNode; 
  currentPage: string; 
  onNavigate: (page: string, filter?: string, instrumentId?: string) => void; 
  onUserChange?: () => void; 
  onDataSourceClick?: () => void;
  onLogout?: () => void;
}

const ALL_NAV_ITEMS = [
  { id: 'dashboard', label: 'Сводка', icon: LayoutDashboard, roles: ['metrologist'] },
  { id: 'instruments', label: 'Реестр СИ', icon: Wrench, roles: ['guest', 'metrologist'] },
  { id: 'verification', label: 'Поверки', icon: Calendar, roles: ['metrologist'] },
  { id: 'issue-return', label: 'Выдача / Возврат', icon: ArrowLeftRight, roles: ['metrologist'] },
  { id: 'personnel', label: 'Персонал', icon: Users, roles: ['metrologist'] },
  { id: 'operations', label: 'Журнал', icon: ScrollText, roles: ['metrologist'] },
  { id: 'scanner', label: 'Терминал', icon: Radio, roles: ['metrologist'] },
  { id: 'import', label: 'Импорт реестра', icon: Upload, roles: ['metrologist'] },
  { id: 'settings', label: 'Настройки', icon: Settings, roles: ['metrologist'] },
  { id: 'migration', label: 'Перенос данных', icon: Database, roles: ['metrologist'] },
];

export default function Layout({ children, currentPage, onNavigate, onUserChange, onDataSourceClick, onLogout }: LayoutProps) {
  const [user, setUser] = useState<User | null>(store.getCurrentUser());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOnline, setScannerOnline] = useState(scannerStatus.isOnline());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<MeasuringInstrument[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<MeasuringInstrument | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [cardInstrument, setCardInstrument] = useState<MeasuringInstrument | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'delete' | 'issue' | 'return'; instrument: MeasuringInstrument } | null>(null);
  const [storageSource, setStorageSource] = useState<'local' | 'pocketbase'>('local');
  const [pocketbaseUrl, setPocketbaseUrl] = useState<string>('');

  useEffect(() => { document.documentElement.className = 'dark'; }, []);
  
  useEffect(() => {
    const config = getStorageConfig();
    setStorageSource(config.type);
    if (config.pocketbaseUrl) {
      setPocketbaseUrl(config.pocketbaseUrl);
    }
  }, []);
  
  useEffect(() => { if (user?.role !== 'metrologist') return; const unsubscribe = scannerStatus.subscribe(() => { setScannerOnline(scannerStatus.isOnline()); }); return unsubscribe; }, [user?.role]);

  useEffect(() => {
    if (globalSearch.length < 2) { setSearchResults([]); setShowSearchResults(false); return; }
    const instruments = store.getInstruments();
    const searchLower = globalSearch.toLowerCase();
    const results = instruments.filter(i => i.inventoryNumber.toLowerCase().includes(searchLower) || i.serialNumber.toLowerCase().includes(searchLower) || i.name.toLowerCase().includes(searchLower) || i.type.toLowerCase().includes(searchLower) || i.category.toLowerCase().includes(searchLower)).slice(0, 10);
    setSearchResults(results); setShowSearchResults(true);
  }, [globalSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); const searchInput = document.getElementById('global-search'); if (searchInput) searchInput.focus(); } };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchResultClick = (instrument: MeasuringInstrument) => { setGlobalSearch(''); setShowSearchResults(false); setSelectedInstrument(instrument); setShowDetailModal(true); };
  const handleViewCard = (instrument: MeasuringInstrument) => { setGlobalSearch(''); setShowSearchResults(false); setSelectedInstrument(instrument); setMenuPosition(null); setShowDetailModal(true); };
  const handleIssue = (instrument: MeasuringInstrument) => { setConfirmDialog({ type: 'issue', instrument }); };
  const handleReturn = (instrument: MeasuringInstrument) => { setConfirmDialog({ type: 'return', instrument }); };
  const handleEdit = (instrument: MeasuringInstrument) => { setGlobalSearch(''); setShowSearchResults(false); setSelectedInstrument(null); setMenuPosition(null); setShowDetailModal(false); onNavigate('instruments', 'all'); };
  const handleDetailEdit = (instrument: MeasuringInstrument) => { setShowDetailModal(false); onNavigate('instruments', 'all'); };
  const handleDetailDelete = (instrument: MeasuringInstrument) => { setConfirmDialog({ type: 'delete', instrument }); };
  const handleDetailIssue = (instrument: MeasuringInstrument) => { setConfirmDialog({ type: 'issue', instrument }); };
  const handleDetailReturn = (instrument: MeasuringInstrument) => { setConfirmDialog({ type: 'return', instrument }); };
  const handleDetailCreateCard = (instrument: MeasuringInstrument) => { setShowDetailModal(false); setCardInstrument(instrument); };
  const handleViewSimilar = (instrument: MeasuringInstrument) => { setSelectedInstrument(instrument); };
  const handleDelete = (instrument: MeasuringInstrument) => { setConfirmDialog({ type: 'delete', instrument }); };
  const handleCloseMenu = () => { setSelectedInstrument(null); setMenuPosition(null); };

  const handleLogin = useCallback((username: string, password: string) => {
    unlockAudio();
    if (username === 'metrologist' && password === 'metrolog') {
      const users = store.getUsers(); const u = users.find(u => u.role === 'metrologist');
      if (u) { store.setCurrentUser(u); setUser(u); setLoginError(''); setLoginForm({ username: '', password: '' }); onNavigate('dashboard'); if (onUserChange) onUserChange(); return true; }
    }
    setLoginError('Неверный логин или пароль'); return false;
  }, [onNavigate, onUserChange]);

  const handleSubmitLogin = useCallback((e: React.FormEvent) => { e.preventDefault(); handleLogin(loginForm.username, loginForm.password); }, [handleLogin, loginForm]);
  
  const handleLogoutClick = useCallback(() => {
    if (onLogout) {
      onLogout();
    } else {
      // Fallback для локального режима
      store.setCurrentUser(null);
      setUser(null);
      onNavigate('instruments');
      if (onUserChange) onUserChange();
    }
  }, [onLogout, onNavigate, onUserChange]);

  const currentRole = user?.role || 'guest';
  const navItems = useMemo(() => ALL_NAV_ITEMS.filter(item => item.roles.includes(currentRole)), [currentRole]);
  const handleNavClick = useCallback((page: string) => { unlockAudio(); onNavigate(page, undefined); setSidebarOpen(false); }, [onNavigate]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="hidden lg:block fixed top-0 left-64 right-0 z-50 bg-slate-800 border-b border-slate-700 h-[72px]">
        <div className="px-6 h-full flex items-center justify-center">
          <div className="relative w-full max-w-3xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="global-search" type="text" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="🔍 Поиск СИ (инвентарный номер, заводской номер, модель)" className="w-full pl-12 pr-20 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                {searchResults.map(instrument => (
                  <button key={instrument.id} onClick={() => handleSearchResultClick(instrument)} className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div><p className="font-mono text-xs text-cyan-400">{instrument.inventoryNumber}</p><p className="text-sm font-medium text-slate-200">{instrument.name}</p><p className="text-xs text-slate-400">{instrument.category} - {instrument.type}</p></div>
                      <span className={`text-xs px-2 py-1 rounded ${instrument.status === 'available' ? 'bg-emerald-400/15 text-emerald-300' : instrument.status === 'issued' ? 'bg-cyan-400/15 text-cyan-300' : instrument.status === 'repair' ? 'bg-amber-400/15 text-amber-300' : instrument.status === 'verification' ? 'bg-purple-400/15 text-purple-300' : 'bg-slate-500/15 text-slate-400'}`}>
                        {instrument.status === 'available' ? 'Доступно' : instrument.status === 'issued' ? 'Выдано' : instrument.status === 'repair' ? 'Ремонт' : instrument.status === 'verification' ? 'На поверке' : 'Списано'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs text-slate-400 bg-slate-600 rounded font-mono">Ctrl+K</kbd>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-4 bg-slate-800 border-slate-700 border-b">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-700/30">{sidebarOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <span className="font-bold text-cyan-500 text-sm">Учёт СИ</span>
      </div>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed top-0 left-0 z-40 h-full w-64 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 bg-slate-800 border-slate-700 border-r`}>
        <div className="flex flex-col h-full">
          <div className="h-[72px] px-4 flex items-center border-b border-white/[0.08] cursor-pointer select-none" onDoubleClick={onDataSourceClick}>
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg"><Wrench size={20} className="text-white" /></div>
              <div><h1 className="text-[15px] font-semibold text-white leading-tight">Учёт средств измерений</h1><p className="text-[11px] text-[#8A99AD] leading-tight mt-0.5">Метрологический учет</p></div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <button key={item.id} onClick={() => handleNavClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentPage === item.id ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}>
                <item.icon size={18} />{item.label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-slate-700 space-y-3">
            {/* Индикатор источника данных */}
            <div className="px-3 py-2 mb-2">
              {storageSource === 'local' ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50">
                  <HardDrive size={14} className="text-slate-400" />
                  <span className="text-xs text-slate-400">Данные: ЛОКАЛЬНО</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <Server size={14} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400">Данные: СЕРВЕР</span>
                  {pocketbaseUrl && <span className="text-xs text-slate-400 truncate">{pocketbaseUrl}</span>}
                </div>
              )}
            </div>

            {storageSource === 'pocketbase' ? (
              // Серверный режим: показываем только информацию о пользователе и кнопку выхода
              user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-lg bg-slate-700/50"><p className="text-sm font-medium">{user.fullName}</p><p className="text-xs text-cyan-500">{getRoleLabel(user.role)}</p></div>
                  <button onClick={handleLogoutClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"><LogOut size={16} />Выйти</button>
                </div>
              ) : null
            ) : (
              // Локальный режим: показываем форму логина
              user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-lg bg-slate-700/50"><p className="text-sm font-medium">{user.fullName}</p><p className="text-xs text-cyan-500">{getRoleLabel(user.role)}</p></div>
                  <button onClick={handleLogoutClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"><LogOut size={16} />Выйти</button>
                </div>
              ) : (
                <form onSubmit={handleSubmitLogin} className="space-y-3 px-3">
                  <p className="text-xs text-slate-400">Вход для метролога</p>
                  <input type="text" placeholder="Логин" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                  <input type="password" placeholder="Пароль" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                  {loginError && <p className="text-xs text-red-400">{loginError}</p>}
                  <button type="button" onClick={() => setLoginForm({ username: 'metrologist', password: 'metrolog' })} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs bg-slate-600 text-slate-300 hover:bg-slate-500">Тестовые данные</button>
                  <button type="submit" className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-cyan-500 text-white hover:bg-cyan-600"><LogIn size={14} />Войти</button>
                  <p className="text-[10px] text-slate-500 text-center">По умолчанию — гость</p>
                </form>
              )
            )}
          </div>
        </div>
      </aside>

      <main className="lg:ml-64 pt-[72px] min-h-screen">
        <div className="p-4 pt-6 lg:p-6 lg:pt-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {selectedInstrument && menuPosition && <SearchContextMenu instrument={selectedInstrument} position={menuPosition} onClose={handleCloseMenu} onViewCard={handleViewCard} onIssue={handleIssue} onReturn={handleReturn} onEdit={handleEdit} onDelete={handleDelete} />}
      {showDetailModal && selectedInstrument && <InstrumentDetailModal instrument={selectedInstrument} onClose={() => setShowDetailModal(false)} onEdit={handleDetailEdit} onDelete={handleDetailDelete} onIssue={handleDetailIssue} onReturn={handleDetailReturn} onCreateCard={handleDetailCreateCard} onViewSimilar={handleViewSimilar} />}
      {cardInstrument && <InstrumentCard instrument={cardInstrument} onClose={() => setCardInstrument(null)} />}
      {confirmDialog && (
        <ConfirmDialog type={confirmDialog.type} instrument={confirmDialog.instrument} onConfirm={() => {
          const instrument = confirmDialog.instrument;
          if (confirmDialog.type === 'delete') { store.deleteInstrument(instrument.id); store.addOperation({ userId: user?.id || '', action: 'delete', entityType: 'instrument', entityId: instrument.id, details: `Удаление СИ ${instrument.inventoryNumber}` }); setShowDetailModal(false); setGlobalSearch(''); setShowSearchResults(false); setSelectedInstrument(null); setMenuPosition(null); }
          else if (confirmDialog.type === 'issue') { setShowDetailModal(false); setGlobalSearch(''); setShowSearchResults(false); setSelectedInstrument(null); setMenuPosition(null); onNavigate('issue-return', undefined, instrument.id); }
          else if (confirmDialog.type === 'return') { setShowDetailModal(false); setGlobalSearch(''); setShowSearchResults(false); setSelectedInstrument(null); setMenuPosition(null); onNavigate('issue-return', undefined, instrument.id); }
          setConfirmDialog(null);
        }} onCancel={() => setConfirmDialog(null)} />
      )}
    </div>
  );
}
