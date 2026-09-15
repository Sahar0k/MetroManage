import { VerificationProtocol } from '../../types';
import { store } from '../../store';
import { formatDate } from '../../utils/domain';

interface PrintViewProps {
  protocol: VerificationProtocol;
}

export default function PrintView({ protocol }: PrintViewProps) {
  const employees = store.getEmployees();
  const operator = employees.find(e => e.id === protocol.operatorId);

  return (
    <div className="print-view bg-white text-black p-8 max-w-[210mm] mx-auto">
      {/* Заголовок */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">ПРОТОКОЛ ПОВЕРКИ</h1>
        <p className="text-sm mt-2">№ {protocol.id.substring(0, 8).toUpperCase()}</p>
      </div>

      {/* Информация о СИ */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">1. Сведения о средстве измерений</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 font-semibold w-1/3">Инвентарный номер:</td>
              <td className="py-1">{protocol.instrumentInventoryNumber}</td>
            </tr>
            <tr>
              <td className="py-1 font-semibold">Наименование:</td>
              <td className="py-1">{protocol.instrumentName}</td>
            </tr>
            <tr>
              <td className="py-1 font-semibold">Дата поверки:</td>
              <td className="py-1">{formatDate(protocol.dateEnd || protocol.dateStart)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Поверитель */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">2. Поверитель</h2>
        <p className="text-sm">{operator?.fullName || '—'}</p>
      </div>

      {/* Условия среды */}
      {protocol.conditions && (protocol.conditions.temperature || protocol.conditions.humidity) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">3. Условия проведения поверки</h2>
          <table className="w-full text-sm">
            <tbody>
              {protocol.conditions.temperature && (
                <tr>
                  <td className="py-1 font-semibold w-1/3">Температура:</td>
                  <td className="py-1">{protocol.conditions.temperature} °C</td>
                </tr>
              )}
              {protocol.conditions.humidity && (
                <tr>
                  <td className="py-1 font-semibold">Влажность:</td>
                  <td className="py-1">{protocol.conditions.humidity} %</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Результаты поверки */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">
          {protocol.conditions && (protocol.conditions.temperature || protocol.conditions.humidity) ? '4' : '3'}. Результаты поверки
        </h2>
        <table className="w-full text-sm border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1 text-left">№</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Наименование точки</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Номинал</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Ед. изм.</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Допуск</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Факт.</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Погрешн.</th>
              <th className="border border-gray-400 px-2 py-1 text-center">Вердикт</th>
            </tr>
          </thead>
          <tbody>
            {protocol.points.map((point, index) => (
              <tr key={point.id}>
                <td className="border border-gray-400 px-2 py-1">{index + 1}</td>
                <td className="border border-gray-400 px-2 py-1">{point.name}</td>
                <td className="border border-gray-400 px-2 py-1">{point.nominal}</td>
                <td className="border border-gray-400 px-2 py-1">{point.unit}</td>
                <td className="border border-gray-400 px-2 py-1">{point.tolerance}</td>
                <td className="border border-gray-400 px-2 py-1">{point.actual ?? '—'}</td>
                <td className="border border-gray-400 px-2 py-1">{point.error?.toFixed(4) ?? '—'}</td>
                <td className="border border-gray-400 px-2 py-1 text-center font-bold">
                  {point.verdict === 'pass' ? 'ГОДЕН' : point.verdict === 'fail' ? 'НЕ ГОДЕН' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Итоговый результат */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">
          {protocol.conditions && (protocol.conditions.temperature || protocol.conditions.humidity) ? '5' : '4'}. Заключение
        </h2>
        <div className={`p-4 border-2 ${protocol.result === 'pass' ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
          <p className="text-lg font-bold text-center">
            {protocol.result === 'pass' ? 'СРЕДСТВО ИЗМЕРЕНИЙ ГОДНО К ПРИМЕНЕНИЮ' : 'СРЕДСТВО ИЗМЕРЕНИЙ НЕ ГОДНО К ПРИМЕНЕНИЮ'}
          </p>
        </div>
      </div>

      {/* Подписи */}
      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <p className="text-sm font-semibold mb-8">Поверитель:</p>
          <div className="border-b border-black mb-1"></div>
          <p className="text-xs text-center">{operator?.fullName || '—'}</p>
        </div>
        <div>
          <p className="text-sm font-semibold mb-8">Дата:</p>
          <div className="border-b border-black mb-1"></div>
          <p className="text-xs text-center">{formatDate(protocol.dateEnd || protocol.dateStart)}</p>
        </div>
      </div>

      {/* Примечания */}
      {protocol.notes && (
        <div className="mt-8 pt-4 border-t border-gray-300">
          <p className="text-sm font-semibold mb-2">Примечания:</p>
          <p className="text-sm">{protocol.notes}</p>
        </div>
      )}
    </div>
  );
}
