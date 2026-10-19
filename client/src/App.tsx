import AdmissionApp from './AdmissionSystem/AdmissionApp';
import { useCallback, useState, useEffect } from 'react';
import io from 'socket.io-client';
import QRCode from "react-qr-code";
import { Scanner } from '@yudiel/react-qr-scanner';
import GoogleSignInButton from './components/GoogleSignInButton';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import {
  QrCode, MapPin, RefreshCw, CheckCircle, Camera, X, House,
  GraduationCap, Calendar, ArrowRight, ChevronLeft, School, User, Lock, LogIn, LogOut, BadgeCheck, Keyboard, Search, Clock, FileText, Users, Map as MapIcon, Crosshair, PlusCircle, Star, Settings, Pencil, Trash2, Bluetooth
} from 'lucide-react';
import { RecommendationDashboard } from './components/RecommendationDashboard';
import { UserProfile } from './components/UserProfile';
import { StudentManagement } from './components/StudentManagement';
import EventDashboard from './components/EventDashboard';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const socket = io(API_BASE_URL);
const roleRequestHeaders = (role: string) => ({ 'X-User-Role': role === '教師' ? 'teacher' : role });

// --- 資料常數 ---
const CAMPUSES = ["全部", "臺北校區", "桃園校區"];
const TARGETS = ["全部", "學生", "教職", "校外"];
const CATEGORIES = ["全部", "研討會", "專題演講/講座", "研習活動", "工作坊/研習營", "藝文活動", "座談/說明會", "成果展", "參訪觀摩", "活動通告", "課程"];
const OTHER_OPTION = '__other__';
const ORGANIZERS = [
  "全部", "人事室", "心理諮商組", "企業管理系", "服務學習組", "軍訓室",
  "課外活動組", "通識教育中心", "資訊管理系", "體育室", "圖書館", "教務處", "學生事務處"
];

type Activity = {
  id: number;
  title: string;
  organizer: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  description: string;
  dateRange: string;
  regRange: string;
  campus: string;
  location: string;
  category: string;
  target: string;
  capacity: number;
  currentReg: number;
  fee?: number;
  registrationStart?: string;
  registrationEnd?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  bluetoothCheckInRequired?: boolean;
  bluetoothBeaconName?: string | null;
  bluetoothServiceUuid?: string | null;
  registered?: boolean;
  checkedIn?: boolean;
  status: 'open' | 'closed' | 'ended';
};

type BluetoothDeviceLike = {
  name?: string | null;
  gatt?: {
    connect: () => Promise<{
      getPrimaryService: (service: string) => Promise<unknown>;
      disconnect: () => void;
    }>;
  };
};

type BluetoothRequestFilter = { name?: string; services?: string[] };
type BluetoothApi = {
  requestDevice: (options: { filters: BluetoothRequestFilter[]; optionalServices?: string[] }) => Promise<BluetoothDeviceLike>;
};

function parseActivityDateRange(value: string | undefined): { start: string; end: string } {
  if (!value) return { start: '', end: '' };
  const dates = [...value.matchAll(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g)];
  const times = [...value.matchAll(/(?:^|\s)(\d{1,2}):(\d{2})/g)];
  if (dates.length === 0) return { start: '', end: '' };
  const format = (dateMatch: RegExpMatchArray, timeMatch?: RegExpMatchArray) => {
    const [, year, month, day] = dateMatch;
    const hour = timeMatch?.[1] ?? '00';
    const minute = timeMatch?.[2] ?? '00';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}`;
  };
  if (dates.length > 1) {
    return { start: format(dates[0], times[0]), end: format(dates[1], times[1]) };
  }
  return {
    start: format(dates[0], times[0]),
    end: format(dates[0], times[1] || times[0]),
  };
}

function formatActivityDateRange(start: string, end: string): string {
  const format = (value: string) => {
    const [date, time] = value.split('T');
    return `${date.replace(/-/g, '/')} ${time}`;
  };
  return `${format(start)} ~ ${format(end)}`;
}

function toDateTimeLocal(value: string | undefined): string {
  if (!value) return '';
  const normalized = value.trim().replace(' ', 'T');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00` : normalized.slice(0, 16);
}

