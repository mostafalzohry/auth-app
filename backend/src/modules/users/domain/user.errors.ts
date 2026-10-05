export class DuplicateEmailError extends Error {
  constructor() {
    super('A user with this email already exists');
    this.name = 'DuplicateEmailError';
  }
}
