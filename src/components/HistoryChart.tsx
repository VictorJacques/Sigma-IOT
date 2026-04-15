import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface HistoryChartProps {
  data: { timestamp: string; value: number }[];
}

export default function HistoryChart({ data }: HistoryChartProps) {
  const safeFormat = (dateStr: string, formatStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return format(date, formatStr);
    } catch (e) {
      return null;
    }
  };

  // Filter out invalid dates and sort chronologically
  const formattedData = data
    .filter(d => {
      const date = new Date(d.timestamp);
      return !isNaN(date.getTime()) && d.value !== undefined;
    })
    .map(d => ({
      ...d,
      time: safeFormat(d.timestamp, 'HH:mm') || '-',
      fullDate: safeFormat(d.timestamp, 'dd/MM/yyyy HH:mm:ss') || '-',
      timestampValue: new Date(d.timestamp).getTime()
    }))
    .sort((a, b) => a.timestampValue - b.timestampValue);

  if (formattedData.length === 0) {
    return (
      <div className="w-full h-48 mt-4 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <p className="text-xs text-text-muted italic">Aguardando dados válidos...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-48 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            dy={10}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis 
            domain={[0, 100]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            unit="%"
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid #E5E7EB', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              padding: '12px'
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#111827' }}
            labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3B82F6" 
            strokeWidth={2} 
            dot={false}
            activeDot={{ r: 6, fill: '#3B82F6', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
