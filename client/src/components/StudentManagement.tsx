import { useState, useEffect } from 'react';
import { UserProfile } from './UserProfile';
import { ChevronLeft } from 'lucide-react';

export const StudentManagement = ({ currentUser, onBack }: { currentUser: any, onBack: () => void }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  // 👉 1. 將撈取資料的邏輯獨立成一個函數
  const fetchUsers = () => {
    fetch('http://localhost:3000/api/admin/users')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // 過濾掉老師自己，只顯示學生
          setUsers(data.data.filter((u: any) => u.role !== '教師' && u.role !== 'admin'));
        }
      })
      .catch(err => console.error(err));
  };

  // 👉 2. 當元件載入，或 editingStudent 變成 null (退回列表) 時，自動重新抓取資料
  useEffect(() => {
    if (!editingStudent) {
      fetchUsers();
    }
  }, [editingStudent]);

  // 如果選擇了某個學生，就顯示編輯個人資料的畫面
  if (editingStudent) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <button onClick={() => setEditingStudent(null)} className="mb-4 flex items-center text-gray-500 hover:text-gray-800 font-bold gap-1">
          <ChevronLeft /> 返回學生列表
        </button>
        {/* 把登入的老師 (currentUser) 和被選中的學生 (targetUser) 同時傳入 */}
        <UserProfile currentUser={currentUser} targetUser={editingStudent} />
      </div>
    );
  }

  // 預設顯示學生列表表格
  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-8 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800">學生資料管理系統</h2>
        <button onClick={onBack} className="flex items-center text-gray-500 hover:text-gray-800 font-bold gap-1 bg-gray-100 px-4 py-2 rounded-lg">
          <ChevronLeft /> 離開系統
        </button>
      </div>
      
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-bold text-gray-600">ID</th>
              <th className="p-4 font-bold text-gray-600">姓名</th>
              <th className="p-4 font-bold text-gray-600">信箱</th>
              <th className="p-4 font-bold text-gray-600">電話</th>
              <th className="p-4 font-bold text-gray-600 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4 text-gray-500">#{u.id}</td>
                <td className="p-4 font-bold text-blue-700">{u.name}</td>
                <td className="p-4 text-gray-600">{u.email}</td>
                <td className="p-4 text-gray-600">{u.phone || '未填寫'}</td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => setEditingStudent(u)}
                    className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-lg font-bold hover:bg-purple-200 transition-colors inline-block"
                  >
                    編輯資料
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};