import React, { useState, useEffect } from 'react';
import { validatePassword } from '../utils/passwordPolicy';

// 接收 currentUser(當前登入者) 與 targetUser(可選，要修改的對象)
export const UserProfile = ({ currentUser, targetUser }: { currentUser: any, targetUser?: any }) => {
  
  // 如果有傳入 targetUser (老師改學生)，就編輯 targetUser；否則編輯自己
  const editingUser = targetUser || currentUser;

  const [formData, setFormData] = useState({
    name: editingUser.name || '',
    gender: editingUser.gender || 'male',
    birthday: editingUser.birthday || '',
    email: editingUser.email || '',
    phone: editingUser.phone || '',
    password: ''
  });

  const [message, setMessage] = useState('');

  // 判斷當前「登入者」是否為管理員
  const isAdmin = currentUser.role === '教師' || currentUser.role === 'admin';

  // 🔽 新增：元件載入時，主動向後端拉取最新資料 🔽
  useEffect(() => {
    const fetchFreshData = async () => {
      try {
        // 依照身分決定要打哪一支 API 來取得最新資料
        // 注意：請確認你們後端 index.ts 裡有寫這兩支 GET API
        const url = (isAdmin && targetUser)
          ? `http://localhost:3000/api/admin/users/${editingUser.id}` 
          : `http://localhost:3000/api/users/${editingUser.id}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        // 如果成功拿到資料，就把新資料塞進表單狀態裡
        if (result.success && result.data) {
          const freshUser = result.data;
          setFormData({
            name: freshUser.name || '',
            gender: freshUser.gender || 'male',
            birthday: freshUser.birthday || '',
            email: freshUser.email || '',
            phone: freshUser.phone || '',
            password: '' // 密碼保持空白
          });
        }
      } catch (error) {
        console.error('無法獲取最新使用者資料:', error);
      }
    };

    if (editingUser?.id) {
      fetchFreshData();
    }
  }, [editingUser?.id, isAdmin, targetUser]);
  // 🔼 新增結束 🔼

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password) {
      const passwordError = validatePassword(formData.password, [
        editingUser.name,
        editingUser.email,
        editingUser.studentId,
        editingUser.birthday,
        editingUser.phone,
        formData.email,
        formData.phone,
        formData.name,
        formData.birthday,
      ]);
      if (passwordError) {
        setMessage(`錯誤：${passwordError}`);
        return;
      }
    }
    setMessage('處理中...');
    
    try {
      let url = '';
      let payload = {};

      if (isAdmin && targetUser) {
        // 管理員更新目標學生
        url = `http://localhost:3000/api/admin/users/${editingUser.id}`;
        payload = { adminId: currentUser.id, ...formData };
      } else if (isAdmin && !targetUser) {
        // 管理員更新自己
        url = `http://localhost:3000/api/admin/users/${editingUser.id}`;
        payload = { adminId: currentUser.id, ...formData };
      } else {
        // 一般使用者更新自己
        url = 'http://localhost:3000/api/users/profile';
        payload = { userId: currentUser.id, email: formData.email, phone: formData.phone, password: formData.password };
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        setMessage(isAdmin && targetUser ? `已成功更新 ${editingUser.name} 的資料！` : '資料更新成功！');
        setFormData(previous => ({ ...previous, password: '' }));
      } else {
        setMessage(`錯誤：${result.error}`);
      }
    } catch (error) {
      setMessage('網路錯誤，請稍後再試。');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-800">
          {targetUser ? `編輯 ${targetUser.name} 的資料` : '個人資料設定'}
        </h2>
        <p className="text-gray-500 mt-2">
          當前操作身分：
          <span className={`ml-2 px-3 py-1 text-sm font-bold rounded-full ${isAdmin ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {isAdmin ? '系統管理員' : '一般學生'}
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">基本資訊 (僅管理員可變更)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input name="name" type="text" value={formData.name} onChange={handleChange} disabled={!isAdmin} className="w-full p-3 border rounded-lg disabled:bg-gray-200 disabled:text-gray-500" />
            </div>
            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
                <select name="gender" value={formData.gender} onChange={handleChange} disabled={!isAdmin} className="w-full p-3 border rounded-lg disabled:bg-gray-200 disabled:text-gray-500">
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">生日</label>
                <input name="birthday" type="date" value={formData.birthday} onChange={handleChange} disabled={!isAdmin} className="w-full p-3 border rounded-lg disabled:bg-gray-200 disabled:text-gray-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
           <h3 className="text-sm font-semibold text-blue-500 mb-4">聯絡資訊與密碼 (可自由變更)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
              <input name="phone" type="tel" value={formData.phone} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
              <input name="password" type="password" autoComplete="new-password" placeholder="若不修改請留白" value={formData.password} onChange={handleChange} className="w-full p-3 border rounded-lg focus:ring-blue-500" />
              <p className="mt-2 text-xs leading-5 text-gray-500">
                至少 8 個字元，包含大小寫英文字母、數字及符號；不可使用連續或重複字元、常見單字、機關縮寫，或包含帳號、姓名、生日及電話。
              </p>
            </div>
          </div>
        </div>

        {message && <div className={`p-4 rounded-lg font-medium text-center ${message.includes('錯誤') ? 'bg-red-100 text-red-700' : message.includes('處理中') ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition">
          儲存變更
        </button>
      </form>
    </div>
  );
};