export interface AuthUser {
  username: string;
  name: string;
  role: string;
  department: string;
}

const AUTH_STORAGE_KEY = 'mymf_qa_auth_session_v1';

// Default built-in credentials for QA/QC Engineering staff
export const DEFAULT_CREDENTIALS = {
  username: 'admin',
  password: 'password123',
  alternateEmail: 'qa@mymf.com.sa',
};

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Array<(user: AuthUser | null) => void> = [];

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch {
      this.currentUser = null;
    }
  }

  public subscribe(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  public login(usernameInput: string, passwordInput: string): boolean {
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    const isValidUser =
      cleanUser === DEFAULT_CREDENTIALS.username ||
      cleanUser === DEFAULT_CREDENTIALS.alternateEmail;
    const isValidPass = cleanPass === DEFAULT_CREDENTIALS.password;

    if (isValidUser && isValidPass) {
      this.currentUser = {
        username: 'admin',
        name: 'Adel Y. Aseery',
        role: 'Quality Section Head',
        department: 'QA/QC Inspection Division',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
      }
      this.notify();
      return true;
    }

    return false;
  }

  public logout(): void {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    this.notify();
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }
}

export const authService = new AuthService();
