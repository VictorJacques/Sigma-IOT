import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import WaterLevel from './WaterLevel';
import HistoryChart from './HistoryChart';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { format } from 'date-fns';

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'12h' | '1d' | '3d' | '7d'>('12h');

  useEffect(() => {
    // Fetch User Profile to get locationId using email as ID
    const fetchUser = async () => {
      if (!auth.currentUser || !auth.currentUser.email) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          // If user doc doesn't exist, they might be the default admin
          if (auth.currentUser.email === "victorjacques2207@gmail.com") {
            setUserData({ role: 'admin' });
          } else {
            setError("Perfil de usuário não encontrado.");
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Erro ao carregar perfil.");
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userData) return;

    const locationId = userData.locationId;
    if (!locationId && userData.role !== 'admin') {
      setError("Nenhum local vinculado a este usuário.");
      setLoading(false);
      return;
    }

    // Fetch Sensors for this location
    const sensorsQuery = locationId 
      ? query(collection(db, 'sensors'), where('locationId', '==', locationId))
      : collection(db, 'sensors');

    const unsubscribeSensors = onSnapshot(sensorsQuery, (snapshot) => {
      const sensorsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSensors(sensorsData);
    });

    const now = new Date();
    const startTime = new Date();
    if (timeRange === '12h') startTime.setHours(now.getHours() - 12);
    else if (timeRange === '1d') startTime.setHours(now.getHours() - 24);
    else if (timeRange === '3d') startTime.setDate(now.getDate() - 3);
    else if (timeRange === '7d') startTime.setDate(now.getDate() - 7);

    const q = locationId 
      ? query(
          collection(db, 'telemetry'), 
          where('locationId', '==', locationId), 
          where('timestamp', '>=', startTime.toISOString()),
          orderBy('timestamp', 'desc'), 
          limit(500)
        )
      : query(
          collection(db, 'telemetry'), 
          where('timestamp', '>=', startTime.toISOString()),
          orderBy('timestamp', 'desc'), 
          limit(500)
        );

    const unsubscribeTelemetry = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTelemetry(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Erro ao carregar dados.");
      setLoading(false);
    });

    return () => {
      unsubscribeSensors();
      unsubscribeTelemetry();
    };
  }, [userData, timeRange]);

  const handleLogout = () => signOut(auth);

  const latestReading = telemetry[0];
  const lastUpdate = latestReading ? new Date(latestReading.timestamp) : null;
  
  const sensorInfo = latestReading ? sensors.find(s => s.sensorId === latestReading.sensorId) : null;
  const sensorDisplayName = sensorInfo ? sensorInfo.name : (latestReading?.sensorId || 'Aguardando...');

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      {/* Header */}
      <header className="px-10 py-6 flex justify-between items-center bg-card border-b border-border-gray">
        <div className="text-primary-blue font-extrabold text-2xl tracking-tighter">SIGMA IOT</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ECFDF5] text-success-green rounded-full text-[12px] font-semibold">
          <div className="w-2 h-2 bg-success-green rounded-full" />
          SISTEMA ONLINE
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-10">
        <div className="flex flex-col gap-6">
          {/* Hero Stat Card */}
          <div className="card-minimal flex items-center justify-between">
            <div className="flex-1">
              <span className="label-minimal">Volume Atual</span>
              <div className="big-number-minimal">
                {latestReading ? latestReading.value.toFixed(1) : '0.0'}
                <span className="text-[40px] text-text-muted font-normal tracking-normal">%</span>
              </div>
              
              <div className="mt-4">
                <span className="text-xs font-bold text-primary-blue uppercase tracking-widest">{sensorDisplayName}</span>
              </div>
            </div>
            
            <WaterLevel percentage={latestReading?.value || 0} />
          </div>

          {/* History Chart Card */}
          <div className="card-minimal">
            <div className="flex justify-between items-center mb-6">
              <span className="label-minimal !mb-0">Histórico de Nível</span>
              <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                {(['12h', '1d', '3d', '7d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      timeRange === range 
                        ? 'bg-white text-primary-blue shadow-sm' 
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <HistoryChart data={telemetry} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Technical Details Card */}
          <div className="card-minimal !p-8">
            <span className="label-minimal">Detalhes Técnicos</span>
            <div className="flex justify-between py-3 border-b border-[#F3F4F6]">
              <span className="text-[14px] text-text-muted">Sensor</span>
              <span className="text-[14px] font-semibold text-text-main">{sensorDisplayName}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-[#F3F4F6]">
              <span className="text-[14px] text-text-muted">ID Hardware</span>
              <span className="text-[14px] font-semibold text-text-main">{latestReading?.sensorId || '--'}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-[#F3F4F6]">
              <span className="text-[14px] text-text-muted">Rede Wi-Fi</span>
              <span className="text-[14px] font-semibold text-text-main">iPhone (Personal)</span>
            </div>
            <div className="flex justify-between py-3 border-b border-[#F3F4F6]">
              <span className="text-[14px] text-text-muted">Sinal (RSSI)</span>
              <span className="text-[14px] font-semibold text-text-main">-64 dBm</span>
            </div>
            <div className="flex justify-between py-3 border-b border-[#F3F4F6]">
              <span className="text-[14px] text-text-muted">Database</span>
              <span className="text-[14px] font-semibold text-text-main">Firestore (Cloud)</span>
            </div>
          </div>

          {/* Last Update Card */}
          <div className="card-minimal !p-8">
            <span className="label-minimal">Última Atualização</span>
            <div className="text-[24px] font-medium mb-1">
              {lastUpdate ? format(lastUpdate, 'HH:mm:ss') : '--:--:--'}
            </div>
            <div className="text-[14px] text-text-muted">
              {lastUpdate ? format(lastUpdate, "d 'de' MMMM, yyyy") : 'Aguardando dados...'}
            </div>
          </div>

          {/* User & Logout */}
          <div className="mt-auto flex justify-between items-center text-[12px] text-text-muted">
            <div className="flex flex-col">
              <span>{auth.currentUser?.email}</span>
              <button onClick={handleLogout} className="text-red-500 hover:underline text-left font-semibold mt-1 flex items-center gap-1">
                <LogOut className="w-3 h-3" /> Sair
              </button>
            </div>
            <div className="text-right">
              <span>v2.0.4-stable</span>
              <br />
              <span>Sigma IoT &copy; 2024</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