// --- 建立活動 Modal ---
function CreateEventModal({ onClose, activity, role }: { onClose: () => void, activity?: Activity, role: string }) {
  const [title, setTitle] = useState(activity?.title || '');
  const [description, setDescription] = useState(activity?.description || '');
  const initialDateRange = parseActivityDateRange(activity?.dateRange);
  const [eventStart, setEventStart] = useState(initialDateRange.start);
  const [eventEnd, setEventEnd] = useState(initialDateRange.end);
  const [registrationStart, setRegistrationStart] = useState(toDateTimeLocal(activity?.registrationStart));
  const [registrationEnd, setRegistrationEnd] = useState(toDateTimeLocal(activity?.registrationEnd));
  const [organizer, setOrganizer] = useState(activity?.organizer || '資訊管理系');
  const [target, setTarget] = useState(activity?.target || '學生');
  const [category, setCategory] = useState(activity?.category || '研習活動');
  const [campus, setCampus] = useState(activity?.campus || '臺北校區');
  const [contactPerson, setContactPerson] = useState(activity?.contactPerson || '陳助教');
  const [contactPhone, setContactPhone] = useState(activity?.contactPhone || '02-23226321');
  const [contactEmail, setContactEmail] = useState(activity?.contactEmail || 'imd@ntub.edu.tw');
  const [locationName, setLocationName] = useState(activity?.location || '');
  const [fee, setFee] = useState(activity?.fee ?? 0);
  const [capacity, setCapacity] = useState(activity?.capacity ?? 50);
  const [lat, setLat] = useState(activity?.locationLat ?? 25.0423);
  const [lng, setLng] = useState(activity?.locationLng ?? 121.5255);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title || !eventStart || !eventEnd || !registrationStart || !registrationEnd) { alert('請填寫活動名稱、活動起迄時間及報名起迄時間'); return; }
    if (eventEnd <= eventStart) { alert('活動結束時間必須晚於開始時間'); return; }
    if (registrationEnd < registrationStart) { alert('報名結束日期不能早於開始日期'); return; }
    if (!Number.isInteger(fee) || fee < 0 || !Number.isInteger(capacity) || capacity < 1) {
      alert('報名費用及活動名額請輸入有效的非負整數（名額至少為 1）');
      return;
    }
    if (![organizer, target, category].every(value => value.trim())) {
      alert('請選擇或輸入主辦單位、對象及類別');
      return;
    }
    const eventData = {
      title, description, dateRange: formatActivityDateRange(eventStart, eventEnd), registrationStart, registrationEnd,
      organizer: organizer.trim(), target: target.trim(), category: category.trim(), campus,
      contactPerson, contactPhone, contactEmail, locationName,
      fee, capacity, lat, lng,
    };
    if (!activity) {
      socket.emit('host_create_event', { ...eventData, role });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${activity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...roleRequestHeaders(role) },
        body: JSON.stringify(eventData),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '更新活動失敗');
      alert('活動更新成功');
      onClose();
    } catch (error) {
      console.error('更新活動失敗:', error);
      alert(`更新活動失敗：${(error as Error).message || '請稍後再試'}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleCreateSuccess = () => { alert('✅ 活動建立成功！'); onClose(); };
    const handleCreateError = (data: { msg?: string }) => { alert(`❌ ${data.msg || '建立失敗'}`); };
    socket.on('create_event_success', handleCreateSuccess);
    socket.on('create_event_error', handleCreateError);
    return () => {
      socket.off('create_event_success', handleCreateSuccess);
      socket.off('create_event_error', handleCreateError);
    };
  }, [onClose]);

  const handleGetGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        alert('📍 已抓取目前位置');
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-scale-in">
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2"><PlusCircle />{activity ? '編輯活動' : '新增活動'}</h2><button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button></div>
        <div className="space-y-4">
          <div><label className="block text-sm font-bold text-gray-700 mb-1">活動名稱</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="例如：114學年度 期末成果發表" /></div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">活動起迄日期</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">開始時間</label>
                <input aria-label="活動開始日期與時間" type="datetime-local" required max={eventEnd || undefined} value={eventStart} onChange={e => setEventStart(e.target.value)} className="w-full border p-2 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">結束時間</label>
                <input aria-label="活動結束日期與時間" type="datetime-local" required min={eventStart || undefined} value={eventEnd} onChange={e => setEventEnd(e.target.value)} className="w-full border p-2 rounded-lg" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">報名起迄日期與時間</label>
            <div className="grid grid-cols-2 gap-3">
              <input aria-label="報名開始日期與時間" type="datetime-local" required max={registrationEnd || undefined} value={registrationStart} onChange={e => setRegistrationStart(e.target.value)} className="w-full border p-2 rounded-lg" />
              <input aria-label="報名結束日期與時間" type="datetime-local" required min={registrationStart || undefined} value={registrationEnd} onChange={e => setRegistrationEnd(e.target.value)} className="w-full border p-2 rounded-lg" />
            </div>
          </div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">活動描述</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2 rounded-lg h-24" placeholder="請輸入活動詳細內容..." /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">主辦單位</label>
              <select value={ORGANIZERS.includes(organizer) ? organizer : OTHER_OPTION} onChange={e => setOrganizer(e.target.value === OTHER_OPTION ? '' : e.target.value)} className="w-full border p-2 rounded-lg">
                {ORGANIZERS.filter(option => option !== '全部').map(option => <option key={option} value={option}>{option}</option>)}
                <option value={OTHER_OPTION}>其他</option>
              </select>
              {!ORGANIZERS.includes(organizer) && <input type="text" value={organizer} onChange={e => setOrganizer(e.target.value)} className="w-full border p-2 rounded-lg mt-2" placeholder="請輸入自訂主辦單位" />}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">對象</label>
              <select value={TARGETS.includes(target) ? target : OTHER_OPTION} onChange={e => setTarget(e.target.value === OTHER_OPTION ? '' : e.target.value)} className="w-full border p-2 rounded-lg">
                {TARGETS.map(option => <option key={option} value={option}>{option}</option>)}
                <option value={OTHER_OPTION}>其他</option>
              </select>
              {!TARGETS.includes(target) && <input type="text" value={target} onChange={e => setTarget(e.target.value)} className="w-full border p-2 rounded-lg mt-2" placeholder="請輸入自訂對象" />}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">類別</label>
              <select value={CATEGORIES.includes(category) ? category : OTHER_OPTION} onChange={e => setCategory(e.target.value === OTHER_OPTION ? '' : e.target.value)} className="w-full border p-2 rounded-lg">
                {CATEGORIES.filter(option => option !== '全部').map(option => <option key={option} value={option}>{option}</option>)}
                <option value={OTHER_OPTION}>其他</option>
              </select>
              {!CATEGORIES.includes(category) && <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full border p-2 rounded-lg mt-2" placeholder="請輸入自訂類別" />}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">校區</label>
              <select value={campus} onChange={e => setCampus(e.target.value)} className="w-full border p-2 rounded-lg">
                {campus && !CAMPUSES.includes(campus) && <option value={campus}>{campus}</option>}
                {CAMPUSES.filter(option => option !== '全部').map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">聯絡人</label><input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full border p-2 rounded-lg" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">聯絡電話</label><input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full border p-2 rounded-lg" /></div>
          </div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label><input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full border p-2 rounded-lg" /></div>
          
          <div><label className="block text-sm font-bold text-gray-700 mb-1">報名費用 (NT$)</label><input type="number" min="0" value={fee} onChange={e => setFee(Number(e.target.value))} className="w-full border p-2 rounded-lg" placeholder="輸入金額，0 代表免費" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">活動名額</label><input type="number" min="1" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full border p-2 rounded-lg" /></div>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">簽到地點設定</label>
            <div className="flex gap-2 items-center mb-2"><MapPin size={16} className="text-red-500" /><span className="text-xs text-gray-500">{lat.toFixed(6)}, {lng.toFixed(6)}</span></div>
            <button onClick={handleGetGPS} className="w-full py-2 bg-white border border-blue-500 text-blue-600 rounded-lg font-bold hover:bg-blue-50 flex justify-center items-center gap-2"><Crosshair size={16} /> 使用目前位置</button>
            <label className="block text-sm font-bold text-gray-700 mt-3 mb-1">地點名稱／備註</label>
            <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} className="w-full border p-2 rounded-lg" placeholder="例如：行政大樓 3 樓第一會議室" />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg mt-4 disabled:bg-gray-400">{saving ? '儲存中...' : activity ? '儲存變更' : '確認建立'}</button>
        </div>
      </div>
    </div>
  );
}

type EventAttendee = {
  registrationId: number;
  studentId: string | null;
  name: string | null;
  status: string | null;
  isCheckedIn: boolean | null;
};

function EventRegistrationsModal({ activity, role, onClose, onChanged }: {
  activity: Activity;
  role: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAttendees = useCallback(async (): Promise<EventAttendee[]> => {
    const response = await fetch(`${API_BASE_URL}/api/events/${activity.id}/registrations`, {
      headers: roleRequestHeaders(role),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || '無法載入報名名單');
    return result.data;
  }, [activity.id, role]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const result = await loadAttendees();
        if (isMounted) setAttendees(result);
      } catch (loadError) {
        console.error('載入活動報名名單失敗:', loadError);
        if (isMounted) setError((loadError as Error).message || '載入報名名單失敗');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => { isMounted = false; };
  }, [loadAttendees]);

  const refreshAttendees = async () => {
    setLoading(true);
    setError('');
    try {
      setAttendees(await loadAttendees());
    } catch (loadError) {
      console.error('載入活動報名名單失敗:', loadError);
      setError((loadError as Error).message || '載入報名名單失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (attendee: EventAttendee) => {
    if (!window.confirm(`確定要取消 ${attendee.name || attendee.studentId || '此學生'} 的「${activity.title}」報名嗎？此操作不會自動退款。`)) return;
    setCancellingId(attendee.registrationId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${activity.id}/registrations/${attendee.registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...roleRequestHeaders(role) },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '取消報名失敗');
      await refreshAttendees();
      onChanged();
    } catch (cancelError) {
      console.error('取消學生報名失敗:', cancelError);
      alert(`取消報名失敗：${(cancelError as Error).message || '請稍後再試'}`);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-blue-900">報名學生管理</h2>
            <p className="text-sm text-gray-500 mt-1">{activity.title}</p>
          </div>
          <button onClick={onClose} aria-label="關閉報名名單"><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        {loading ? <p className="py-8 text-center text-gray-500">載入中...</p> : error ? (
          <div className="py-6 text-center text-red-600">{error}<button onClick={() => void refreshAttendees()} className="block mx-auto mt-3 underline">重新載入</button></div>
        ) : attendees.length === 0 ? (
          <p className="py-8 text-center text-gray-500">目前沒有有效報名的學生</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {attendees.map(attendee => (
              <div key={attendee.registrationId} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-800">{attendee.name || '未提供姓名'}</p>
                  <p className="text-sm text-gray-500">{attendee.studentId || '無學號'} · {attendee.status || '已報名'}{attendee.isCheckedIn ? ' · 已簽到' : ''}</p>
                </div>
                <button
                  onClick={() => void handleCancel(attendee)}
                  disabled={cancellingId === attendee.registrationId}
                  className="shrink-0 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-100 disabled:opacity-50"
                >
                  {cancellingId === attendee.registrationId ? '處理中...' : '取消報名'}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-gray-500">取消後會保留報名與付款紀錄，不會自動退款。</p>
      </div>
    </div>
  );
}

// --- 地圖選點模擬器 ---
function MapPicker({ onConfirm, onClose }: { onConfirm: (lat: number, lng: number, addr: string) => void, onClose: () => void }) {
  const [pickedPos, setPickedPos] = useState({ x: 50, y: 50 });
  const [mockLat, setMockLat] = useState(25.0423);
  const [mockLng, setMockLng] = useState(121.5255);
  const [address, setAddress] = useState('臺北商業大學 (預設)');
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPickedPos({ x, y });
    const newLat = 25.0423 + (y - 50) * 0.0001;
    const newLng = 121.5255 + (x - 50) * 0.0001;
    setMockLat(newLat); setMockLng(newLng);
    setAddress(`自訂地圖座標 (${newLat.toFixed(4)}, ${newLng.toFixed(4)})`);
  };
  const handleUseGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMockLat(pos.coords.latitude); setMockLng(pos.coords.longitude);
        setAddress('目前裝置 GPS 位置'); setPickedPos({ x: 50, y: 50 }); alert('📍 已抓取目前位置！');
      });
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-in">
        <div className="bg-blue-900 p-4 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><MapIcon size={20} /> 設定活動地點</h3><button onClick={onClose}><X size={20} /></button></div>
        <div className="h-64 bg-gray-200 relative cursor-crosshair group overflow-hidden" onClick={handleMapClick} style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center text-6xl font-bold text-gray-400 select-none">MAP VIEW</div>
          <div className="absolute top-2 left-2 bg-white/80 px-2 py-1 text-xs rounded text-gray-600 pointer-events-none">點擊地圖以移動座標</div>
          <div className="absolute text-red-600 transform -translate-x-1/2 -translate-y-full transition-all duration-300" style={{ left: `${pickedPos.x}%`, top: `${pickedPos.y}%` }}><MapPin size={40} fill="currentColor" /></div>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="text-xs font-bold text-gray-500 uppercase">地點名稱 / 地址</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 mt-1 font-mono text-sm" /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-500 uppercase">緯度 (Lat)</label><input type="text" value={mockLat.toFixed(6)} readOnly className="w-full bg-gray-50 border rounded-lg p-2 text-xs font-mono" /></div><div><label className="text-xs font-bold text-gray-500 uppercase">經度 (Lng)</label><input type="text" value={mockLng.toFixed(6)} readOnly className="w-full bg-gray-50 border rounded-lg p-2 text-xs font-mono" /></div></div>
          <div className="flex gap-2 pt-2"><button onClick={handleUseGPS} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2"><Crosshair size={18} /> 使用 GPS</button><button onClick={() => onConfirm(mockLat, mockLng, address)} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"><CheckCircle size={18} /> 確認設定</button></div>
        </div>
      </div>
    </div>
  );
}

// --- 簽到核心元件 ---
function CheckInCore({ onBack, user, eventId, onViewDetail, mode }: { onBack: () => void, user: any, eventId: number, onViewDetail: (id: number) => void, mode: 'host' | 'guest' }) {
  const [currentCode, setCurrentCode] = useState('------');
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [inputCode, setInputCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [eventLocation, setEventLocation] = useState('預設地點');
  const [bluetoothCheckInRequired, setBluetoothCheckInRequired] = useState(false);
  const [bluetoothBeaconName, setBluetoothBeaconName] = useState('');
  const [bluetoothServiceUuid, setBluetoothServiceUuid] = useState('');
  const [bluetoothProof, setBluetoothProof] = useState<{ deviceName: string; serviceUuid: string } | null>(null);
  const [isVerifyingBluetooth, setIsVerifyingBluetooth] = useState(false);
  const [isSavingBluetoothSettings, setIsSavingBluetoothSettings] = useState(false);

  useEffect(() => {
    const handleCodeSync = (data: { eventId: number; code: string }) => {
      if (data.eventId !== eventId) return;
      setCurrentCode(data.code);
    };
    const handleAttendeeUpdate = (data: { count: number }) => setAttendeeCount(data.count);
    const handleCheckInSettings = (data: {
      eventId: number;
      bluetoothCheckInRequired: boolean;
      bluetoothBeaconName: string | null;
      bluetoothServiceUuid: string | null;
    }) => {
      if (data.eventId !== eventId) return;
      setBluetoothCheckInRequired(data.bluetoothCheckInRequired);
      setBluetoothBeaconName(data.bluetoothBeaconName || '');
      setBluetoothServiceUuid(data.bluetoothServiceUuid || '');
      setBluetoothProof(null);
    };
    const handleLocationUpdate = () => alert('✅ 活動地點已更新！');
    const handleCheckInResult = (data: { success: boolean, msg: string, source?: string }) => {
      setStatusMsg(data.msg);
      if (data.success) {
        if (data.source === 'host') {
          alert(`✅ ${data.msg}`);
          setManualStudentId('');
          setShowManualInput(false);
        } else if (data.source === 'guest' && mode === 'guest') {
          setShowScanner(false);
          setTimeout(() => setCheckInSuccess(true), 800);
        }
      } else {
        if (data.source === 'host') {
          alert(`❌ 補登失敗！\n原因：${data.msg}`);
        }
      }
    };
    socket.on('code_sync', handleCodeSync);
    socket.on('attendee_update', handleAttendeeUpdate);
    socket.on('check_in_settings_sync', handleCheckInSettings);
    socket.on('location_update_success', handleLocationUpdate);
    socket.on('check_in_result', handleCheckInResult);
    socket.emit('get_event_stats', { eventId });
    return () => {
      socket.off('code_sync', handleCodeSync);
      socket.off('attendee_update', handleAttendeeUpdate);
      socket.off('check_in_settings_sync', handleCheckInSettings);
      socket.off('location_update_success', handleLocationUpdate);
      socket.off('check_in_result', handleCheckInResult);
    };
  }, [eventId, mode]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const updateCode = () => {
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      socket.emit('host_update_code', { eventId, newCode: randomCode });
    };
    const scheduleNext = () => {
      const randomDelay = Math.floor(Math.random() * 5001) + 10000;
      timeoutId = setTimeout(() => {
        updateCode();
        scheduleNext();
      }, randomDelay);
    };
    if (mode === 'host') {
      updateCode();
      scheduleNext();
    }
    return () => clearTimeout(timeoutId);
  }, [mode, eventId]);

  const handleUpdateCode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    socket.emit('host_update_code', { eventId, newCode: randomCode });
  };
  
  const handleUpdateLocation = (lat: number, lng: number, addr: string) => {
    socket.emit('host_update_location', { eventId, lat, lng, address: addr });
    setEventLocation(addr); setShowMapPicker(false);
  };

  const handleSaveBluetoothSettings = async () => {
    if (bluetoothCheckInRequired && !bluetoothBeaconName.trim() && !bluetoothServiceUuid.trim()) {
      alert('啟用藍牙簽到時，請設定藍牙設備名稱或 Service UUID');
      return;
    }
    setIsSavingBluetoothSettings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/check-in-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...roleRequestHeaders(user.role) },
        body: JSON.stringify({
          bluetoothCheckInRequired,
          bluetoothBeaconName,
          bluetoothServiceUuid,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '儲存簽到設定失敗');
      setBluetoothProof(null);
      alert('簽到設定已儲存');
    } catch (error) {
      console.error('儲存藍牙簽到設定失敗:', error);
      alert(`儲存簽到設定失敗：${(error as Error).message || '請稍後再試'}`);
    } finally {
      setIsSavingBluetoothSettings(false);
    }
  };

  const handleGetGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => { setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setStatusMsg('📍 已定位'); },
        () => {
          if (bluetoothCheckInRequired) {
            setLocation(null);
            setStatusMsg('❌ GPS 定位失敗，藍牙簽到必須使用實際定位，請允許瀏覽器存取位置後重試');
          } else {
            setLocation({ lat: 25.0423, lng: 121.5255 });
            setStatusMsg('⚠️ GPS 定位失敗，使用既有模擬定位');
          }
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } else {
      setStatusMsg('❌ 此瀏覽器不支援 GPS 定位');
    }
  };

  const handleVerifyBluetooth = async () => {
    const expectedName = bluetoothBeaconName.trim();
    const expectedUuid = bluetoothServiceUuid.trim();
    if (!expectedName && !expectedUuid) {
      setStatusMsg('❌ 活動尚未設定藍牙設備名稱或 Service UUID');
      return;
    }
    if (!window.isSecureContext) {
      setStatusMsg('❌ 藍牙簽到需要 HTTPS 安全連線或 localhost');
      return;
    }
    const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth;
    if (!bluetooth) {
      setStatusMsg('❌ 此瀏覽器不支援 Web Bluetooth，請使用支援的 Chrome／Edge 瀏覽器');
      return;
    }
    setIsVerifyingBluetooth(true);
    setBluetoothProof(null);
    setStatusMsg('請在瀏覽器裝置選擇視窗選取活動指定的藍牙設備');
    let connectedServer: Awaited<ReturnType<NonNullable<BluetoothDeviceLike['gatt']>['connect']>> | null = null;
    try {
      const filter: BluetoothRequestFilter = {};
      if (expectedName) filter.name = expectedName;
      if (expectedUuid) filter.services = [expectedUuid];
      const device = await bluetooth.requestDevice({
        filters: [filter],
        optionalServices: expectedUuid ? [expectedUuid] : [],
      });
      if (expectedName && device.name !== expectedName) {
        throw new Error('選取的設備名稱與活動設定不符');
      }
      if (!device.gatt) throw new Error('此設備不支援 GATT 連線，請確認信標設備規格');
      connectedServer = await device.gatt.connect();
      if (expectedUuid) await connectedServer.getPrimaryService(expectedUuid);
      setBluetoothProof({
        deviceName: expectedName ? String(device.name || '') : '',
        serviceUuid: expectedUuid,
      });
      setStatusMsg(`✅ 藍牙設備驗證完成：${device.name || expectedUuid}`);
    } catch (error) {
      console.error('藍牙簽到驗證失敗:', error);
      setStatusMsg(`❌ 藍牙驗證失敗：${(error as Error).message || '請確認設備已開啟並重試'}`);
    } finally {
      connectedServer?.disconnect();
      setIsVerifyingBluetooth(false);
    }
  };

  const handleSubmit = () => {
    if (!location) { setStatusMsg('❌ 請先開啟 GPS'); return; }
    if (inputCode.length !== 6) { setStatusMsg('❌ 請輸入有效的 6 位簽到碼'); return; }
    if (bluetoothCheckInRequired && !bluetoothProof) { setStatusMsg('❌ 請先完成活動指定藍牙設備驗證'); return; }
    socket.emit('guest_check_in', {
      userId: user.studentId || user.id,
      eventId,
      inputCode,
      userLat: location.lat,
      userLng: location.lng,
      bluetoothDeviceName: bluetoothProof?.deviceName,
      bluetoothServiceUuid: bluetoothProof?.serviceUuid,
    });
  };

  const handleManualCheckIn = () => {
    if (!manualStudentId) { alert('請輸入學號'); return; }
    socket.emit('host_manual_check_in', { userId: manualStudentId, eventId });
  };

  const handleScan = (result: any) => {
    if (result && result[0]?.rawValue) { setInputCode(result[0].rawValue); setShowScanner(false); setStatusMsg(`📷 掃描成功`); }
  };

  if (checkInSuccess) return <ActivityPortfolio user={user} onBack={onBack} onViewDetail={onViewDetail} currentEventId={eventId} />;

  if (mode === 'host') {
    return (
      <div className="w-full max-w-md p-4 relative">
        {showMapPicker && <MapPicker onConfirm={handleUpdateLocation} onClose={() => setShowMapPicker(false)} />}
        
        <button onClick={onBack} className="mb-4 text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <ChevronLeft /> 返回列表
        </button>
        <EventDashboard eventId={eventId} />
        <div className="bg-white p-6 rounded-2xl shadow-xl text-center mt-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">活動簽到碼 (ID: {eventId})</h2>
          <div className={`mb-4 rounded-lg p-3 text-sm text-left ${bluetoothCheckInRequired ? 'bg-blue-50 text-blue-800' : 'bg-gray-50 text-gray-600'}`}>
            <label className="flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={bluetoothCheckInRequired}
                onChange={event => {
                  const enabled = event.target.checked;
                  setBluetoothCheckInRequired(enabled);
                  if (enabled && !bluetoothBeaconName && !bluetoothServiceUuid) setBluetoothBeaconName('UniPass-CheckIn');
                }}
                className="h-4 w-4"
              />
              簽到必須通過藍牙驗證
            </label>
            {bluetoothCheckInRequired && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">藍牙設備名稱</label>
                  <input value={bluetoothBeaconName} onChange={event => setBluetoothBeaconName(event.target.value)} className="w-full rounded-lg border p-2 text-sm" placeholder="預設 UniPass-CheckIn，可自行修改" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Bluetooth Service UUID (選填)</label>
                  <input value={bluetoothServiceUuid} onChange={event => setBluetoothServiceUuid(event.target.value)} className="w-full rounded-lg border p-2 text-sm" placeholder="確認信標規格後輸入 UUID" />
                </div>
                <p className="text-xs">儲存後，學生必須完成 GPS、簽到碼及此活動藍牙設備驗證。</p>
              </div>
            )}
            <button
              onClick={() => void handleSaveBluetoothSettings()}
              disabled={isSavingBluetoothSettings}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSavingBluetoothSettings ? '儲存中...' : '儲存簽到設定'}
            </button>
          </div>
          <div className="bg-white p-2 border-4 border-blue-100 rounded-xl mb-4 inline-block"><QRCode value={currentCode} size={180} /></div>
          <div className="text-3xl font-mono font-bold text-blue-600 tracking-widest mb-4">{currentCode}</div>
          <div className="mb-4 flex justify-center items-center gap-2 text-green-700 bg-green-50 py-2 rounded-lg font-bold"><CheckCircle size={20} /> 已簽到：{attendeeCount} 人</div>
          <button onClick={handleUpdateCode} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 mb-4 flex justify-center gap-2"><RefreshCw /> 手動更新</button>
          <button onClick={() => setShowMapPicker(true)} className="w-full bg-white border-2 border-blue-100 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-50 mb-4 flex justify-center gap-2"><MapIcon size={20} /> 設定簽到地點</button>
          <div className="text-xs text-gray-400 mb-4">目前地點: {eventLocation}</div>
          <div className="border-t pt-4">
            {!showManualInput ? (
              <button onClick={() => setShowManualInput(true)} className="text-gray-400 hover:text-blue-600 text-sm font-bold flex items-center justify-center gap-1 w-full"><Keyboard size={14} /> 人工補登</button>
            ) : (
              <div className="flex gap-2">
                <input type="text" placeholder="學號" value={manualStudentId} onChange={(e) => setManualStudentId(e.target.value)} className="flex-1 p-2 border rounded-lg text-center font-mono" />
                <button onClick={handleManualCheckIn} className="bg-green-600 text-white px-3 rounded-lg font-bold">確認</button>
                <button onClick={() => setShowManualInput(false)}><X className="text-gray-400" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-md p-4 relative">
      <button onClick={onBack} className="mb-4 text-gray-500 hover:text-gray-800 flex items-center gap-1"><ChevronLeft /> 返回列表</button>
      <div className="bg-white p-6 rounded-2xl shadow-xl relative">
        {showScanner && <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"><div className="w-full max-w-sm aspect-square bg-black relative"><Scanner onScan={handleScan} /><div className="absolute inset-0 border-4 border-blue-500/50 m-8 rounded-lg animate-pulse"></div></div><button onClick={() => setShowScanner(false)} className="mt-8 bg-white px-6 py-2 rounded-full font-bold flex gap-2"><X /> 關閉</button></div>}
        <div className="space-y-4">
          <button onClick={handleGetGPS} className={`w-full py-3 rounded-xl border-2 flex justify-center gap-2 font-bold ${location ? 'border-green-500 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500'}`}><MapPin /> {location ? '定位完成' : '點擊取得位置'}</button>
          {bluetoothCheckInRequired && (
            <button
              onClick={() => void handleVerifyBluetooth()}
              disabled={isVerifyingBluetooth}
              className={`w-full py-3 rounded-xl border-2 flex justify-center gap-2 font-bold disabled:opacity-60 ${bluetoothProof ? 'border-green-500 text-green-700 bg-green-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}
            >
              <Bluetooth /> {isVerifyingBluetooth ? '正在驗證藍牙設備...' : bluetoothProof ? '藍牙設備驗證完成' : '連線驗證活動藍牙設備'}
            </button>
          )}
          <div className="flex gap-2">
            <input type="text" maxLength={6} placeholder="輸入驗證碼" value={inputCode} onChange={(e) => setInputCode(e.target.value)} className="flex-1 text-center text-xl font-mono border-2 rounded-xl py-2 tracking-widest" />
            <button onClick={() => setShowScanner(true)} className="bg-blue-600 text-white p-3 rounded-xl"><Camera /></button>
          </div>
          <button onClick={handleSubmit} disabled={!location || inputCode.length !== 6 || isVerifyingBluetooth || (bluetoothCheckInRequired && !bluetoothProof)} className="w-full bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold flex justify-center gap-2"><CheckCircle /> 簽到</button>
          {statusMsg && <div className="text-center p-2 bg-gray-100 rounded-lg text-sm font-bold">{statusMsg}</div>}
        </div>
      </div>
    </div>
  );
}

