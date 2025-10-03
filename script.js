document.addEventListener('DOMContentLoaded', () => {
    // ---- ESTRUTURA DE DADOS INICIAL ---- //
    let workspace = {
        boards: [
            {
                id: 2025,
                name: "Reposições 2025",
                lists: [
                    { id: 1, title: "Solicitações Pendentes", cards: [
                        { id: 101, patientName: "João da Silva", originalProfessional: "Dr. Ana", originalDate: "2025-10-15", sessionType: "Terapia Ocupacional", totalDuration: 50, notes: "Paciente cancelou por motivo de viagem.", completedFractions: [] },
                        { id: 102, patientName: "Maria Oliveira", originalProfessional: "Dra. Carla", originalDate: "2025-10-12", sessionType: "Fonoaudiologia", totalDuration: 50, notes: "Aguardando horário vago.", completedFractions: [{ date: "2025-10-13", duration: 10, professional: "Dra. Carla" }] }
                    ]},
                    { id: 2, title: "Concluídas", cards: [] }
                ]
            },
            {
                id: 2024,
                name: "Reposições 2024",
                lists: [
                    { id: 10, title: "Solicitações", cards: [
                         { id: 201, patientName: "Carlos Andrade", originalProfessional: "Dr. Roberto", originalDate: "2024-12-20", sessionType: "Psicologia", totalDuration: 60, notes: "Finalizado.", completedFractions: [{ date: "2024-12-22", duration: 60, professional: "Dr. Roberto" }] }
                    ]},
                    { id: 11, title: "Finalizadas", cards: [] }
                ]
            }
        ]
    };

    // ---- ESTADO DA APLICAÇÃO ---- //
    let currentBoardId = null;
    let selectedCardId = null;
    let currentListIdForNewCard = null;

    // ---- ELEMENTOS DA DOM ---- //
    const screens = document.querySelectorAll('.screen');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const boardsContainer = document.getElementById('boards-container');
    const addBoardBtn = document.getElementById('add-board-btn');
    const boardTitle = document.getElementById('board-title');
    const boardContent = document.getElementById('board-content');
    const searchBar = document.getElementById('search-bar');
    const backToWorkspaceBtn = document.getElementById('back-to-workspace-btn');
    
    // Modals e Formulários
    const createCardModal = new bootstrap.Modal(document.getElementById('createCardModal'));
    const cardDetailsModal = new bootstrap.Modal(document.getElementById('cardDetailsModal'));
    const createCardForm = document.getElementById('createCardForm');
    const cardDetailsTitle = document.getElementById('cardDetailsModalTitle');
    const cardDetailsBody = document.getElementById('cardDetailsModalBody');
    const deleteCardBtn = document.getElementById('deleteCardBtn');
    const addFractionForm = document.getElementById('addFractionForm');

    // ---- FUNÇÕES PRINCIPAIS ---- //

    const showScreen = (screenId) => {
        screens.forEach(screen => screen.classList.toggle('hidden', screen.id !== screenId));
        document.body.classList.toggle('login-view', screenId === 'login-screen');
    };

    const renderWorkspace = () => {
        boardsContainer.innerHTML = '';
        workspace.boards.forEach(board => {
            const boardCard = document.createElement('div');
            boardCard.className = 'col-md-4 col-lg-3 mb-3';
            boardCard.innerHTML = `
                <div class="card bg-dark text-white board-card h-100" data-board-id="${board.id}">
                    <div class="card-body">
                        <h5 class="card-title">${board.name}</h5>
                        <p class="card-text text-body-secondary">${board.lists.length} colunas</p>
                    </div>
                </div>
            `;
            boardsContainer.appendChild(boardCard);
        });
    };

    const renderBoard = (searchTerm = "") => {
        const board = workspace.boards.find(b => b.id === currentBoardId);
        if (!board) return;

        boardTitle.textContent = board.name;
        boardContent.innerHTML = '';
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        board.lists.forEach(list => {
            const listWrapper = document.createElement('div');
            listWrapper.className = 'list-wrapper';
            listWrapper.dataset.listId = list.id;
            const listElement = document.createElement('div');
            listElement.className = 'list';
            const filteredCards = list.cards.filter(card => 
                card.patientName.toLowerCase().includes(lowerCaseSearchTerm) ||
                card.originalProfessional.toLowerCase().includes(lowerCaseSearchTerm)
            );
            
            const listHeader = document.createElement('div');
            listHeader.className = 'list-header d-flex justify-content-between align-items-center';
            listHeader.innerHTML = `
                <span>${list.title} (${filteredCards.length})</span>
                <button class="btn btn-sm btn-outline-danger border-0 delete-list-btn">
                    <i class="bi bi-trash"></i>
                </button>
            `;
            listElement.appendChild(listHeader);

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'cards-container';
            cardsContainer.dataset.listId = list.id;

            filteredCards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card bg-dark text-white mb-2 card-reposicao';
                cardElement.dataset.cardId = card.id;
                const originalDateFomatted = new Date(card.originalDate + 'T00:00:00').toLocaleDateString('pt-BR');

                const completedMinutes = card.completedFractions.reduce((sum, fraction) => sum + fraction.duration, 0);
                const progressPercentage = card.totalDuration > 0 ? (completedMinutes / card.totalDuration) * 100 : 0;

                cardElement.innerHTML = `
                    <div class="card-body p-2">
                        <h6 class="card-title mb-1">${card.patientName}</h6>
                        <div class="card-info d-flex flex-column">
                            <span><i class="bi bi-person"></i> ${card.originalProfessional}</span>
                            <span><i class="bi bi-calendar-event"></i> Orig: ${originalDateFomatted}</span>
                        </div>
                        <div class="progress-container">
                            <div class="card-progress-bar" style="width: ${progressPercentage}%">${Math.round(progressPercentage)}%</div>
                        </div>
                    </div>`;
                cardsContainer.appendChild(cardElement);
            });
            listElement.appendChild(cardsContainer);

            const footer = document.createElement('div');
            footer.className = 'list-footer';
            footer.innerHTML = `<button class="btn btn-sm btn-secondary w-100 add-card-btn" data-list-id="${list.id}">Nova Solicitação +</button>`;
            listElement.appendChild(footer);

            listWrapper.appendChild(listElement);
            boardContent.appendChild(listWrapper);
        });
        
        const addListWrapper = document.createElement('div');
        addListWrapper.className = 'list-wrapper';
        addListWrapper.innerHTML = `<button id="add-list-btn" class="btn btn-secondary w-100">Adicionar coluna +</button>`;
        boardContent.appendChild(addListWrapper);

        initSortable();
    };

    const initSortable = () => {
        const boardToSort = workspace.boards.find(b => b.id === currentBoardId);
        if (!boardToSort) return;

        new Sortable(boardContent, {
            animation: 150,
            handle: '.list-header',
            filter: '.list-wrapper:has(#add-list-btn)',
            onEnd: (evt) => {
                const movedList = boardToSort.lists.splice(evt.oldIndex, 1)[0];
                boardToSort.lists.splice(evt.newIndex, 0, movedList);
            }
        });

        document.querySelectorAll('#board-content .cards-container').forEach(container => {
            new Sortable(container, {
                group: 'shared-cards',
                animation: 150,
                onEnd: (evt) => {
                    const cardId = parseInt(evt.item.dataset.cardId);
                    const toListId = parseInt(evt.to.dataset.listId);
                    const toList = boardToSort.lists.find(l => l.id === toListId);

                    let movedCard;
                    for(const list of boardToSort.lists) {
                        movedCard = list.cards.find(c => c.id === cardId);
                        if(movedCard) break;
                    }

                    const completedMinutes = movedCard.completedFractions.reduce((sum, fraction) => sum + fraction.duration, 0);
                    
                    if (toList.title.toLowerCase().startsWith('concluída') && completedMinutes < movedCard.totalDuration) {
                        alert('Uma reposição só pode ser movida para "Concluídas" quando atingir 100% do tempo.');
                        renderBoard(searchBar.value);
                        return;
                    }
                    
                    const fromListId = parseInt(evt.from.dataset.listId);
                    const fromList = boardToSort.lists.find(l => l.id === fromListId);
                    const cardIndex = fromList.cards.findIndex(c => c.id === cardId);
                    const cardToMove = fromList.cards.splice(cardIndex, 1)[0];
                    toList.cards.splice(evt.newIndex, 0, cardToMove);
                    
                    renderBoard(searchBar.value);
                }
            });
        });
    };

    // ---- EVENT LISTENERS ---- //

    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        renderWorkspace();
        showScreen('workspace-screen');
    });

    logoutBtn.addEventListener('click', () => showScreen('login-screen'));
    backToWorkspaceBtn.addEventListener('click', () => showScreen('workspace-screen'));
    searchBar.addEventListener('input', e => renderBoard(e.target.value));

    boardsContainer.addEventListener('click', e => {
        const boardCard = e.target.closest('.board-card');
        if (boardCard) {
            currentBoardId = parseInt(boardCard.dataset.boardId);
            renderBoard();
            showScreen('board-screen');
        }
    });

    addBoardBtn.addEventListener('click', () => {
        const name = prompt("Digite o nome do novo board (ex: Reposições 2026):");
        if (name && name.trim()) {
            workspace.boards.push({ id: Date.now(), name: name.trim(), lists: [
                { id: Date.now() + 1, title: "Solicitações Pendentes", cards: [] },
                { id: Date.now() + 2, title: "Agendadas", cards: [] },
                { id: Date.now() + 3, title: "Concluídas", cards: [] }
            ]});
            renderWorkspace();
        }
    });

    boardContent.addEventListener('click', e => {
        const addCardBtn = e.target.closest('.add-card-btn');
        if (addCardBtn) {
            currentListIdForNewCard = parseInt(addCardBtn.dataset.listId);
            createCardForm.reset();
            createCardModal.show();
            return;
        }

        const cardElement = e.target.closest('.card-reposicao[data-card-id]');
        if (cardElement) {
            selectedCardId = parseInt(cardElement.dataset.cardId);
            const board = workspace.boards.find(b => b.id === currentBoardId);
            let cardData;
            for (const list of board.lists) {
                cardData = list.cards.find(c => c.id === selectedCardId);
                if (cardData) break;
            }
            if (cardData) {
                cardDetailsTitle.textContent = `Reposição: ${cardData.patientName}`;
                
                const originalDateFomatted = new Date(cardData.originalDate + 'T00:00:00').toLocaleDateString('pt-BR');
                document.getElementById('originalSessionDetails').innerHTML = `
                    <p class="mb-1"><strong>Profissional Original:</strong> ${cardData.originalProfessional}</p>
                    <p class="mb-1"><strong>Data Original:</strong> ${originalDateFomatted}</p>
                    <p class="mb-0"><strong>Tipo:</strong> ${cardData.sessionType || "Não informado"}</p>`;

                const completedMinutes = cardData.completedFractions.reduce((sum, fraction) => sum + fraction.duration, 0);
                const progressPercentage = cardData.totalDuration > 0 ? (completedMinutes / cardData.totalDuration) * 100 : 0;
                const progressBar = document.getElementById('cardProgressBar');
                progressBar.style.width = `${progressPercentage}%`;
                progressBar.textContent = `${Math.round(progressPercentage)}%`;
                document.getElementById('progressStatus').textContent = `${completedMinutes} de ${cardData.totalDuration} min concluídos`;

                const fractionsLog = document.getElementById('fractionsLog');
                fractionsLog.innerHTML = '';
                if (cardData.completedFractions.length === 0) {
                    fractionsLog.innerHTML = `<li class="list-group-item empty-log">Nenhuma fração registrada.</li>`;
                } else {
                    cardData.completedFractions.forEach(fraction => {
                        const item = document.createElement('li');
                        item.className = 'list-group-item d-flex justify-content-between align-items-center';
                        const fractionDateFormatted = new Date(fraction.date + 'T00:00:00').toLocaleDateString('pt-BR');
                        item.innerHTML = `
                            <span>
                                <i class="bi bi-check-circle-fill text-success"></i>
                                <strong>${fraction.duration} min</strong> em ${fractionDateFormatted}
                                <small class="text-body-secondary d-block">com ${fraction.professional}</small>
                            </span>`;
                        fractionsLog.appendChild(item);
                    });
                }
                cardDetailsModal.show();
            }
            return;
        }
        
        if (e.target.matches('#add-list-btn')) {
            const title = prompt("Digite o título da nova coluna:");
            const board = workspace.boards.find(b => b.id === currentBoardId);
            if (title && title.trim() && board) {
                board.lists.push({ id: Date.now(), title: title.trim(), cards: [] });
                renderBoard();
            }
            return;
        }

        const deleteListBtn = e.target.closest('.delete-list-btn');
        if (deleteListBtn) {
            const listWrapper = deleteListBtn.closest('.list-wrapper');
            const listIdToDelete = parseInt(listWrapper.dataset.listId);
            const board = workspace.boards.find(b => b.id === currentBoardId);
            const listToDelete = board.lists.find(l => l.id === listIdToDelete);
            
            if (listToDelete && confirm(`Tem certeza que deseja excluir a coluna "${listToDelete.title}" e todos os seus cards?`)) {
                board.lists = board.lists.filter(list => list.id !== listIdToDelete);
                renderBoard();
            }
        }
    });

    createCardForm.addEventListener('submit', e => {
        e.preventDefault();
        const newCardData = {
            id: Date.now(),
            patientName: document.getElementById('patientName').value.trim(),
            originalProfessional: document.getElementById('originalProfessional').value.trim(),
            originalDate: document.getElementById('originalDate').value,
            totalDuration: parseInt(document.getElementById('totalDuration').value) || 0,
            sessionType: document.getElementById('sessionType').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            completedFractions: []
        };
        const board = workspace.boards.find(b => b.id === currentBoardId);
        const list = board.lists.find(l => l.id === currentListIdForNewCard);
        list.cards.push(newCardData);
        renderBoard();
        createCardModal.hide();
    });

    addFractionForm.addEventListener('submit', e => {
        e.preventDefault();
        if(!selectedCardId) return;

        const newFraction = {
            date: document.getElementById('fractionDate').value,
            duration: parseInt(document.getElementById('fractionDuration').value) || 0,
            professional: document.getElementById('fractionProfessional').value.trim()
        };

        if (newFraction.duration <= 0 || !newFraction.date || !newFraction.professional) {
            alert("Por favor, preencha todos os campos da fração.");
            return;
        }

        const board = workspace.boards.find(b => b.id === currentBoardId);
        let cardToUpdate;
        for (const list of board.lists) {
            cardToUpdate = list.cards.find(c => c.id === selectedCardId);
            if (cardToUpdate) break;
        }

        const completedMinutes = cardToUpdate.completedFractions.reduce((sum, fraction) => sum + fraction.duration, 0);
        if ((completedMinutes + newFraction.duration) > cardToUpdate.totalDuration) {
            alert("A soma das frações não pode ultrapassar a duração total da sessão.");
            return;
        }
        
        cardToUpdate.completedFractions.push(newFraction);
        addFractionForm.reset();
        cardDetailsModal.hide();
        renderBoard();
    });

    deleteCardBtn.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja excluir esta solicitação?")) {
            if (selectedCardId) {
                const board = workspace.boards.find(b => b.id === currentBoardId);
                board.lists.forEach(list => {
                    list.cards = list.cards.filter(card => card.id !== selectedCardId);
                });
                renderBoard();
                cardDetailsModal.hide();
                selectedCardId = null;
            }
        }
    });

    // ---- INICIALIZAÇÃO ---- //
    showScreen('login-screen');
});