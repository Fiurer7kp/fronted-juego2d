const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
const BASE_URL = `${API_BASE}/api/auth`;

export interface AuthResponse {
  success: boolean;
  message: string;
  userId?: number;
  username?: string;
  hasSavedGame?: boolean;
  language?: string;
}

export interface SesionUsuario {
  userId: number;
  username: string;
  hasSavedGame: boolean;
  language: string;
}

export const AuthService = {

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        return data;
      }
      return await res.json();
    } catch (error) {
      console.error('Error de conexión:', error);
      return { success: false, message: '¿Está corriendo en http://localhost:8080?' };
    }
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        return data;
      }
      return await res.json();
    } catch (error) {
      console.error('Error de conexión:', error);
      return { success: false, message: 'Error de conexión al servidor. ¿Está corriendo en http://localhost:8080?' };
    }
  },

  async updateLanguage(userId: number, language: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${BASE_URL}/language/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) {
        const data = await res.json();
        return data;
      }
      return await res.json();
    } catch (error) {
      console.error('Error de conexión:', error);
      return { success: false, message: 'Error de conexión al servidor.' };
    }
  },

  guardarSesion(data: AuthResponse): void {
    const sesion: SesionUsuario = {
      userId:       data.userId!,
      username:     data.username!,
      hasSavedGame: data.hasSavedGame ?? false,
      language:     data.language ?? 'es',
    };
    localStorage.setItem('sesion', JSON.stringify(sesion));
  },

  getSesion(): SesionUsuario | null {
    const raw = localStorage.getItem('sesion');
    return raw ? JSON.parse(raw) : null;
  },

  cerrarSesion(): void {
    localStorage.removeItem('sesion');
  },
};