// --- ActivityPortfolio (履歷元件) ---
function ActivityPortfolio({ user, onBack, onViewDetail, currentEventId }: { user: any, onBack: () => void, onViewDetail: (id: number) => void, currentEventId?: number }) {
  const staticHistory = [
    { id: 101, title: '北商大高中生資訊體驗營', date: '2024-07-15', registered: true, checkedIn: true },
    { id: 102, title: '114學年度五專優先免試入學', date: '2025-05-20', registered: true, checkedIn: true },
    { id: 103, title: '114學年度新生入學輔導', date: '2025-09-05', registered: true, checkedIn: true },
  ];
  const [dynamicHistory, setDynamicHistory] = useState<any[]>([]);
  const currentStudentId = String(user.studentId || user.id || '').trim();
  useEffect(() => {
    socket.emit('fetch_all_events');
    socket.on('all_events_data', (data: { events: any[] }) => {
      socket.emit('get_user_registrations', { studentId: currentStudentId });
      socket.once('user_registrations_sync', (regData: { registrationMap: Record<number, { registered: boolean, checkedIn: boolean }> }) => {
        const myEvents = data.events.filter(e => regData.registrationMap[e.id]?.checkedIn).map(e => ({
          id: e.id,
          title: e.title,
          date: e.eventDate.split(' ')[0],
          registered: true,
          checkedIn: true
        }));
        setDynamicHistory(myEvents);
      });
    });
    return () => { socket.off('all_events_data'); socket.off('user_registrations_sync'); };
  }, [user.id]);
  
  const fullHistory = [...staticHistory, ...dynamicHistory];
  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-900 p-6 text-white relative overflow-hidden"><h2 className="text-2xl font-bold relative z-10">活動歷程檔案</h2><p className="text-blue-200 text-sm relative z-10">數據資產延續性：{user.name} 的完整學習軌跡</p></div>
        <div className="p-6 bg-slate-50 min-h-[400px]">
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {fullHistory.map((item) => (
              <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${item.id === currentEventId ? 'bg-blue-600 animate-pulse' : 'bg-green-500'} z-10`}>
                  <CheckCircle size={18} className="text-white" />
                </div>
                <div onClick={() => onViewDetail(item.id)} className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl shadow-sm border ${item.id === currentEventId ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} hover:shadow-md transition-all cursor-pointer`}>
                  <div className="flex items-center justify-between mb-1"><span className="font-bold text-slate-900">{item.title}</span></div>
                  <div className="text-xs text-slate-500 mb-2 flex items-center gap-2"><Calendar size={12} /> {item.date}</div>
                  <div className="text-sm font-bold text-blue-600">已簽到</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-white border-t border-gray-100"><button onClick={onBack} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">返回上一頁</button></div>
      </div>
    </div>
  );
}

// --- ActivityDetail ---
function ActivityDetail({ activity, onBack, onRegister, isRegistering, user, registrationSuccess = false }: { activity: Activity, onBack: () => void, onRegister: () => void, isRegistering?: boolean, user?: any, registrationSuccess?: boolean }) {
  const [ratingScore, setRatingScore] = useState(0);
  const submitRating = async (score: number) => {
    if (!user) return;
    setRatingScore(score); 
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${activity.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          studentId: user.studentId || user.id,
          rating: score 
        })
      });
      if (response.ok) alert('感謝您的評分！數據已即時傳送至主辦方戰情室。');
    } catch (error) {
      console.error('評分失敗', error);
    }
  };

  if (activity.id > 100) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 bg-white min-h-screen animate-fade-in"><button onClick={onBack} className="bg-pink-500 text-white px-4 py-1.5 rounded text-sm font-bold mb-6 hover:bg-pink-600">上一頁</button><h1 className="text-3xl font-bold text-red-600 mb-8 text-center">{activity.title}</h1><div className="space-y-6 text-gray-700"><div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><FileText size={20} /> 活動內容：</h3><div className="pl-7 text-gray-600">歷史活動存檔資料...</div></div><div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><Calendar size={20} /> 活動時間：</h3><div className="pl-7 text-gray-600">{activity.dateRange}</div></div></div><div className="text-center mt-10 mb-10"><button disabled className="px-10 py-3 bg-gray-300 text-gray-500 rounded font-bold text-lg">活動已結束</button></div></div>
    );
  }
  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-white min-h-screen animate-fade-in">
      <button onClick={onBack} className="bg-pink-500 text-white px-4 py-1.5 rounded text-sm font-bold mb-6 hover:bg-pink-600">上一頁</button>
      <h1 className="text-3xl font-bold text-red-600 mb-8 text-center">{activity.title}</h1>
      <div className="space-y-6 text-gray-700">
        <div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><FileText size={20} /> 活動內容：</h3><div className="pl-7 text-gray-600 leading-relaxed">{activity.description}</div></div>
        <div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><Calendar size={20} /> 報名時間：</h3><div className="pl-7 text-gray-600">{activity.regRange}</div></div>
        <div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><Clock size={20} /> 活動時間：</h3><div className="pl-7 text-gray-600">{activity.dateRange}</div></div>
        <div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><MapPin size={20} /> 活動地點：</h3><div className="pl-7 text-gray-600">{activity.location}</div></div>
        <div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><Users size={20} /> 報名人數上限：</h3><div className="pl-7 text-gray-600">{activity.capacity} 人 目前已有 {activity.currentReg} 人報名</div></div>
        <div><h3 className="font-bold flex items-center gap-2 mb-2 text-black"><User size={20} /> 報名對象：</h3><div className="pl-7 text-gray-600">{activity.target}</div></div>
      </div>
      
      <div className="flex items-start mt-6">
        <div className="flex-shrink-0 mt-1">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div className="ml-3 w-full">
          <h3 className="text-sm font-medium text-gray-900">報名費用：</h3>
          <div className="mt-1 text-sm text-red-600 font-bold">NT$ {activity.fee ?? 500}</div>
        </div>
      </div>
      {registrationSuccess && (
        <div className="my-6 flex justify-center">
          <div className="w-full max-w-md rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center font-bold text-green-700 shadow-sm" role="status">
            <CheckCircle size={22} className="mr-2 inline-block" />
            您已報名成功
          </div>
        </div>
      )}
      
      <div className="border-t border-gray-200 my-8 pt-6">
        <h4 className="font-bold text-gray-500 mb-4 flex items-center gap-2 text-sm"><House size={16} /> 聯絡資訊</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 pl-2">
          <div className="flex gap-2"><span className="font-bold">主辦單位：</span>{activity.organizer}</div>
          <div className="flex gap-2"><span className="font-bold">聯絡人：</span>{activity.contactPerson}</div>
          <div className="flex gap-2"><span className="font-bold">聯絡電話：</span>{activity.contactPhone}</div>
          <div className="flex gap-2"><span className="font-bold">E-mail：</span><a href={`mailto:${activity.contactEmail}`} className="text-blue-500 hover:underline">{activity.contactEmail}</a></div>
        </div>
      </div>
      
      <div className="text-center mt-10 mb-10">
        {activity.registered ? (
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 inline-block min-w-[300px]">
            <h3 className="font-bold text-gray-700 mb-2">您對這場活動滿意嗎？</h3>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star}
                  onClick={() => submitRating(star)} 
                  className={`transition-colors ${ratingScore >= star ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
                >
                  <Star size={32} fill="currentColor" />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">點擊星星為活動評分</p>
          </div>
        ) : activity.status === 'open' ? (
          <button onClick={onRegister} disabled={isRegistering} className="px-10 py-3 bg-blue-600 disabled:bg-gray-400 text-white rounded font-bold hover:bg-blue-700 text-lg shadow-lg">
            {isRegistering ? (activity.fee === 0 ? '報名處理中...' : '建立付款訂單中...') : (activity.fee === 0 ? '我要免費報名' : '我要報名並繳費')}
          </button>
        ) : (
          <button disabled className="px-10 py-3 bg-gray-300 text-gray-500 rounded font-bold text-lg">活動已結束</button>
        )}
      </div>
    </div>
  );
}

// --- 評分與評論彈跳視窗 ---
function RatingModal({ eventId, user, onClose }: { eventId: number, user: any, onClose: () => void }) {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (score === 0) { alert('請至少給予一顆星！'); return; }
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user.id, rating: score, feedback })
      });
      
      if (response.ok) {
        alert('感謝您的評分與回饋！');
        onClose();
      } else {
        const errorData = await response.json();
        alert(`❌ 評分失敗：${errorData.error}`);
      }
    } catch (error) {
      console.error(error); alert('連線失敗，請檢查網路狀態');
    }
    setIsSubmitting(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in">
        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">活動評分與回饋</h2>
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setScore(s)} className={`transition-colors ${score >= s ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>
              <Star size={36} fill="currentColor" />
            </button>
          ))}
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="有什麼想對主辦方說的嗎？(選填)"
          className="w-full border border-gray-300 rounded-xl p-3 mb-4 h-24 resize-none focus:outline-none focus:border-amber-400"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">取消</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:bg-gray-400 flex justify-center items-center gap-2">送出評分</button>
        </div>
      </div>
    </div>
  );
}

