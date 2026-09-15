import { useState, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { playSuccess, playError } from '../utils/audio';
import { Settings, Download, Upload, Wifi, WifiOff, Database, RefreshCw } from 'lucide-react';
import {
  isGosreestrAccessEnabled,
  setGosreestrAccessEnabled,
  checkCacheFreshness,
} from '../services/gosreestrService';
import { indexedDBCache } from '../services/indexedDBCache';

interface SettingsPageProps {
  theme: 'dark' | 'light';
}

export default function SettingsPage({ theme }: SettingsPageProps) {
  const [gosreestrEnabled, setGosreestrEnabled] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 });
  const [cacheStats, setCacheStats] = useState({ cards: 0, lastUpdate: 0 });

  const notification = useNotification();
  const isDark = theme === 'dark';

  useEffect(() => {
    loadSettings();
    loadCacheStats();
  }, []);

  const loadSettings = async () => {
    const enabled = await isGosreestrAccessEnabled();
    setGosreestrEnabled(enabled);
  };

  const loadCacheStats = async () => {
    try {
      const cards = await indexedDBCache.getAllCachedCards();
      const lastUpdate = cards.length > 0 
        ? Math.max(...cards.map(c => c.timestamp))
        : 0;
      setCacheStats({ cards: cards.length, lastUpdate });
    } catch {
      setCacheStats({ cards: 0, lastUpdate: 0 });
    }
  };

  const handleToggleGosreestr = async () => {
    const newValue = !gosreestrEnabled;
    await setGosreestrAccessEnabled(newValue);
    setGosreestrEnabled(newValue);
    playSuccess();
    notification.success(
      'Настройка сохранена',
      newValue ? 'Доступ к Госреестру включён' : 'Доступ к Госреестру отключён'
    );
  };

  const handleCheckFreshness = async () => {
    setIsChecking(true);
    setCheckProgress({ current: 0, total: 0 });

    try {
      const result = await checkCacheFreshness((current, total) => {
        setCheckProgress({ current, total });
      });

      playSuccess();
      notification.success(
        'Проверка завершена',
        `Проверено ${result.checked}, обновлено ${result.updated}`
      );
      await loadCacheStats();
    } catch (error) {
      playError();
      notification.error('Ошибка', 'Не удалось проверить свежесть кэша');
    } finally {
      setIsChecking(false);
    }
  };

  const handleExportSnapshot = async () => {
    try {
      const snapshot = await indexedDBCache.exportSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrolog-snapshot-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      playSuccess();
      notification.success('Снапшот экспортирован', 'Файл сохранён');
    } catch (error) {
      playError();
      notification.error('Ошибка', 'Не удалось экспортировать снапшот');
    }
  };

  const handleImportSnapshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      await indexedDBCache.importSnapshot(snapshot);

      playSuccess();
      notification.success('Снапшот импортирован', 'Данные восстановлены из файла');
      await loadSettings();
      await loadCacheStats();
    } catch (error) {
      playError();
      notification.error('Ошибка', 'Не удалось импортировать снапшот');
    }

    // Reset input
    e.target.value = '';
  };

  const handleClearCache = async () => {
    if (!confirm('Очистить весь кэш? Это действие нельзя отменить.')) return;

    try {
      await indexedDBCache.clearAll();
      playSuccess();
      notification.success('Кэш очищен', 'Все кэшированные данные удалены');
      await loadCacheStats();
    } catch (error) {
      playError();
      notification.error('Ошибка', 'Не удалось очистить кэш');
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('ru-RU');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Settings size={24} className="text-cyan-400" />
        Настройки
      </h2>

      {/* Доступ к Госреестру */}
      <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wifi size={20} className="text-cyan-400" />
          Доступ к Госреестру СИ
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Доступ к Госреестру</p>
              <p className="text-sm text-slate-400">
                {gosreestrEnabled 
                  ? 'Автозаполнение карточек СИ из Госреестра включено' 
                  : 'Приложение работает в изолированном режиме'}
              </p>
            </div>
            <button
              onClick={handleToggleGosreestr}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                gosreestrEnabled ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  gosreestrEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {!gosreestrEnabled && (
            <div className={`p-4 rounded-lg ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <WifiOff size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400 mb-1">Изолированный контур</p>
                  <p className="text-sm text-slate-300">
                    Все сетевые запросы к Госреестру отключены. Используйте снапшот-импорт для загрузки данных из внешнего источника.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Клиентский кэш */}
      <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database size={20} className="text-cyan-400" />
          Клиентский кэш
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
              <p className="text-xs text-slate-400 mb-1">Кэшированных карточек</p>
              <p className="text-2xl font-bold">{cacheStats.cards}</p>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
              <p className="text-xs text-slate-400 mb-1">Последнее обновление</p>
              <p className="text-sm font-medium">{formatDate(cacheStats.lastUpdate)}</p>
            </div>
          </div>

          <button
            onClick={handleCheckFreshness}
            disabled={isChecking || !gosreestrEnabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Проверка {checkProgress.current} / {checkProgress.total}
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Проверить свежесть кэша
              </>
            )}
          </button>

          <button
            onClick={handleClearCache}
            className="w-full px-4 py-3 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30"
          >
            Очистить кэш
          </button>
        </div>
      </div>

      {/* Снапшот-импорт/экспорт */}
      <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Download size={20} className="text-cyan-400" />
          Снапшот данных
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Экспорт и импорт кэша для переноса между изолированными сегментами сети.
          </p>

          <button
            onClick={handleExportSnapshot}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
          >
            <Download size={16} />
            Экспортировать снапшот
          </button>

          <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 cursor-pointer">
            <Upload size={16} />
            Импортировать снапшот
            <input
              type="file"
              accept=".json"
              onChange={handleImportSnapshot}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
