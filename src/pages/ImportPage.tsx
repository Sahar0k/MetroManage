import { useState, useCallback } from 'react';
import { store } from '../store';
import { useNotification } from '../contexts/NotificationContext';
import { playSuccess, playError } from '../utils/audio';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Download } from 'lucide-react';
import {
  parseExcel,
  validateImport,
  mapRowToInstrument,
  enrichFromGosreestr,
  importToStore,
  DEFAULT_MAPPING,
  ExcelRow,
  ImportMapping,
  ImportReport,
  EnrichmentProgress,
  EnrichedInstrument,
} from '../services/importService';

interface ImportPageProps {
  theme: 'dark' | 'light';
}

type ImportStep = 'upload' | 'preview' | 'enrichment' | 'complete';

export default function ImportPage({ theme }: ImportPageProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>(DEFAULT_MAPPING);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [instruments, setInstruments] = useState<EnrichedInstrument[]>([]);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const notification = useNotification();
  const isDark = theme === 'dark';
  const inputClass = `w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedRows = await parseExcel(file);
      setRows(parsedRows);
      setStep('preview');
      playSuccess();
      notification.success('Файл загружен', `Найдено ${parsedRows.length} строк`);
    } catch (error) {
      playError();
      notification.error('Ошибка', 'Не удалось прочитать файл');
    }
  }, [notification]);

  const handleValidate = useCallback(() => {
    const validation = validateImport(rows, mapping);
    const mappedInstruments = rows.map((row, index) => {
      const inst = mapRowToInstrument(row, mapping, index);
      return {
        ...inst,
        gosreestrNumber: row[mapping.gosreestrNumber || ''] || undefined,
      } as EnrichedInstrument;
    });

    setInstruments(mappedInstruments);
    setReport({
      total: rows.length,
      valid: rows.length - validation.errors.length,
      invalid: validation.errors.length,
      duplicates: validation.duplicates.size,
      enriched: 0,
      notFound: 0,
      errors: validation.errors,
    });

    if (validation.errors.length > 0) {
      playError();
      notification.warning('Найдены ошибки', `${validation.errors.length} строк с ошибками`);
    } else {
      playSuccess();
      notification.success('Валидация пройдена', 'Все строки корректны');
    }
  }, [rows, mapping, notification]);

  const handleEnrich = useCallback(async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsImporting(true);
    setStep('enrichment');

    try {
      const result = await enrichFromGosreestr(instruments, setProgress, controller.signal);
      
      setReport(prev => prev ? {
        ...prev,
        enriched: result.enriched,
        notFound: result.notFound,
      } : null);

      playSuccess();
      notification.success('Обогащение завершено', `${result.enriched} из ${instruments.length} приборов обогащено`);
      setStep('complete');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        notification.info('Импорт отменён', 'Обогащение прервано');
      } else {
        playError();
        notification.error('Ошибка', 'Не удалось обогатить данные');
      }
    } finally {
      setIsImporting(false);
      setAbortController(null);
    }
  }, [instruments, notification]);

  const handleImport = useCallback(() => {
    try {
      const result = importToStore(instruments, mapping, rows);
      playSuccess();
      notification.success('Импорт завершён', `Импортировано ${result.imported} приборов, создано ${result.employees} сотрудников`);
      
      // Сброс
      setStep('upload');
      setRows([]);
      setInstruments([]);
      setReport(null);
      setProgress(null);
    } catch (error) {
      playError();
      notification.error('Ошибка', 'Не удалось импортировать данные');
    }
  }, [instruments, mapping, rows, notification]);

  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setRows([]);
    setInstruments([]);
    setReport(null);
    setProgress(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileSpreadsheet size={24} className="text-cyan-400" />
          Импорт реестра СИ
        </h2>
        {step !== 'upload' && (
          <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">
            <X size={16} />Сбросить
          </button>
        )}
      </div>

      {/* Шаг 1: Загрузка файла */}
      {step === 'upload' && (
        <div className={`rounded-xl p-8 border-2 border-dashed ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-300 bg-slate-50'}`}>
          <div className="text-center">
            <Upload size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-semibold mb-2">Загрузите Excel файл</h3>
            <p className="text-sm text-slate-400 mb-4">Поддерживаются форматы .xlsx и .xls</p>
            <label className="inline-block px-6 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 cursor-pointer">
              Выбрать файл
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* Шаг 2: Превью и валидация */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <h3 className="font-semibold mb-3">Маппинг колонок</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(DEFAULT_MAPPING).map(([key, defaultValue]) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-1 block">{key}</label>
                  <input
                    value={(mapping as any)[key] || ''}
                    onChange={e => setMapping({ ...mapping, [key]: e.target.value })}
                    className={inputClass}
                    placeholder={defaultValue}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleValidate} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">
              <CheckCircle size={16} />Валидировать
            </button>
          </div>

          {report && (
            <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <h3 className="font-semibold mb-3">Отчёт валидации</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-slate-700/50">
                  <p className="text-xs text-slate-400">Всего строк</p>
                  <p className="text-2xl font-bold">{report.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <p className="text-xs text-emerald-400">Корректных</p>
                  <p className="text-2xl font-bold text-emerald-400">{report.valid}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10">
                  <p className="text-xs text-red-400">С ошибками</p>
                  <p className="text-2xl font-bold text-red-400">{report.invalid}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <p className="text-xs text-amber-400">Дубликатов</p>
                  <p className="text-2xl font-bold text-amber-400">{report.duplicates}</p>
                </div>
              </div>

              {report.errors.length > 0 && (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className={isDark ? 'bg-slate-700' : 'bg-slate-100'}>
                      <tr>
                        <th className="text-left px-3 py-2">Строка</th>
                        <th className="text-left px-3 py-2">Поле</th>
                        <th className="text-left px-3 py-2">Ошибка</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                      {report.errors.slice(0, 20).map((err, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{err.row}</td>
                          <td className="px-3 py-2">{err.field}</td>
                          <td className="px-3 py-2 text-red-400">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.errors.length > 20 && (
                    <p className="text-center text-sm text-slate-400 mt-2">... и ещё {report.errors.length - 20} ошибок</p>
                  )}
                </div>
              )}

              {report.valid > 0 && (
                <button onClick={handleEnrich} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">
                  <Download size={16} />Обогащить из Госреестра и импортировать
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Шаг 3: Обогащение */}
      {step === 'enrichment' && progress && (
        <div className={`rounded-xl p-8 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <div className="text-center mb-6">
            <Loader2 size={48} className="mx-auto mb-4 text-cyan-400 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Обогащение из Госреестра</h3>
            <p className="text-sm text-slate-400">Обработано {progress.current} из {progress.total}</p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Прогресс</span>
              <span className="font-medium">{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <p className="text-xs text-emerald-400">Обогащено</p>
              <p className="text-2xl font-bold text-emerald-400">{progress.enriched}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-700/50">
              <p className="text-xs text-slate-400">Не найдено</p>
              <p className="text-2xl font-bold">{progress.notFound}</p>
            </div>
          </div>

          <button onClick={handleCancel} className="w-full mt-4 px-4 py-3 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">
            Прервать
          </button>
        </div>
      )}

      {/* Шаг 4: Завершение */}
      {step === 'complete' && report && (
        <div className={`rounded-xl p-8 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <div className="text-center mb-6">
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400" />
            <h3 className="text-lg font-semibold mb-2">Обогащение завершено</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-slate-700/50">
              <p className="text-xs text-slate-400">Всего</p>
              <p className="text-2xl font-bold">{report.total}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <p className="text-xs text-emerald-400">Обогащено</p>
              <p className="text-2xl font-bold text-emerald-400">{report.enriched}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-700/50">
              <p className="text-xs text-slate-400">Не найдено</p>
              <p className="text-2xl font-bold">{report.notFound}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10">
              <p className="text-xs text-amber-400">Без даты поверки</p>
              <p className="text-2xl font-bold text-amber-400">{report.total}</p>
            </div>
          </div>

          <div className={`p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4`}>
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-400 mb-1">Важно</p>
                <p className="text-sm text-slate-300">
                  Все импортированные приборы не имеют даты последней поверки. 
                  Они будут добавлены в очередь «Уточнить дату поверки» на Сводке.
                </p>
              </div>
            </div>
          </div>

          <button onClick={handleImport} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">
            <Upload size={16} />Импортировать в систему
          </button>
        </div>
      )}
    </div>
  );
}
