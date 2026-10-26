import axios from 'axios';
import Constants from 'expo-constants';

const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
const currentIP = hostUri ? hostUri.split(':')[0] : '127.0.0.1';
export const baseURL = `http://${currentIP}:5000/api`;

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const login = async (student_id: string, password: string) => {
  const response = await apiClient.post('/login', { student_id, password });
  return response.data;
};

export const getDashboard = async (student_id: string) => {
  const response = await apiClient.get(`/student/dashboard/${student_id}`);
  return response.data;
};

export const getCatalog = async (student_id: string) => {
  const response = await apiClient.get(`/books/catalog/${student_id}`);
  return response.data;
};

export const getPyqs = async (student_id: string) => {
  const response = await apiClient.get(`/pyq/${student_id}`);
  return response.data;
};

export const getNotifications = async (student_id: string) => {
  const response = await apiClient.get(`/student/notifications/${student_id}`);
  return response.data;
};

export const markNotificationRead = async (student_id: string, notification_id: string | number) => {
  const response = await apiClient.post('/student/notifications/mark-read', {
    student_id,
    notification_id,
  });
  return response.data;
};

export const markAllNotificationsRead = async (student_id: string) => {
  const response = await apiClient.post('/student/notifications/mark-all-read', {
    student_id,
  });
  return response.data;
};

export const getHistory = async (student_id: string) => {
  const response = await apiClient.get(`/student/history/${student_id}`);
  return response.data;
};


export const changePassword = async (student_id: string, current_password: string, new_password: string) => {
  const response = await apiClient.post('/change-password', {
    student_id,
    current_password,
    new_password,
  });
  return response.data;
};

export const getFullImageUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const serverRoot = baseURL.replace('/api', '');
  return `${serverRoot}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const uploadAvatar = async (
  studentId: string,
  imageUri: string,
  mimeType?: string,
  fileName?: string
) => {
  const formData = new FormData();
  const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanName = fileName || `avatar_${studentId}.${ext}`;
  const resolvedType =
    mimeType ||
    (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

  formData.append('student_id', studentId);
  formData.append('avatar', {
    uri: imageUri,
    name: cleanName,
    type: resolvedType,
  } as any);

  const response = await apiClient.post('/student/upload-avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export default apiClient;