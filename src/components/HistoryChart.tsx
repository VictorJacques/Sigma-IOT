import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface HistoryChartProps {
  data: { timestamp: string; value: number; sensorId?: string }[];
  sensors?: any[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

export default function HistoryChart({ data, sensors }: HistoryChartProps) {
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
    .map(d => {
      const sensorName = sensors?.find(s => s.sensorId === d.sensorId)?.name || d.sensorId || 'Sensor';
      return {
        ...d,
        sensorName,
        time: safeFormat(d.timestamp, 'HH:mm') || '-',
        fullDate: safeFormat(d.timestamp, 'dd/MM/yyyy HH:mm:ss') || '-',
        timestampValue: new Date(d.timestamp).getTime()
      };
    })
    .sort((a, b) => a.timestampValue - b.timestampValue);

  if (formattedData.length === 0) {
    return (
      <div className="w-full h-48 mt-4 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <p className="text-xs text-text-muted italic">Aguardando dados válidos...</p>
      </div>
    );
  }

  // Get unique sensor IDs present in the data
  const sensorIds = Array.from(new Set(formattedData.map(d => d.sensorId).filter(Boolean)));

  return (
    <div className="w-full h-64 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData}>
          <defs>
            {sensorIds.map((sid, index) => (
              <linearGradient key={`gradient-${sid}`} id={`color-${sid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
            <linearGradient id="colorDefault" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#6B7280' }}
            dy={10}
            padding={{ left: 10, right: 10 }}
            allowDuplicatedCategory={false}
          />
          <YAxis 
            domain={[0, 100]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#6B7280' }}
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
            labelFormatter={(label, payload) => {
              const data = payload[0]?.payload;
              return data ? data.fullDate : label;
            }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold' }}
            iconType="circle"
          />
          {sensorIds.length > 0 ? (
            sensorIds.map((sid, index) => (
              <Area 
                key={sid}
                name={sensors?.find(s => s.sensorId === sid)?.name || sid}
                data={formattedData.filter(d => d.sensorId === sid)}
                type="basis" 
                dataKey="value" 
                stroke={COLORS[index % COLORS.length]} 
                fillOpacity={1}
                fill={`url(#color-${sid})`}
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: COLORS[index % COLORS.length] }}
                connectNulls
                animationDuration={1500}
              />
            ))
          ) : (
            <Area 
              type="basis" 
              dataKey="value" 
              stroke="#3B82F6" 
              fillOpacity={1}
              fill="url(#colorDefault)"
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#3B82F6' }}
              animationDuration={1500}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
