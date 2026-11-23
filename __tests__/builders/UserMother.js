import { User } from '../../src/domain/User.js';

// Object Mother: usuarios prontos que quase nao mudam entre os testes
export class UserMother {
    static umUsuarioPadrao() {
        return new User(1, 'Maria Silva', 'maria@email.com', 'PADRAO');
    }

    static umUsuarioPremium() {
        return new User(2, 'Carlos Souza', 'premium@email.com', 'PREMIUM');
    }
}
