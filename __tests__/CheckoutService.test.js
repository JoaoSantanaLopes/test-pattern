import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

const cartao = '4111 1111 1111 1111';

describe('CheckoutService', () => {

    describe('quando o pagamento falha', () => {

        it('deve retornar null', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            // dummies: so preenchem o construtor, nao devem ser usados
            const repositoryDummy = {};
            const emailDummy = {};
            const checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido).toBeNull();
        });

        it('nao deve salvar o pedido nem mandar e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let gatewayStub;
        let repositoryStub;
        let emailMock;
        let checkoutService;
        let carrinho;

        beforeEach(() => {
            // Arrange comum aos testes deste bloco
            const usuarioPremium = UserMother.umUsuarioPremium();
            carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([new Item('Fone de ouvido', 120), new Item('Mouse', 80)])
                .build();

            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => {
                    pedido.id = 42;
                    return pedido;
                }),
            };
            emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

            checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
        });

        it('deve cobrar o valor com 10% de desconto', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartao);
        });

        it('deve enviar um e-mail de confirmacao para o cliente', async () => {
            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180'
            );
        });

        it('deve retornar o pedido salvo com status PROCESSADO', async () => {
            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido.id).toBe(42);
            expect(pedido.totalFinal).toBe(180);
            expect(pedido.status).toBe('PROCESSADO');
        });
    });

    describe('quando um cliente padrao finaliza a compra', () => {

        it('deve retornar o pedido salvo sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comItem('Caneca', 30)
                .build(); // item padrao de 50 + caneca de 30
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => ({ ...pedido, id: 7 })),
            };
            const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido.id).toBe(7);
            expect(pedido.totalFinal).toBe(80);
            expect(pedido.status).toBe('PROCESSADO');
        });
    });

    describe('quando o envio de e-mail falha', () => {

        it('deve finalizar o pedido mesmo assim', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue({ id: 99, status: 'PROCESSADO' }) };
            const emailStub = { enviarEmail: jest.fn().mockRejectedValue(new Error('SMTP fora do ar')) };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);
            jest.spyOn(console, 'error').mockImplementation(() => {});

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(pedido).toEqual({ id: 99, status: 'PROCESSADO' });

            console.error.mockRestore();
        });
    });
});
