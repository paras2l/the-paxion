// User management and permissions core module
// Provides user roles, user registry, and access control logic

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
}

export class UserRegistry {
  private users: UserAccount[] = [];

  addUser(user: UserAccount) {
    this.users.push(user);
  }

  getUserByUsername(username: string): UserAccount | undefined {
    return this.users.find(u => u.username === username);
  }

  getUserById(id: string): UserAccount | undefined {
    return this.users.find(u => u.id === id);
  }

  listUsers(): UserAccount[] {
    return [...this.users];
  }

  updateUserRole(id: string, role: UserRole) {
    const user = this.getUserById(id);
    if (user) user.role = role;
  }
}

export function checkPermission(user: UserAccount, action: string): boolean {
  // Example: simple role-based access
  if (user.role === 'admin') return true;
  if (user.role === 'editor' && action !== 'manageUsers') return true;
  if (user.role === 'viewer' && action === 'view') return true;
  return false;
}
