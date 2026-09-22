import { useState, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { playSuccess, playError } from '../utils/audio';
import { Database, ArrowRightLeft, Download, Upload, AlertTriangle } from 'lucide-react';
import { getStorageConfig, getStorageStats, LocalStorageAdapter, PocketBaseAdapter } from '../services/storage';
import { migrateLocalToPocketBase, migratePocketBaseToLocal, MigrationProgress, MigrationReport } from '../services/storage/migrationService';

interface MigrationPageProps {
  theme: 'dark' | 'light';
}

interface MigrationStats {
  local: number;
  remote: number;
}

export default function MigrationPage({ theme }: MigrationPageProps) {
  const [stats, setStats] = useState<MigrationStats>({ local: 0, remote: 0 });
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });

  const notification = useNotification();
  const isDark = theme === 'dark';
  const storageConfig = getStorageConfig();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const result = await getStorageStats();
      setStats(result);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleMigrateLocalToRemote = async () => {
    if (storageConfig.type !== 'pocketbase') {
      playError();
      notification.error('Ошибка', 'Переключитесь на серверный режим');
      return;
    }

    if (!confirm('Перенести все данные из локального хранилища на сервер?')) return;

    setIsMigrating(true);
    setMigrationProgress({ current: 0, total: 0 });

    try {
      const localAdapter = new LocalStorageAdapter();
      const pocketbaseAdapter = new PocketBaseAdapter(storageConfig.pocketbaseUrl || 'http://127.0.0.1:8090');

      const report = await migrateLocalToPocketBase(
        localAdapter,
        pocketbaseAdapter,
        (progress: MigrationProgress) => {
          setMigrationProgress({ current: progress.current, total: progress.total });
        }
      );

      playSuccess();
      notification.success(
        'Миграция завершена',
        `Перенесено: ${report.totalMigrated}, Конфликтов: ${report.totalConflicts}`
      );
      await loadStats();
    } catch (error) {
      playError();
      notification.error('Ошибка миграции', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMigrateRemoteToLocal = async () => {
    if (storageConfig.type !== 'pocketbase') {
      playError();
      notification.error('Ошибка', 'Переключитесь на серверный режим');
      return;
    }

    if (!confirm('Перенести все данные с сервера в локальное хранилище?')) return;

    setIsMigrating(true);
    setMigrationProgress({ current: 0, total: 0 });

    try {
      const localAdapter = new LocalStorageAdapter();
      const pocketbaseAdapter = new PocketBaseAdapter(storageConfig.pocketbaseUrl || 'http://127.0.0.1:8090');

      const report = await migratePocketBaseToLocal(
        pocketbaseAdapter,
        localAdapter,
        (progress: MigrationProgress) => {
          setMigrationProgress({ current: progress.current, total: progress.total });
        }
      );

      playSuccess();
      notification.success(
        'Миграция завершена',
        `Перенесено: ${report.totalMigrated}, Конфликтов: ${report.totalConflicts}`
      );
      await loadStats();
    } catch (error) {
      playError();
      notification.error('Ошибка миграции', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Database size={24} className="text-cyan-400" />
        Перенос данных
      </h2>

      {storageConfig.type !== 'pocketbase' && (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-400 mb-1">Требуется серверный режим</p>
              <p className="text-sm text-slate-300">
                Для переноса данных переключитесь на серверный режим в настройках.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <h3 className="text-lg font-semibold mb-4">Статистика данных</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <p className="text-xs text-slate-400 mb-1">Локально</p>
            <p className="text-2xl font-bold">{stats.local}</p>
            <p className="text-xs text-slate-500">записей</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <p className="text-xs text-slate-400 mb-1">На сервере</p>
            <p className="text-2xl font-bold">{stats.remote}</p>
            <p className="text-xs text-slate-500">записей</p>
          </div>
        </div>

        {isMigrating && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Прогресс миграции</span>
              <span className="font-medium">{migrationProgress.current} / {migrationProgress.total}</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${migrationProgress.total > 0 ? (migrationProgress.current / migrationProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleMigrateLocalToRemote}
            disabled={isMigrating || storageConfig.type !== 'pocketbase' || stats.local === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={16} />
            Локально → Сервер
          </button>

          <button
            onClick={handleMigrateRemoteToLocal}
            disabled={isMigrating || storageConfig.type !== 'pocketbase' || stats.remote === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Сервер → Локально
          </button>
        </div>
      </div>

      <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-amber-400" />
          Важная информация
        </h3>
        
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            • Перед миграцией убедитесь, что сервер доступен и настроен правильно
          </p>
          <p>
            • При переносе данных могут возникнуть конфликты (одинаковые ID с разными данными)
          </p>
          <p>
            • Рекомендуется создать резервную копию данных перед миграцией
          </p>
          <p>
            • После миграции проверьте целостность данных в обоих хранилищах
          </p>
        </div>
      </div>
    </div>
  );
}
