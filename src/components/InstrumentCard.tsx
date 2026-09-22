import { useRef, useState, useEffect, memo } from 'react';
import { MeasuringInstrument } from '../types';
import { formatDate } from '../utils/domain';
import bwipjs from 'bwip-js';
import { X, Printer } from 'lucide-react';
import { COMPANY_NAME } from '../config';

interface InstrumentCardProps { instrument: MeasuringInstrument; onClose: () => void; }

const InstrumentCard = memo(function InstrumentCard({ instrument, onClose }: InstrumentCardProps) {
  const dataMatrixRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [dataMatrixError, setDataMatrixError] = useState<string | null>(null);

  useEffect(() => {
    const generateDataMatrix = () => {
      if (dataMatrixRef.current) {
        try {
          setDataMatrixError(null);
          bwipjs.toCanvas(dataMatrixRef.current, { bcid: 'datamatrix', text: instrument.inventoryNumber, scale: 6, includetext: false });
        } catch (error) { setDataMatrixError('Ошибка генерации DataMatrix'); }
      }
    };
    const timer = setTimeout(generateDataMatrix, 100);
    return () => clearTimeout(timer);
  }, [instrument.inventoryNumber, orientation, cardSize]);

  const handlePrint = () => {
    if (!cardRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Карточка ${instrument.inventoryNumber}</title><style>body{font-family:Arial;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px;}.card{border:2px solid black;padding:16px;width:400px;}.header{text-align:center;font-weight:bold;border-bottom:2px solid black;padding-bottom:8px;margin-bottom:12px;}.row{display:flex;justify-content:space-between;margin:4px 0;}.label{font-weight:600;}</style></head><body><div class="card"><div class="header">${COMPANY_NAME}</div><div class="row"><span class="label">Наименование:</span><span>${instrument.name}</span></div><div class="row"><span class="label">Модель:</span><span>${instrument.type}</span></div><div class="row"><span class="label">Серийный №:</span><span>${instrument.serialNumber}</span></div><div class="row"><span class="label">Дата поверки:</span><span>${formatDate(instrument.lastVerificationDate)}</span></div><div class="row"><span class="label">Следующая поверка:</span><span><b>${formatDate(instrument.nextVerificationDate)}</b></span></div></div><script>setTimeout(()=>{window.print();window.close();},100);</script></body></html>`);
    printWindow.document.close();
  };

  const sizeClasses = { small: 'w-[300px] p-3 text-xs', medium: 'w-[400px] p-4 text-sm', large: 'w-[500px] p-5 text-base' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-auto">
      <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Генерация карточки прибора</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700"><X size={20} /></button>
        </div>
        <div className="space-y-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Размер карточки</label>
              <select value={cardSize} onChange={(e) => setCardSize(e.target.value as any)} className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm">
                <option value="small">Маленькая</option><option value="medium">Средняя</option><option value="large">Большая</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Ориентация</label>
            <div className="flex gap-2">
              <button onClick={() => setOrientation('horizontal')} className={`flex-1 px-3 py-2 rounded-lg text-sm ${orientation === 'horizontal' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Горизонтальная</button>
              <button onClick={() => setOrientation('vertical')} className={`flex-1 px-3 py-2 rounded-lg text-sm ${orientation === 'vertical' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Вертикальная</button>
            </div>
          </div>
        </div>
        <div className="flex justify-center mb-6">
          <div ref={cardRef} className={`bg-white text-black border-2 border-black ${sizeClasses[cardSize]}`}>
            <div className="border-b-2 border-black pb-2 mb-3"><h3 className="font-bold text-center text-base">{COMPANY_NAME}</h3></div>
            <div className="space-y-1 mb-3">
              <div className="flex justify-between"><span className="font-semibold">Наименование:</span><span className="text-right">{instrument.name}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Модель:</span><span className="text-right">{instrument.type}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Серийный №:</span><span className="text-right">{instrument.serialNumber}</span></div>
            </div>
            <div className="border-t border-black pt-2 mb-3 space-y-1">
              <div className="flex justify-between"><span className="font-semibold">Дата поверки:</span><span className="text-right">{formatDate(instrument.lastVerificationDate)}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Следующая поверка:</span><span className="text-right font-bold">{formatDate(instrument.nextVerificationDate)}</span></div>
            </div>
            <div className="flex justify-center mb-3">
              {dataMatrixError ? <div className="w-[150px] h-[150px] flex items-center justify-center bg-red-50 border border-red-200 rounded"><p className="text-xs text-red-600">{dataMatrixError}</p></div> : <canvas ref={dataMatrixRef} width={150} height={150} style={{ width: '150px', height: '150px' }}></canvas>}
            </div>
            <div className="border-t-2 border-black pt-2 mt-3">
              <p className="font-semibold mb-1 text-xs">Главный метролог:</p>
              <p className="mt-4 border-b border-black w-full"></p>
              <p className="text-center text-xs mt-1">подпись</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Printer size={16} />Печать</button>
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Закрыть</button>
        </div>
      </div>
    </div>
  );
});

export default InstrumentCard;
