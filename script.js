document.addEventListener('DOMContentLoaded', () => {
    // ---- ESTRUTURA DE DADOS ---- //
    let workspace = {
        boards: [
            {
                id: 2025,
                name: "2025",
                lists: [
                    { 
                        id: 1, 
                        title: "Pacientes com Pendências", 
                        patients: [
                            { 
                                id: 101, 
                                name: "João da Silva", 
                                contact: "(11) 98765-4321",
                                mainProfessional: "Dr. Ana",
                                replacements: [
                                    { id: 1001, originalProfessional: "Dr. Ana", originalDate: "2025-10-15", totalDuration: 50, notes: "Viagem.", completedFractions: [] },
                                    { id: 1002, originalProfessional: "Dra. Carla", originalDate: "2025-10-12", totalDuration: 50, notes: "Aguardando horário.", completedFractions: [{ date: "2025-10-13", duration: 10, professional: "Dra. Carla" }] }
                                ]
                            }
                        ]
                    },
                    { id: 2, title: "Pacientes sem Pendências", patients: [] }
                ]
            },
            {
                id: 2024,
                name: "2024",
                lists: [
                    { id: 10, title: "Solicitações", patients: [] },
                    { id: 11, title: "Finalizadas", patients: [] }
                ]
            }
        ]
    };

    // ---- ESTADO DA APLICAÇÃO ---- //
    let currentYear = null;
    let selectedPatientId = null;
    let selectedReplacementId = null;
    let currentListIdForNewPatient = null;
    let editingPatientId = null;

    // ---- ELEMENTOS DA DOM ---- //
    const screens = document.querySelectorAll('.screen');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const boardContent = document.getElementById('board-content');
    const searchBar = document.getElementById('search-bar');
    const yearSelectorBtn = document.getElementById('year-selector-btn');
    const yearSelectorMenu = document.getElementById('year-selector-menu');
    
    const createPatientModal = new bootstrap.Modal(document.getElementById('createPatientModal'));
    const patientDetailsModal = new bootstrap.Modal(document.getElementById('patientDetailsModal'));
    const addReplacementModal = new bootstrap.Modal(document.getElementById('addReplacementModal'));
    const addYearModal = new bootstrap.Modal(document.getElementById('addYearModal'));
    const registerFractionModal = new bootstrap.Modal(document.getElementById('registerFractionModal'));
    
    const createPatientForm = document.getElementById('createPatientForm');
    const createPatientModalTitle = document.getElementById('createPatientModalTitle');
    const createPatientSubmitBtn = document.getElementById('createPatientSubmitBtn');
    const patientNameTitle = document.getElementById('patientNameTitle');
    const deletePatientBtn = document.getElementById('deletePatientBtn');
    const showAddReplacementModalBtn = document.getElementById('showAddReplacementModalBtn');
    const addReplacementForm = document.getElementById('addReplacementForm');
    const addYearForm = document.getElementById('addYearForm');
    const registerFractionForm = document.getElementById('registerFractionForm');
    const patientDetailsModalElement = document.getElementById('patientDetailsModal');

    // ---- FUNÇÕES PRINCIPAIS ---- //

    const showScreen = (screenId) => {
        screens.forEach(screen => screen.classList.toggle('hidden', screen.id !== screenId));
        document.body.classList.toggle('login-view', screenId === 'login-screen');
    };

    const initializeApp = () => {
        const year = new Date().getFullYear();
        if (!workspace.boards.find(b => b.id === year)) {
            workspace.boards.push({ id: year, name: String(year), lists: [
                { id: Date.now() + 1, title: "Pacientes com Pendências", patients: [] },
                { id: Date.now() + 2, title: "Pacientes sem Pendências", patients: [] }
            ]});
        }
        currentYear = year;
        renderYearSelector();
        renderBoard();
        showScreen('board-screen');
    };

    const renderYearSelector = () => {
        yearSelectorMenu.innerHTML = '';
        yearSelectorBtn.textContent = currentYear;
        const sortedBoards = [...workspace.boards].sort((a, b) => b.id - a.id);
        sortedBoards.forEach(board => {
            const item = document.createElement('li');
            item.innerHTML = `<a class="dropdown-item" href="#" data-year="${board.id}">${board.name}</a>`;
            yearSelectorMenu.appendChild(item);
        });
        yearSelectorMenu.innerHTML += `<li><hr class="dropdown-divider"></li>`;
        yearSelectorMenu.innerHTML += `<li><a class="dropdown-item" href="#" id="add-year-option">Adicionar Novo Ano...</a></li>`;
    };

    const renderBoard = (searchTerm = "") => {
        const board = workspace.boards.find(b => b.id === currentYear);
        if (!board) return;
        boardContent.innerHTML = '';
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        board.lists.forEach(list => {
            const listWrapper = document.createElement('div');
            listWrapper.className = 'list-wrapper';
            listWrapper.dataset.listId = list.id;
            const listElement = document.createElement('div');
            listElement.className = 'list';
            const filteredPatients = list.patients.filter(p => p.name.toLowerCase().includes(lowerCaseSearchTerm));
            
            const listHeader = document.createElement('div');
            listHeader.className = 'list-header d-flex justify-content-between align-items-center';
            listHeader.innerHTML = `<span>${list.title} (${filteredPatients.length})</span><button class="btn btn-sm btn-outline-danger border-0 delete-list-btn"><i class="bi bi-trash"></i></button>`;
            listElement.appendChild(listHeader);
            
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'cards-container';
            cardsContainer.dataset.listId = list.id;
            filteredPatients.forEach(patient => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card bg-white text-dark mb-2 card-paciente';
                cardElement.dataset.patientId = patient.id;
                const pendingReplacements = patient.replacements.filter(r => {
                    const completed = r.completedFractions.reduce((sum, f) => sum + f.duration, 0);
                    return completed < r.totalDuration;
                }).length;
                cardElement.innerHTML = `<div class="card-body p-2"><h6 class="card-title mb-1">${patient.name}</h6><div class="card-info d-flex flex-column"><span><i class="bi bi-person-check"></i> ${patient.mainProfessional || "N/A"}</span><span class="${pendingReplacements > 0 ? 'text-warning' : 'text-success'}"><i class="bi bi-${pendingReplacements > 0 ? 'hourglass-split' : 'check-circle-fill'}"></i> ${pendingReplacements} reposiç${pendingReplacements === 1 ? 'ão' : 'ões'} pendente${pendingReplacements === 1 ? '' : 's'}</span></div></div>`;
                cardsContainer.appendChild(cardElement);
            });
            listElement.appendChild(cardsContainer);
            const footer = document.createElement('div');
            footer.className = 'list-footer';
            footer.innerHTML = `<button class="btn btn-sm btn-secondary w-100 add-patient-btn" data-list-id="${list.id}">Novo Paciente +</button>`;
            listElement.appendChild(footer);
            listWrapper.appendChild(listElement);
            boardContent.appendChild(listWrapper);
        });
        const addListWrapper = document.createElement('div');
        addListWrapper.className = 'list-wrapper';
        addListWrapper.innerHTML = `<button id="add-list-btn" class="btn btn-light w-100">Adicionar coluna +</button>`;
        boardContent.appendChild(addListWrapper);
        initSortable();
    };
    
    const renderPatientDetails = () => {
        const board = workspace.boards.find(b => b.id === currentYear);
        if (!board) return;
        let patientData;
        for (const list of board.lists) {
            patientData = list.patients.find(p => p.id === selectedPatientId);
            if (patientData) break;
        }
        if (!patientData) return;
        patientNameTitle.textContent = `Painel de: ${patientData.name}`;
        document.getElementById('patientInfoPanel').innerHTML = `<div class="d-flex justify-content-between align-items-start"><div><p class="mb-1"><strong>Contato:</strong> ${patientData.contact || "Não informado"}</p><p class="mb-0"><strong>Profissional Principal:</strong> ${patientData.mainProfessional || "Não informado"}</p></div><button class="btn btn-sm btn-outline-secondary edit-patient-btn"><i class="bi bi-pencil"></i></button></div>`;
        const replacementsList = document.getElementById('replacements-list');
        replacementsList.innerHTML = '';
        if (patientData.replacements.length === 0) {
            replacementsList.innerHTML = `<div class="empty-list-message">Nenhuma reposição registrada para este paciente.</div>`;
        } else {
            patientData.replacements.forEach(repl => {
                const completedMinutes = repl.completedFractions.reduce((sum, f) => sum + f.duration, 0);
                const progressPercentage = repl.totalDuration > 0 ? (completedMinutes / repl.totalDuration) * 100 : 0;
                const isCompleted = completedMinutes >= repl.totalDuration;
                const originalDateFormatted = new Date(repl.originalDate + 'T00:00:00').toLocaleDateString('pt-BR');
                const collapseId = `replacement-collapse-${repl.id}`;
                const item = document.createElement('div');
                item.className = 'replacement-item';
                let fractionsHistoryHTML = '<ul class="fractions-history">';
                if (repl.completedFractions.length === 0) {
                    fractionsHistoryHTML += '<li>Nenhuma fração registrada.</li>';
                } else {
                    repl.completedFractions.forEach(fraction => {
                        const fractionDateFormatted = new Date(fraction.date + 'T00:00:00').toLocaleDateString('pt-BR');
                        fractionsHistoryHTML += `<li><span><i class="bi bi-check-circle text-success"></i> ${fraction.duration} min em ${fractionDateFormatted}</span><span>${fraction.professional}</span></li>`;
                    });
                }
                fractionsHistoryHTML += '</ul>';
                item.innerHTML = `<a class="replacement-summary" data-bs-toggle="collapse" href="#${collapseId}" role="button"><div class="d-flex justify-content-between align-items-start"><div><div class="replacement-summary-header">Sessão de ${originalDateFormatted}</div><div class="replacement-summary-details">com ${repl.originalProfessional} (${repl.totalDuration} min)</div></div></div><div class="progress-container"><div class="progress-bar ${isCompleted ? 'bg-success' : ''}" style="width: ${progressPercentage}%">${Math.round(progressPercentage)}%</div></div></a><div class="collapse replacement-details-body" id="${collapseId}"><h6>Histórico de Frações</h6>${fractionsHistoryHTML}<div class="replacement-item-actions"><button class="btn btn-sm btn-outline-primary register-fraction-btn" data-replacement-id="${repl.id}" ${isCompleted ? 'disabled' : ''}>Registrar Fração</button></div></div>`;
                replacementsList.appendChild(item);
            });
        }
    };
    
    const initSortable = () => {
        const boardToSort = workspace.boards.find(b => b.id === currentYear);
        if (!boardToSort) return;
        new Sortable(boardContent, { animation: 150, handle: '.list-header', filter: '.list-wrapper:has(#add-list-btn)', onEnd: (evt) => { const movedList = boardToSort.lists.splice(evt.oldIndex, 1)[0]; boardToSort.lists.splice(evt.newIndex, 0, movedList); } });
        document.querySelectorAll('#board-content .cards-container').forEach(container => {
            new Sortable(container, { group: 'shared-patients', animation: 150, onEnd: (evt) => { const patientId = parseInt(evt.item.dataset.patientId); const toListId = parseInt(evt.to.dataset.listId); const toList = boardToSort.lists.find(l => l.id === toListId); let movedPatient; for (const list of boardToSort.lists) { movedPatient = list.patients.find(p => p.id === patientId); if (movedPatient) break; } const hasPendingReplacements = movedPatient.replacements.some(r => { const completed = r.completedFractions.reduce((sum, f) => sum + f.duration, 0); return completed < r.totalDuration; }); if (toList.title.toLowerCase().includes('sem pendências') && hasPendingReplacements) { alert('Um paciente só pode ser movido para "Sem Pendências" quando todas as suas reposições estiverem 100% concluídas.'); renderBoard(searchBar.value); return; } const fromListId = parseInt(evt.from.dataset.listId); const fromList = boardToSort.lists.find(l => l.id === fromListId); const patientIndex = fromList.patients.findIndex(p => p.id === patientId); const patientToMove = fromList.patients.splice(patientIndex, 1)[0]; toList.patients.splice(evt.newIndex, 0, patientToMove); renderBoard(searchBar.value); } });
        });
    };

    // ---- EVENT LISTENERS ---- //
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        initializeApp();
    });

    logoutBtn.addEventListener('click', () => {
        showScreen('login-screen');
    });

    searchBar.addEventListener('input', e => {
        renderBoard(e.target.value);
    });

    yearSelectorMenu.addEventListener('click', e => {
        e.preventDefault();
        const target = e.target;
        if (target.matches('.dropdown-item[data-year]')) {
            const year = parseInt(target.dataset.year);
            if (year !== currentYear) { currentYear = year; renderYearSelector(); renderBoard(); }
        } else if (target.matches('#add-year-option')) {
            const latestYear = Math.max(...workspace.boards.map(b => b.id));
            const nextYear = latestYear > 0 ? latestYear + 1 : new Date().getFullYear() + 1;
            const digits = String(nextYear).split('');
            const digitSelectors = [document.getElementById('digit1'), document.getElementById('digit2'), document.getElementById('digit3'), document.getElementById('digit4')];
            digitSelectors[0].innerHTML = `<option>2</option>`;
            digitSelectors[1].innerHTML = `<option>0</option>`;
            [digitSelectors[2], digitSelectors[3]].forEach(sel => { sel.innerHTML = ''; for(let i = 0; i <= 9; i++) sel.innerHTML += `<option>${i}</option>`; });
            if(digits.length === 4) {
                digitSelectors[0].value = digits[0];
                digitSelectors[1].value = digits[1];
                digitSelectors[2].value = digits[2];
                digitSelectors[3].value = digits[3];
            }
            addYearModal.show();
        }
    });

    addYearForm.addEventListener('submit', e => {
        e.preventDefault();
        const year = [document.getElementById('digit1').value, document.getElementById('digit2').value, document.getElementById('digit3').value, document.getElementById('digit4').value].join('');
        const newYear = parseInt(year);
        if (workspace.boards.find(b => b.id === newYear)) { alert(`O board para o ano ${newYear} já existe.`); return; }
        workspace.boards.push({ id: newYear, name: String(newYear), lists: [{ id: Date.now() + 1, title: "Pacientes com Pendências", patients: [] },{ id: Date.now() + 2, title: "Pacientes sem Pendências", patients: [] }]});
        currentYear = newYear;
        renderYearSelector();
        renderBoard();
        addYearModal.hide();
    });

    boardContent.addEventListener('dblclick', e => {
        const headerSpan = e.target.closest('.list-header span');
        if (!headerSpan) return;
        const listWrapper = e.target.closest('.list-wrapper');
        const listId = parseInt(listWrapper.dataset.listId);
        const originalTitle = headerSpan.textContent.replace(/\s\(\d+\)$/, '').trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'list-header-input';
        input.value = originalTitle;
        headerSpan.style.display = 'none';
        headerSpan.parentElement.insertBefore(input, headerSpan);
        input.focus();
        input.select();
        const saveChanges = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== originalTitle) {
                const board = workspace.boards.find(b => b.id === currentYear);
                const list = board.lists.find(l => l.id === listId);
                if (list) { list.title = newTitle; }
            }
            renderBoard();
        };
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveChanges();
            else if (e.key === 'Escape') renderBoard();
        });
    });
    
    boardContent.addEventListener('click', e => {
        const addPatientBtn = e.target.closest('.add-patient-btn');
        if (addPatientBtn) { currentListIdForNewPatient = parseInt(addPatientBtn.dataset.listId); createPatientForm.reset(); createPatientModal.show(); return; }
        
        const cardElement = e.target.closest('.card-paciente[data-patient-id]');
        if (cardElement) { selectedPatientId = parseInt(cardElement.dataset.patientId); renderPatientDetails(); patientDetailsModal.show(); return; }
        
        if (e.target.matches('#add-list-btn')) { const title = prompt("Digite o título da nova coluna:"); const board = workspace.boards.find(b => b.id === currentYear); if (title && title.trim() && board) { board.lists.push({ id: Date.now(), title: title.trim(), patients: [] }); renderBoard(); } return; }
        
        const deleteListBtn = e.target.closest('.delete-list-btn');
        if (deleteListBtn) { const listWrapper = deleteListBtn.closest('.list-wrapper'); const listIdToDelete = parseInt(listWrapper.dataset.listId); const board = workspace.boards.find(b => b.id === currentYear); const listToDelete = board.lists.find(l => l.id === listIdToDelete); if (listToDelete && confirm(`Tem certeza que deseja excluir a coluna "${listToDelete.title}" e todos os seus pacientes?`)) { board.lists = board.lists.filter(list => list.id !== listIdToDelete); renderBoard(); } }
    });

    patientDetailsModalElement.addEventListener('click', e => {
        const registerBtn = e.target.closest('.register-fraction-btn');
        if (registerBtn) {
            selectedReplacementId = parseInt(registerBtn.dataset.replacementId);
            const board = workspace.boards.find(b => b.id === currentYear);
            let patient, replacement;
            for (const list of board.lists) { patient = list.patients.find(p => p.id === selectedPatientId); if (patient) { replacement = patient.replacements.find(r => r.id === selectedReplacementId); if (replacement) break; } }
            if (replacement) {
                const fractionTypeSelect = document.getElementById('fraction_type');
                fractionTypeSelect.innerHTML = '';
                if (replacement.completedFractions.length === 0) {
                    fractionTypeSelect.innerHTML += `<option value="10">Parcial (10 min)</option>`;
                    fractionTypeSelect.innerHTML += `<option value="50">Completa (50 min)</option>`;
                } else {
                    fractionTypeSelect.innerHTML += `<option value="10">Parcial (10 min)</option>`;
                }
                document.getElementById('fraction_date').valueAsDate = new Date();
                document.getElementById('fraction_professional').value = patient.mainProfessional || '';
                registerFractionModal.show();
            }
        }

        const editBtn = e.target.closest('.edit-patient-btn');
        if (editBtn) {
            editingPatientId = selectedPatientId;
            const board = workspace.boards.find(b => b.id === currentYear);
            let patientData;
            for (const list of board.lists) { patientData = list.patients.find(p => p.id === editingPatientId); if (patientData) break; }
            if (patientData) {
                createPatientModalTitle.textContent = 'Editar Paciente';
                createPatientSubmitBtn.textContent = 'Salvar Alterações';
                document.getElementById('patientName').value = patientData.name;
                document.getElementById('patientContact').value = patientData.contact || '';
                document.getElementById('mainProfessional').value = patientData.mainProfessional || '';
                patientDetailsModal.hide();
                createPatientModal.show();
            }
        }
    });

    createPatientForm.addEventListener('submit', e => {
        e.preventDefault();
        const board = workspace.boards.find(b => b.id === currentYear);
        if (!board) return;
        if (editingPatientId) {
            let patientToUpdate;
            for (const list of board.lists) { patientToUpdate = list.patients.find(p => p.id === editingPatientId); if (patientToUpdate) break; }
            if (patientToUpdate) {
                patientToUpdate.name = document.getElementById('patientName').value.trim();
                patientToUpdate.contact = document.getElementById('patientContact').value.trim();
                patientToUpdate.mainProfessional = document.getElementById('mainProfessional').value.trim();
            }
        } else {
            const newPatientData = { id: Date.now(), name: document.getElementById('patientName').value.trim(), contact: document.getElementById('patientContact').value.trim(), mainProfessional: document.getElementById('mainProfessional').value.trim(), replacements: [] };
            const list = board.lists.find(l => l.id === currentListIdForNewPatient);
            list.patients.push(newPatientData);
        }
        renderBoard();
        createPatientModal.hide();
        editingPatientId = null;
        createPatientModalTitle.textContent = 'Criar Card de Paciente';
        createPatientSubmitBtn.textContent = 'Criar Paciente';
        createPatientForm.reset();
    });

    showAddReplacementModalBtn.addEventListener('click', () => {
        addReplacementForm.reset();
        addReplacementModal.show();
    });

    addReplacementForm.addEventListener('submit', e => {
        e.preventDefault();
        if(!selectedPatientId) return;
        const totalDuration = 50;
        const newReplacement = { id: Date.now(), originalProfessional: document.getElementById('repl_originalProfessional').value.trim(), originalDate: document.getElementById('repl_originalDate').value, totalDuration: totalDuration, notes: document.getElementById('repl_notes').value.trim(), completedFractions: [] };
        const board = workspace.boards.find(b => b.id === currentYear);
        let patientData;
        for (const list of board.lists) { patientData = list.patients.find(p => p.id === selectedPatientId); if (patientData) break; }
        patientData.replacements.push(newReplacement);
        renderPatientDetails();
        renderBoard();
        addReplacementModal.hide();
    });
    
    registerFractionForm.addEventListener('submit', e => {
        e.preventDefault();
        if (!selectedPatientId || !selectedReplacementId) return;
        const durationToAdd = parseInt(document.getElementById('fraction_type').value);
        const newFraction = { date: document.getElementById('fraction_date').value, professional: document.getElementById('fraction_professional').value.trim(), duration: durationToAdd };
        if (!newFraction.date || !newFraction.professional) { alert("Por favor, preencha a data e o profissional."); return; }
        const board = workspace.boards.find(b => b.id === currentYear);
        let patientData;
        for (const list of board.lists) { patientData = list.patients.find(p => p.id === selectedPatientId); if (patientData) break; }
        const replacementToUpdate = patientData.replacements.find(r => r.id === selectedReplacementId);
        const completedMinutes = replacementToUpdate.completedFractions.reduce((sum, f) => sum + f.duration, 0);
        if ((completedMinutes + durationToAdd) > replacementToUpdate.totalDuration) { alert("A soma das frações não pode ultrapassar a duração total da sessão."); return; }
        replacementToUpdate.completedFractions.push(newFraction);
        registerFractionModal.hide();
        renderPatientDetails();
        renderBoard();
    });

    deletePatientBtn.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja excluir este paciente e todo o seu histórico de reposições?")) {
            if (selectedPatientId) {
                const board = workspace.boards.find(b => b.id === currentYear);
                board.lists.forEach(list => { list.patients = list.patients.filter(p => p.id !== selectedPatientId); });
                renderBoard();
                patientDetailsModal.hide();
                selectedPatientId = null;
            }
        }
    });

    // ---- INICIALIZAÇÃO ---- //
    showScreen('login-screen');
});