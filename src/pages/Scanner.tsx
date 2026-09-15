import { useState, useEffect, useRef, useMemo } from 'react';
import { store, scannerStatus } from '../store';
import { ScannerEvent } from '../types';
import { playScan, playSuccess, playError, playNotification } from '../utils/audio';
import { Radio, Wifi, WifiOff, Signal, Zap } from 'lucide-react';

interface ScannerProps { theme: 'dark' | 'light'; }

export default function Scanner({ theme }: ScannerProps) {
  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastRssi, setLastRssi] = useState<number>(0);
  const [manualBarcode, setManualBarcode] = useState('');
  const [simulating, setSimulating] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const isDark = theme === 'dark';
  const instruments = useMemo(() => store.getInstruments(), []);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (simulating) { lastHeartbeatRef.current = Date.now(); setIsOnline(true); setLastRssi(Math.floor(Math.random() * 30) - 70); scannerStatus.setOnline(true); }
      if (Date.now() - lastHeartbeatRef.current > 6000) { setIsOnline(false); scannerStatus.setOnline(false); }
    }, 2000);
    return () => clearInterval(pingInterval);
  }, [simulating]);

  useEffect(() => {
    if (simulating) {
      const scheduleScan = () => {
        const delay = 5000 + Math.random() * 5000;
        scanIntervalRef.current = setTimeout(() => {
          if (instruments.length > 0) {
            const randomInstrument = instruments[Math.floor(Math.random() * instruments.length)];
            if (randomInstrument) {
              setEvents(prev => [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), barcode: randomInstrument.inventoryNumber, rssi: Math.floor(Math.random() * 30) - 70, online: true }, ...prev].slice(0, 50));
              playScan(); playNotification();
            }
          }
          scheduleScan();
        }, delay);
      };
      scheduleScan();
    } else { if (scanIntervalRef.current) clearTimeout(scanIntervalRef.current); }
    return () => { if (scanIntervalRef.current) clearTimeout(scanIntervalRef.current); };
  }, [simulating, instruments]);

  const handleManualScan = () => {
    if (!manualBarcode.trim()) return;
    setEvents(prev => [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), barcode: manualBarcode.trim(), rssi: -50, online: true }, ...prev].slice(0, 50));
    playScan(); setManualBarcode('');
    const found = instruments.find(i => i.inventoryNumber === manualBarcode.trim() || i.serialNumber === manualBarcode.trim());
    if (found) playSuccess(); else playError();
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-xl p-5 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>{isOnline ? <Wifi size={24} className="text-emerald-500" /> : <WifiOff size={24} className="text-red-500" />}</div>
            <div><p className="font-medium">{isOnline ? 'ОНЛАЙН' : 'ОФФЛАЙН'}</p><p className="text-xs text-slate-400">{isOnline ? `RSSI: ${lastRssi} dBm` : 'Сканер отключён'}</p></div>
          </div>
          <button onClick={() => { setSimulating(!simulating); if (!simulating) { lastHeartbeatRef.current = Date.now(); setIsOnline(true); scannerStatus.setOnline(true); } else { setIsOnline(false); scannerStatus.setOnline(false); } }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${simulating ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}><Zap size={16} />{simulating ? 'Отключить' : 'Подключить сканер'}</button>
        </div>
        {isOnline && (<div className="mt-4 flex items-center gap-2"><Signal size={14} className="text-slate-400" /><div className="flex items-end gap-0.5 h-5">{[1, 2, 3, 4, 5].map(i => (<div key={i} className={`w-1.5 rounded-full transition-all ${lastRssi > -50 + (i * -5) ? 'bg-emerald-500' : 'bg-slate-600'}`} style={{ height: `${i * 20}%` }} />))}</div><span className="text-xs text-slate-400">{lastRssi} dBm</span></div>)}
      </div>
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Radio size={16} className="text-cyan-500" />Ручной ввод штрихкода</h3>
        <div className="flex gap-2"><input value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleManualScan(); }} placeholder="СИ-0001 или серийный номер..." className={`flex-1 px-4 py-2.5 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`} /><button onClick={handleManualScan} className="px-4 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">SCAN</button></div>
      </div>
      {events.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="px-4 py-3 bg-slate-800 border-b border-slate-700"><h3 className="font-semibold text-sm">Последние сканирования</h3></div>
          <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="px-4 py-3 flex items-center justify-between">
                <div><p className="font-mono text-sm text-cyan-400">{event.barcode}</p><p className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString('ru-RU')}</p></div>
                <span className="text-xs text-slate-400">{event.rssi} dBm</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