// --- ActivityPlatform (主介面) ---
function ActivityPlatform({ user, onBack, initialEventId, registrationSuccessEventId }: { user: any, onBack: () => void, initialEventId?: number, registrationSuccessEventId?: number }) {
  const [activeTab, setActiveTab] = useState<'market' | 'my_events'>('market');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Record<number, { registered: boolean, checkedIn: boolean }>>({});
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [portfolioEventId, setPortfolioEventId] = useState<number | null>(null);
  const [viewingEventId, setViewingEventId] = useState<number | null>(initialEventId ?? null);
  const [localRegistrationSuccessEventId, setLocalRegistrationSuccessEventId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [managingActivity, setManagingActivity] = useState<Activity | null>(null);
  const [mode, setMode] = useState<'host' | 'guest'>('guest');
  const [isRegistering, setIsRegistering] = useState(false);
  const [ratingEventId, setRatingEventId] = useState<number | null>(null);
  const currentStudentId = String(user.studentId || user.id || '').trim();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrganizer, setFilterOrganizer] = useState('主辦單位');
  const [filterTarget, setFilterTarget] = useState('對象');
  const [filterCategory, setFilterCategory] = useState('類別');
  const [filterCampus, setFilterCampus] = useState('校區');
  
  const assignMetadata = (e: any) => {
    let organizer = '資訊管理系';
    let campus = '臺北校區';
    let category = '研習活動';
    let target = '學生';
    if (e.title.includes('歌唱')) { organizer = '學生事務處/課外活動組'; category = '藝文活動'; }
    else if (e.title.includes('志工')) { organizer = '桃園校區學務處生輔組'; campus = '桃園校區'; category = '服務學習'; }
    else if (e.title.includes('AI')) { organizer = '通識教育中心'; category = '工作坊/研習營'; target = '教職'; }
    else if (e.title.includes('專題')) { organizer = '資訊管理系'; category = '成果展'; target = '全部'; }
    return { organizer, campus, category, target };
  };

  useEffect(() => {
    socket.emit('fetch_all_events');
    socket.on('all_events_data', (data: { events: any[] }) => {
      const mapped = data.events.map(e => {
        const meta = assignMetadata(e);
        return {
          id: e.id,
          title: e.title,
          organizer: e.organizer || meta.organizer,
          contactPerson: e.contactPerson || '陳助教',
          contactPhone: e.contactPhone || '02-23226321',
          contactEmail: e.contactEmail || 'imd@ntub.edu.tw',
          description: e.description,
          dateRange: e.eventDate,
          regRange: e.registrationStart && e.registrationEnd
            ? `${String(e.registrationStart).replace('T', ' ')} ~ ${String(e.registrationEnd).replace('T', ' ')}`
            : '即日起',
          registrationStart: e.registrationStart || '',
          registrationEnd: e.registrationEnd || '',
          campus: e.campus || meta.campus,
          location: e.locationName || '校園內',
          locationLat: e.locationLat,
          locationLng: e.locationLng,
          bluetoothCheckInRequired: Boolean(e.bluetoothCheckInRequired),
          bluetoothBeaconName: e.bluetoothBeaconName,
          bluetoothServiceUuid: e.bluetoothServiceUuid,
          category: e.category || meta.category,
          target: e.target || meta.target,
          capacity: Number(e.capacity ?? 50),
          currentReg: Number(e.currentReg ?? 0),
          fee: Number(e.fee ?? 500),
          status: 'open' as const,
          registered: false,
          checkedIn: false
        };
      });
      setActivities(mapped);
      socket.emit('get_user_registrations', { studentId: currentStudentId });
    });
    socket.on('user_registrations_sync', (data: { registrationMap: Record<number, { registered: boolean, checkedIn: boolean }> }) => {
      setRegistrations(data.registrationMap);
    });
    socket.on('force_refresh_registrations', (data: { studentId: string, eventId: number }) => {
      if (data.studentId === currentStudentId) {
        socket.emit('get_user_registrations', { studentId: currentStudentId });
        alert('🔔 系統通知：主辦方已協助您完成報名/簽到！');
        setActiveTab('my_events');
        setViewingEventId(data.eventId);
      }
    });
    return () => {
      socket.off('all_events_data');
      socket.off('user_registrations_sync');
      socket.off('force_refresh_registrations');
    };
  }, [user.id]);

  const mergedActivities = activities.map(act => ({
    ...act,
    registered: registrations[act.id]?.registered || false,
    checkedIn: registrations[act.id]?.checkedIn || false
  }));

  const organizerFilterOptions = [...new Set([
    ...ORGANIZERS.filter(option => option !== '全部'),
    ...mergedActivities.map(activity => activity.organizer).filter(value => value && value !== '全部'),
  ])];
  const targetFilterOptions = [...new Set([
    ...TARGETS.filter(option => option !== '全部'),
    ...mergedActivities.map(activity => activity.target).filter(value => value && value !== '全部'),
  ])];
  const categoryFilterOptions = [...new Set([
    ...CATEGORIES.filter(option => option !== '全部'),
    ...mergedActivities.map(activity => activity.category).filter(value => value && value !== '全部'),
  ])];

  const filteredActivities = mergedActivities.filter(act => {
    const matchSearch = act.title.includes(searchTerm);
    const matchOrg = filterOrganizer === '主辦單位' || filterOrganizer === '全部' || act.organizer === filterOrganizer;
    const matchTarget = filterTarget === '對象' || filterTarget === '全部' || act.target === filterTarget || act.target === '全部';
    const matchCat = filterCategory === '類別' || filterCategory === '全部' || act.category === filterCategory;
    const matchCampus = filterCampus === '校區' || filterCampus === '全部' || act.campus === filterCampus;
    return matchSearch && matchOrg && matchTarget && matchCat && matchCampus;
  });

  const handleDeleteActivity = async (activity: Activity) => {
    if (!window.confirm(`確定要從活動首頁刪除「${activity.title}」嗎？活動和報名紀錄會保留，但不再顯示於首頁。`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${activity.id}`, {
        method: 'DELETE',
        headers: roleRequestHeaders(user.role),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '刪除活動失敗');
      socket.emit('fetch_all_events');
      alert('活動已從首頁移除，原有活動及報名資料已保留。');
    } catch (error) {
      console.error('刪除活動失敗:', error);
      alert(`刪除活動失敗：${(error as Error).message || '請稍後再試'}`);
    }
  };

  const handleRegister = async () => {
    if (!viewingEventId || isRegistering) return;
    const activity = mergedActivities.find((item) => item.id === viewingEventId);
    if (!activity) { alert('找不到活動資料，請重新整理後再試'); return; }
    const fee = activity.fee ?? 0;
    const confirmation = fee === 0
      ? `確定要免費報名「${activity.title}」嗎？`
      : `確定要報名「${activity.title}」並前往繳費嗎？\n報名費：NT$ ${fee}`;
    if (!window.confirm(confirmation)) { return; }
    setIsRegistering(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activity.id,
          amount: activity.fee ?? 500,
          studentId: currentStudentId,
          email: String(user.email || `${user.id}@ntub.edu.tw`),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) { throw new Error(payload.message || '建立報名失敗'); }
      if (payload.free) {
        setRegistrations(previous => ({
          ...previous,
          [activity.id]: { registered: true, checkedIn: false },
        }));
        setLocalRegistrationSuccessEventId(activity.id);
        setIsRegistering(false);
        return;
      }
      if (!payload.data) { throw new Error(payload.message || '建立付款訂單失敗'); }
      const paymentForm = document.createElement('form');
      paymentForm.method = 'POST';
      paymentForm.action = payload.data.action || 'https://ccore.newebpay.com/MPG/mpg_gateway';
      paymentForm.style.display = 'none';
      const fields: Record<string, unknown> = { MerchantID: payload.data.MerchantID, TradeInfo: payload.data.TradeInfo, TradeSha: payload.data.TradeSha, Version: payload.data.Version || '2.0' };
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value ?? '');
        paymentForm.appendChild(input);
      });
      document.body.appendChild(paymentForm);
      paymentForm.submit();
    } catch (error) {
      console.error('前往藍新付款失敗:', error);
      alert(`無法前往繳費頁面：${(error as Error).message || '請稍後再試'}`);
      setIsRegistering(false);
    }
  };

  if (selectedEventId) return <CheckInCore onBack={() => setSelectedEventId(null)} user={user} eventId={selectedEventId} onViewDetail={(id) => setViewingEventId(id)} mode={mode} />;
  if (portfolioEventId !== null) {
    return (
      <ActivityPortfolio
        user={user}
        currentEventId={portfolioEventId}
        onBack={() => setPortfolioEventId(null)}
        onViewDetail={(id) => {
          setPortfolioEventId(null);
          setViewingEventId(id);
        }}
      />
    );
  }
  if (viewingEventId) {
    const activity = mergedActivities.find(a => a.id === viewingEventId) || { id: viewingEventId, title: '歷史活動', description: '...', dateRange: '...', organizer: '...', registered: true } as Activity;
    return <ActivityDetail
      activity={activity}
      onBack={() => setViewingEventId(null)}
      onRegister={handleRegister}
      isRegistering={isRegistering}
      user={user}
      registrationSuccess={registrationSuccessEventId === viewingEventId || localRegistrationSuccessEventId === viewingEventId}
    />;
  }
  
  return (
    <div className="w-full max-w-6xl min-h-screen bg-white flex flex-col relative">
      {showCreateModal && <CreateEventModal onClose={() => setShowCreateModal(false)} role={user.role} />}
      {editingActivity && <CreateEventModal activity={editingActivity} onClose={() => setEditingActivity(null)} role={user.role} />}
      {managingActivity && <EventRegistrationsModal activity={managingActivity} role={user.role} onClose={() => setManagingActivity(null)} onChanged={() => socket.emit('fetch_all_events')} />}
      
      {ratingEventId && <RatingModal eventId={ratingEventId} user={user} onClose={() => setRatingEventId(null)} />}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-200"><button onClick={onBack} className="text-gray-500 hover:text-gray-800"><ChevronLeft /></button><div className="flex gap-4"><button onClick={() => setActiveTab('market')} className={`px-4 py-2 font-bold transition-colors ${activeTab === 'market' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>活動首頁</button><button onClick={() => setActiveTab('my_events')} className={`px-4 py-2 font-bold transition-colors ${activeTab === 'my_events' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>我的活動</button></div><div className="w-6"></div></div>
      <div className="p-6">
        {activeTab === 'market' ? (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-700 border-l-4 border-gray-400 pl-2">活動查詢條件</h2>
              {user.role === '教師' && (
                <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                  <PlusCircle size={18} /> 新增活動
                </button>
              )}
            </div>
            <div className="border-t border-gray-200 mb-6"></div>
            <div className="flex flex-wrap items-center gap-3 mb-6"><div className="flex"><input type="text" placeholder="搜尋活動" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border border-gray-300 rounded-l px-3 py-1.5 focus:outline-none focus:border-blue-400 text-sm w-48" /><button className="bg-blue-500 text-white px-3 py-1.5 rounded-r hover:bg-blue-600"><Search size={16} /></button></div><select value={filterOrganizer} onChange={(e) => setFilterOrganizer(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"><option>主辦單位</option><option value="全部">全部</option>{organizerFilterOptions.map(org => <option key={org} value={org}>{org}</option>)}</select><select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"><option>對象</option><option value="全部">全部</option>{targetFilterOptions.map(t => <option key={t} value={t}>{t}</option>)}</select><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"><option>類別</option><option value="全部">全部</option>{categoryFilterOptions.map(c => <option key={c} value={c}>{c}</option>)}</select><select value={filterCampus} onChange={(e) => setFilterCampus(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600 bg-white"><option>校區</option>{CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="overflow-x-auto border border-gray-200 rounded-t-md">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-1/3">活動名稱</th><th className="px-4 py-3">舉辦校區</th><th className="px-4 py-3">活動起迄日</th><th className="px-4 py-3">主辦單位</th><th className="px-4 py-3">報名起迄日</th><th className="px-4 py-3">對象</th><th className="px-4 py-3 text-center">我要報名</th>
                    {user.role === '教師' && <th className="px-4 py-3 text-center">活動管理</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map(act => (
                    <tr key={act.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setViewingEventId(act.id)}>{act.title}</td>
                      <td className="px-4 py-4">{act.campus}</td><td className="px-4 py-4">{act.dateRange.split(' ')[0]}</td><td className="px-4 py-4">{act.organizer}</td><td className="px-4 py-4">{act.regRange}</td><td className="px-4 py-4">{act.target}</td>
                      <td className="px-4 py-4 text-center">{act.registered ? <span className="text-gray-400">已報名</span> : act.status === 'open' ? <button onClick={() => setViewingEventId(act.id)} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs">詳情</button> : <span className="text-red-400">截止</span>}</td>
                      {user.role === '教師' && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-center gap-2">
                            <button onClick={() => setEditingActivity(act)} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-100 flex items-center gap-1"><Pencil size={12} />編輯</button>
                            <button onClick={() => setManagingActivity(act)} className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold hover:bg-purple-100 flex items-center gap-1"><Users size={12} />報名名單</button>
                            <button onClick={() => void handleDeleteActivity(act)} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold hover:bg-red-100 flex items-center gap-1"><Trash2 size={12} />刪除</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredActivities.length === 0 && <div className="text-center py-8 text-gray-400">暫無符合條件的活動</div>}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in"><h2 className="text-lg font-bold text-gray-700 mb-2 border-l-4 border-gray-400 pl-2">我的活動</h2><div className="border-t border-gray-200 mb-6"></div><div className="overflow-x-auto border border-gray-200 rounded-t-md"><table className="w-full text-sm text-left text-gray-600"><thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 w-1/2">活動名稱</th><th className="px-4 py-3 text-center">活動起迄日</th><th className="px-4 py-3 text-center">活動管理</th></tr></thead><tbody>{mergedActivities.filter(a => a.registered).length === 0 ? (<tr><td colSpan={3} className="text-center py-8 text-gray-400">尚無報名活動</td></tr>) : (mergedActivities.filter(a => a.registered).map(act => (<tr key={act.id} className="bg-white border-b hover:bg-gray-50"><td className="px-4 py-4 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setViewingEventId(act.id)}>{act.title}</td><td className="px-4 py-4 text-center">{act.dateRange.split(' ')[0]}</td>
          
          <td className="px-4 py-4 text-center">
            {user.role === '教師' ? (
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setSelectedEventId(act.id); setMode('host'); }} className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs flex items-center gap-1"><Settings size={12} /> 管理</button>
                <button onClick={() => { setSelectedEventId(act.id); setMode('guest'); }} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs flex items-center gap-1"><QrCode size={12} /> 簽到</button>
              </div>
            ) : (
              <div className="flex gap-2 justify-center">
                {act.checkedIn ? (
                  <span className="text-green-700 px-3 py-1 text-xs font-bold flex items-center gap-1"><BadgeCheck size={12} /> 已簽到</span>
                ) : (
                  <button onClick={() => { setSelectedEventId(act.id); setMode('guest'); }} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs flex items-center gap-1"><QrCode size={12} /> 簽到</button>
                )}
                {act.checkedIn && (
                  <button onClick={() => setPortfolioEventId(act.id)} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs flex items-center gap-1"><FileText size={12} /> 履歷</button>
                )}
                <button onClick={() => setRatingEventId(act.id)} className="bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 text-xs flex items-center gap-1"><Star size={12} /> 評分</button>
              </div>
            )}
          </td>
          </tr>)))}</tbody></table></div></div>
        )}
      </div>
    </div>
  );
}

// --- 登入畫面 ---
function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [activeTab, setActiveTab] = useState<'student' | 'applicant' | 'teacher' | 'guest'>('student');
  const [inputId, setInputId] = useState('');
  const [inputPwd, setInputPwd] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  useEffect(() => {
    if (activeTab === 'teacher') {
      setInputId('T98765');
      setInputPwd('********');
    } else if (activeTab === 'student') {
      setInputId('115507');
      setInputPwd('********');
    } else if (activeTab === 'applicant') {
      setInputId('A123456789');
      setInputPwd('********');
    } else if (activeTab === 'guest') {
      setInputId('GUEST001');
      setInputPwd('');
    }
  }, [activeTab]);

  const handleNormalLogin = async () => {
    if (activeTab === 'guest') {
      onLogin({ id: 'GUEST001', studentId: 'GUEST001', email: 'guest@ntub.edu.tw', name: '校園訪客', role: '訪客' });
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: inputId, password: inputPwd })
      });
      const result = await response.json();
      if (result.success && result.data) {
        onLogin(result.data);
      } else {
        alert(`❌ 登入失敗：${result.error || '帳號或密碼錯誤'}`);
      }
    } catch (error) {
      console.error('API 登入發生錯誤:', error);
      alert('❌ 無法連線到後端伺服器！請確認後端登入 API 是否已經啟動。');
    }
  };

  const handleGoogleLoginSuccess = (profile: { id: number; studentId: string; email: string; name: string }) => {
    onLogin({ ...profile, role: '資管系學生', authType: 'google' });
  };
  const handleGoogleLoginError = () => {
    alert('❌ Google 登入失敗');
  };

  return (
    <>
      {showForgotPasswordModal && <ForgotPasswordModal onClose={() => setShowForgotPasswordModal(false)} />}
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
          <div className="text-center mb-8">
            <div className="bg-blue-900 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><School size={32} /></div>
            <h1 className="text-3xl font-extrabold text-blue-900">UniPass</h1>
            <p className="text-gray-400">Unified ID 單一識別系統</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeTab === 'teacher' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400'}`}>教職員</button>
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeTab === 'student' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-400'}`}>在校生</button>
            <button onClick={() => setActiveTab('applicant')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeTab === 'applicant' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}>考生</button>
            <button onClick={() => setActiveTab('guest')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeTab === 'guest' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>訪客</button>
          </div>
          <div className="space-y-4 mb-6">
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input type="text" value={inputId} onChange={(e) => setInputId(e.target.value)} className="w-full bg-gray-50 border p-3 pl-12 rounded-xl" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input type="password" value={inputPwd} onChange={(e) => setInputPwd(e.target.value)} placeholder={activeTab === 'guest' ? '免密碼' : ''} className="w-full bg-gray-50 border p-3 pl-12 rounded-xl" />
            </div>
          </div>
          <button onClick={handleNormalLogin} className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold shadow-lg hover:bg-blue-800 transition-all">
            <LogIn className="inline mr-2" /> 登入系統
          </button>
          <div className="flex items-center my-6">
            <div className="flex-grow border-t"></div>
            <span className="mx-4 text-gray-400 text-sm">第三方登入</span>
            <div className="flex-grow border-t"></div>
          </div>
          <div className="w-full flex justify-center">
            <GoogleSignInButton onSuccess={handleGoogleLoginSuccess} onError={handleGoogleLoginError} />
          </div>
          <div className="mt-4 text-center">
            <button onClick={() => setShowForgotPasswordModal(true)} className="text-blue-600 hover:text-blue-800 font-bold text-sm transition-colors hover:underline">
              忘記密碼？
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- 付款結果頁面 ---
function PaymentResultPage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') === 'success' ? 'success' : 'failed';
  const orderNo = params.get('orderNo') || '';
  const message = params.get('message') || (status === 'success' ? '付款成功，報名資料已更新。' : '付款未完成，請重新操作。');
  const eventId = Number(params.get('eventId'));
  const studentId = params.get('studentId') || '';

  if (status === 'success' && Number.isInteger(eventId) && eventId > 0 && studentId) {
    const user = {
      id: studentId,
      studentId,
      email: `${studentId}@ntub.edu.tw`,
      name: studentId,
      role: '資管系學生',
    };
    return (
      <div className="min-h-screen flex justify-center bg-gray-100">
        <ActivityPlatform
          user={user}
          onBack={() => { window.location.href = '/'; }}
          initialEventId={eventId}
          registrationSuccessEventId={eventId}
        />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl p-8 text-center">
        <div className={`mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center ${status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {status === 'success' ? <CheckCircle size={36} /> : <X size={36} />}
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">{status === 'success' ? '付款完成' : '付款未完成'}</h1>
        <p className="text-gray-600 leading-relaxed mb-4">{message}</p>
        {orderNo && <p className="text-xs text-gray-400 mb-6">訂單編號：{orderNo}</p>}
        <button onClick={() => { window.location.href = '/'; }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">返回 UniPass</button>
      </div>
    </div>
  );
}

// --- App 核心入口 ---
export default function App() {
  const isPaymentResult = window.location.pathname === '/payment/success';
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentApp, setCurrentApp] = useState<'portal' | 'admissions' | 'events' | 'profile' | 'students'>('portal');

  if (isPaymentResult) return <PaymentResultPage />;
  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;

  // 👉 這行就是切換到「招生系統」的入口！
  if (currentApp === 'admissions') return <div className="min-h-screen flex justify-center bg-gray-100"><AdmissionApp onBack={() => setCurrentApp('portal')} user={currentUser} /></div>;
  
  if (currentApp === 'events') return <div className="min-h-screen flex justify-center bg-gray-100"><ActivityPlatform onBack={() => setCurrentApp('portal')} user={currentUser} /></div>;
  
  if (currentApp === 'profile') {
    return (
      <div className="min-h-screen bg-slate-50 relative p-6">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm p-4 flex justify-between items-center z-10 px-6">
          <div className="flex items-center gap-2 font-bold text-blue-900 cursor-pointer" onClick={() => setCurrentApp('portal')}>
            <School size={24} /> UniPass
          </div>
          <button onClick={() => setCurrentUser(null)} className="text-gray-400 hover:text-red-500"><LogOut size={20} /></button>
        </div>
        <div className="pt-20 max-w-4xl mx-auto">
          <button onClick={() => setCurrentApp('portal')} className="mb-4 text-gray-500 hover:text-gray-800 flex items-center gap-1 font-bold">
            <ChevronLeft /> 返回首頁
          </button>
         <UserProfile currentUser={currentUser} />
        </div>
      </div>
    );
  }

  if (currentApp === 'students') {
    return (
      <div className="min-h-screen bg-slate-50 relative p-6 pt-24">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm p-4 flex justify-between items-center z-10 px-6">
          <div className="flex items-center gap-2 font-bold text-blue-900 cursor-pointer" onClick={() => setCurrentApp('portal')}><School size={24} /> UniPass</div>
          <button onClick={() => setCurrentUser(null)} className="text-gray-400 hover:text-red-500"><LogOut size={20} /></button>
        </div>
        <StudentManagement currentUser={currentUser} onBack={() => setCurrentApp('portal')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm p-4 flex justify-between items-center z-10 px-6">
        <div className="flex items-center gap-2 font-bold text-blue-900"><School size={24} /> UniPass</div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentApp('profile')}
            className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors cursor-pointer"
          >
            <User size={16} /> 
            <span>{currentUser.name} ({currentUser.role})</span>
          </button>
          <button onClick={() => setCurrentUser(null)} className="text-gray-400 hover:text-red-500"><LogOut size={20} /></button>
        </div>
      </div>
      
      <div className="text-center mb-12 mt-16"><h1 className="text-3xl font-extrabold text-blue-900 mb-2">早安，{currentUser.name}</h1><p className="text-gray-500">請選擇服務</p></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <button onClick={() => setCurrentApp('admissions')} className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-orange-400 flex flex-col justify-between h-64 overflow-hidden relative">
          <GraduationCap size={150} className="text-orange-500 absolute top-0 right-0 opacity-10 group-hover:scale-110 transition-transform" />
          <div><div className="bg-orange-100 text-orange-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6"><GraduationCap size={28} /></div><h2 className="text-2xl font-bold text-gray-800">招生入學</h2><p className="text-gray-500 mt-2">{currentUser.role === '考生' ? '查看報名進度與榜單' : '查看歷年入學資料'}</p></div>
          <div className="text-orange-600 font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">進入系統 <ArrowRight size={20} /></div>
        </button>
        <button onClick={() => setCurrentApp('events')} className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-blue-500 flex flex-col justify-between h-64 overflow-hidden relative">
          <Calendar size={150} className="text-blue-600 absolute top-0 right-0 opacity-10 group-hover:scale-110 transition-transform" />
          <div><div className="bg-blue-100 text-blue-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6"><QrCode size={28} /></div><h2 className="text-2xl font-bold text-gray-800">校園活動</h2><p className="text-gray-500 mt-2">{currentUser.role === '考生' ? '校園參觀與活動體驗' : '活動報名與簽到管理'}</p></div>
          <div className="text-blue-600 font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">進入系統 <ArrowRight size={20} /></div>
        </button>
        {currentUser.role === '教師' && (
          <button onClick={() => setCurrentApp('students')} className="group bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-purple-400 flex flex-col justify-between h-64 overflow-hidden relative md:col-span-2">
            <Users size={150} className="text-purple-500 absolute top-0 right-0 opacity-10 group-hover:scale-110 transition-transform" />
            <div>
              <div className="bg-purple-100 text-purple-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6"><Users size={28} /></div>
              <h2 className="text-2xl font-bold text-gray-800">學生管理系統</h2>
              <p className="text-gray-500 mt-2">查詢與修改全校學生的基本資料、權限與聯絡方式</p>
            </div>
            <div className="text-purple-600 font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform">進入管理 <ArrowRight size={20} /></div>
          </button>
        )}
      </div> 
      
      <div className="w-full max-w-4xl mt-12 mx-auto mb-10">
        <RecommendationDashboard studentId={1} />
      </div>
    </div>
  );
}