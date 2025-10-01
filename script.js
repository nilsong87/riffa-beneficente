document.addEventListener('DOMContentLoaded', () => {
    const numbersGrid = document.getElementById('numbers-grid');
    const totalNumbers = 1000;

    // Elementos de Autenticação
    const authLinks = document.getElementById('auth-links');
    const userInfo = document.getElementById('user-info');
    const userEmailSpan = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');

    // Modais e Formulários
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // --- LÓGICA DE AUTENTICAÇÃO ---
    try {
        const auth = firebase.auth();
        const db = firebase.firestore();

        auth.onAuthStateChanged(user => {
            if (user) {
                // Usuário está logado
                userInfo.classList.remove('d-none');
                authLinks.classList.add('d-none');
                userEmailSpan.textContent = user.email;
            } else {
                // Usuário não está logado
                userInfo.classList.add('d-none');
                authLinks.classList.remove('d-none');
                userEmailSpan.textContent = '';
            }
        });

        // --- MÁSCARAS DE INPUT ---
        const cpfInput = document.getElementById('register-cpf');
        const phoneInput = document.getElementById('register-phone');
        const cepInput = document.getElementById('register-cep');

        cpfInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = value;
        });

        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
            value = value.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = value;
        });

        cepInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/^(\d{5})(\d)/, '$1-$2');
            e.target.value = value;
        });

        // Cadastro
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validação de Idade
            const dobString = document.getElementById('register-dob').value;
            const dob = new Date(dobString);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                age--;
            }

            if (age < 18) {
                alert('O cadastro é permitido apenas para maiores de 18 anos.');
                return;
            }

            // Coleta dos dados do formulário
            const name = document.getElementById('register-name').value;
            const cpf = cpfInput.value;
            const phone = phoneInput.value;
            const cep = cepInput.value;
            const address = document.getElementById('register-address').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // Salva todos os dados do usuário no Firestore
                    return db.collection('users').doc(userCredential.user.uid).set({
                        name: name,
                        email: email,
                        cpf: cpf,
                        dob: dobString,
                        phone: phone,
                        cep: cep,
                        address: address,
                        uid: userCredential.user.uid
                    });
                })
                .then(() => {
                    registerForm.reset();
                    registerModal.hide();
                    alert('Cadastro realizado com sucesso!');
                })
                .catch(error => {
                    console.error('Erro no cadastro:', error);
                    alert(`Erro: ${error.message}`);
                });
        });

        // Login
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    loginForm.reset();
                    loginModal.hide();
                    alert('Login efetuado com sucesso!');
                })
                .catch(error => {
                    console.error('Erro no login:', error);
                    alert(`Erro: ${error.message}`);
                });
        });

        // Logout
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                alert('Você saiu da sua conta.');
            });
        });

        // --- LÓGICA DE SELEÇÃO E COMPRA ---
        let selectedNumbers = [];
        const buyButtonContainer = document.getElementById('buy-button-container');
        const buyButton = document.getElementById('buy-button');
        const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
        const selectedNumbersList = document.getElementById('selected-numbers-list');
        const totalPrice = document.getElementById('total-price');
        const confirmPaymentButton = document.getElementById('confirm-payment-button');
        const numberPrice = 10;

        numbersGrid.addEventListener('click', (e) => {
            if (!e.target.classList.contains('number-box')) return;

            const user = auth.currentUser;
            if (!user) {
                alert('Você precisa estar logado para selecionar um número.');
                loginModal.show();
                return;
            }

            const numberBox = e.target;
            const number = numberBox.dataset.number;

            if (numberBox.classList.contains('available')) {
                numberBox.classList.remove('available');
                numberBox.classList.add('selected');
                selectedNumbers.push(number);
            } else if (numberBox.classList.contains('selected')) {
                numberBox.classList.remove('selected');
                numberBox.classList.add('available');
                selectedNumbers = selectedNumbers.filter(n => n !== number);
            }

            if (selectedNumbers.length > 0) {
                buyButtonContainer.classList.remove('d-none');
            } else {
                buyButtonContainer.classList.add('d-none');
            }
        });

        buyButton.addEventListener('click', () => {
            selectedNumbersList.textContent = selectedNumbers.join(', ');
            totalPrice.textContent = `R$ ${(selectedNumbers.length * numberPrice).toFixed(2)}`;
            paymentModal.show();
        });

        confirmPaymentButton.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return alert('Sessão expirada. Faça login novamente.');

            const userDoc = await db.collection('users').doc(user.uid).get();
            const userName = userDoc.data().name;

            try {
                await db.runTransaction(async (transaction) => {
                    const numbersToUpdate = [];
                    for (const number of selectedNumbers) {
                        const numberRef = db.collection('numbers').doc(number);
                        const doc = await transaction.get(numberRef);
                        if (doc.data().status !== 'available') {
                            throw `O número ${number} não está mais disponível!`;
                        }
                        numbersToUpdate.push(numberRef);
                    }

                    numbersToUpdate.forEach(ref => {
                        transaction.update(ref, {
                            status: 'sold',
                            ownerId: user.uid,
                            ownerName: userName,
                            ownerEmail: user.email
                        });
                    });
                });

                alert('Pagamento confirmado! Boa sorte!');
                selectedNumbers = [];
                buyButtonContainer.classList.add('d-none');
                paymentModal.hide();

            } catch (error) {
                console.error("Erro na transação: ", error);
                alert(error);
            }
        });

        // --- LÓGICA DO VENCEDOR ---
        const winnerSection = document.getElementById('winner-section');
        const winningNumberSpan = document.getElementById('winning-number');
        const winnerNameSpan = document.getElementById('winner-name');

        db.collection('raffle_status').doc('current').onSnapshot(doc => {
            if (doc.exists && doc.data().winningNumber) {
                const winner = doc.data();
                winningNumberSpan.textContent = winner.winningNumber;
                winnerNameSpan.textContent = winner.winnerName;
                winnerSection.classList.remove('d-none');
            } else {
                winnerSection.classList.add('d-none');
            }
        });

        // Função para definir o vencedor (EXECUTAR NO CONSOLE)
        window.setWinner = async (numberStr) => {
            const paddedNumber = numberStr.toString().padStart(3, '0');
            const numberRef = db.collection('numbers').doc(paddedNumber);
            const numberDoc = await numberRef.get();

            if (!numberDoc.exists) {
                return console.error(`Número ${paddedNumber} não encontrado.`);
            }

            const numberData = numberDoc.data();
            if (numberData.status !== 'sold') {
                return console.error(`O número ${paddedNumber} não foi vendido.`);
            }

            const winnerName = numberData.ownerName;
            await db.collection('raffle_status').doc('current').set({
                winningNumber: paddedNumber,
                winnerName: winnerName
            });

            console.log(`Vencedor ${winnerName} com o número ${paddedNumber} definido com sucesso!`);
        };

    } catch (error) {
        console.error('Erro ao inicializar o Firebase:', error);
        alert('Erro ao conectar com o sistema. Verifique a configuração do Firebase no arquivo firebase-config.js');
    }

        // --- LÓGICA DA RIFA ---

        // Função para popular o Firestore (EXECUTAR UMA VEZ NO CONSOLE)
        window.populateFirestore = () => {
            const batch = db.batch();
            for (let i = 1; i <= 1000; i++) {
                const docRef = db.collection('numbers').doc(i.toString().padStart(3, '0'));
                batch.set(docRef, {
                    number: i.toString().padStart(3, '0'),
                    status: 'available', // available, pending, sold
                    ownerId: null,
                    ownerName: null,
                    ownerEmail: null
                });
            }
            batch.commit()
                .then(() => console.log('Firestore populado com 1000 números.'))
                .catch(e => console.error('Erro ao popular Firestore:', e));
        };

        function renderGrid(numbers) {
            numbersGrid.innerHTML = ''; // Limpa a grade antes de renderizar
            numbers.forEach(num => {
                const numberBox = document.createElement('div');
                numberBox.classList.add('number-box');
                numberBox.textContent = num.id;
                numberBox.dataset.number = num.id;

                // Remove todas as classes de status e adiciona a correta
                numberBox.classList.remove('available', 'sold', 'pending', 'selected');
                numberBox.classList.add(num.data().status);

                numbersGrid.appendChild(numberBox);
            });
        }

        // Ouve as atualizações da coleção 'numbers' em tempo real
        db.collection('numbers').orderBy('number').onSnapshot(snapshot => {
            const numbers = snapshot.docs;
            renderGrid(numbers);
        }, error => {
            console.error("Erro ao buscar números: ", error);
        });

        // Ouve as atualizações para a lista de participantes de forma segura
        db.collection('numbers').where('status', '==', 'sold').onSnapshot(snapshot => {
            const participantsTbody = document.getElementById('participants-tbody');
            const participants = {}; // Objeto para agrupar números por comprador

            snapshot.forEach(doc => {
                const numberData = doc.data();
                const ownerId = numberData.ownerId;
                const ownerName = numberData.ownerName;

                if (!ownerId) return; // Pula se não tiver dono

                if (participants[ownerId]) {
                    // Se o participante já está no objeto, apenas adiciona o novo número
                    participants[ownerId].numbers.push(numberData.number);
                } else {
                    // Se é o primeiro número deste participante, cria a entrada no objeto
                    participants[ownerId] = {
                        name: ownerName,
                        numbers: [numberData.number]
                    };
                }
            });

            // Limpa a tabela antes de renderizar
            participantsTbody.innerHTML = '';

            // Renderiza a tabela com os dados agrupados
            for (const ownerId in participants) {
                const participant = participants[ownerId];
                participant.numbers.sort(); // Ordena os números de cada participante
                const row = `<tr>
                                <td>${participant.name}</td>
                                <td>${participant.numbers.join(', ')}</td>
                             </tr>`;
                participantsTbody.innerHTML += row;
            }
        }, error => {
            console.error("Erro ao buscar a lista de participantes: ", error);
        });

        // --- CORREÇÃO DE ACESSIBILIDADE PARA MODAIS ---
        // Este código resolve o aviso de "aria-hidden" no console.
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(modal => {
            modal.addEventListener('hidden.bs.modal', () => {
                if (document.activeElement) {
                    document.activeElement.blur();
                }
            });
        });
});
