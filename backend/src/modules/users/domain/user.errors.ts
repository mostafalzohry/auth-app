export class DuplicateEmailError extends Error {
  constructor() {
    super('A user with this email already exists');
    this.name = 'DuplicateEmailError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}
