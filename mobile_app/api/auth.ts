import * as SecureStore from 'expo-secure-store';
import { login } from './client';

const REFRESH_TOKEN_KEY = 'qrblms_refresh_token';
const STUDENT_ID_KEY = 'qrblms_student_id';
const SAVED_BIOMETRIC_ID_KEY = 'qrblms_biometric_student_id';

export const storeAuthData = async (token: string, studentId: string) => {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  await SecureStore.setItemAsync(STUDENT_ID_KEY, studentId);
  await SecureStore.setItemAsync(SAVED_BIOMETRIC_ID_KEY, studentId);
};

export const getRefreshToken = async () => {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
};

export const getStudentId = async () => {
  return await SecureStore.getItemAsync(STUDENT_ID_KEY);
};

export const getSavedStudentId = async () => {
  return await SecureStore.getItemAsync(SAVED_BIOMETRIC_ID_KEY);
};

export const clearTokens = async () => {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {}
  try {
    await SecureStore.deleteItemAsync(STUDENT_ID_KEY);
  } catch (e) {}
  try {
    await SecureStore.deleteItemAsync(SAVED_BIOMETRIC_ID_KEY);
  } catch (e) {}
};

export const loginWithCredentials = async (student_id: string, password: string) => {
  const data = await login(student_id, password);
  
  if (data.refresh_token) {
    await storeAuthData(data.refresh_token, data.student.id);
  }
  return data;
};

