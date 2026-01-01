class CompoundInterestCalculator {
    constructor() {
        this.chart = null;
        this.storageKey = 'compoundInterestCalculator';
        this.loadFromStorage();
        this.initializeEventListeners();
        this.initializeCurrencyInputs();
    }

    // Carrega valores salvos do localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                
                if (data.initialAmount !== undefined) {
                    document.getElementById('initialAmount').value = data.initialAmount;
                }
                if (data.interestRate !== undefined) {
                    document.getElementById('interestRate').value = data.interestRate;
                }
                if (data.rateType !== undefined) {
                    document.getElementById('rateType').value = data.rateType;
                }
                if (data.monthlyContribution !== undefined) {
                    document.getElementById('monthlyContribution').value = data.monthlyContribution;
                }
                if (data.period !== undefined) {
                    document.getElementById('period').value = data.period;
                }
                if (data.periodType !== undefined) {
                    document.getElementById('periodType').value = data.periodType;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar dados do localStorage:', e);
        }
    }

    // Salva valores no localStorage
    saveToStorage() {
        try {
            const data = {
                initialAmount: document.getElementById('initialAmount').value,
                interestRate: document.getElementById('interestRate').value,
                rateType: document.getElementById('rateType').value,
                monthlyContribution: document.getElementById('monthlyContribution').value,
                period: document.getElementById('period').value,
                periodType: document.getElementById('periodType').value
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Erro ao salvar dados no localStorage:', e);
        }
    }

    initializeEventListeners() {
        const form = document.getElementById('calculatorForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.calculate();
        });

        // Auto-calcular quando os valores mudarem (exceto currency inputs que têm handler próprio)
        const inputs = form.querySelectorAll('input:not(.currency-input)');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.saveToStorage();
                if (this.validateInputs()) {
                    this.calculate();
                }
            });
        });

        // Auto-calcular quando os selects mudarem
        const selects = form.querySelectorAll('select');
        selects.forEach(select => {
            select.addEventListener('change', () => {
                this.saveToStorage();
                if (this.validateInputs()) {
                    this.calculate();
                }
            });
        });
    }

    initializeCurrencyInputs() {
        const currencyInputs = document.querySelectorAll('.currency-input');
        currencyInputs.forEach(input => {
            // Formata o valor inicial
            const initialValue = this.parseCurrency(input.value);
            input.value = this.formatCurrencyInput(initialValue);

            // Evento de input - não formata enquanto digita, apenas valida
            input.addEventListener('input', (e) => {
                // Remove caracteres inválidos, mantém apenas números, vírgula e ponto
                let value = e.target.value.replace(/[^\d.,]/g, '');
                e.target.value = value;
                
                // Salva e recalcula
                this.saveToStorage();
                if (this.validateInputs()) {
                    this.calculate();
                }
            });

            // Evento de blur para formatar quando sair do campo
            input.addEventListener('blur', (e) => {
                const value = this.parseCurrency(e.target.value);
                e.target.value = this.formatCurrencyInput(value);
            });
            
            // Evento de focus para limpar formatação ao entrar no campo
            input.addEventListener('focus', (e) => {
                const value = this.parseCurrency(e.target.value);
                if (value > 0) {
                    // Mostra valor sem formatação de milhar para facilitar edição
                    e.target.value = value.toString().replace('.', ',');
                }
                e.target.select(); // Seleciona todo o texto
            });
        });
    }

    // Converte string formatada para número (ex: "1.234,56" -> 1234.56)
    parseCurrency(value) {
        if (!value || value === '') return 0;
        // Remove pontos de milhar e troca vírgula por ponto
        const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanValue) || 0;
    }

    // Formata número para exibição no input (ex: 1234.56 -> "1.234,56")
    formatCurrencyInput(value) {
        if (isNaN(value) || value === 0) return '0,00';
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    validateInputs() {
        const initialAmount = this.parseCurrency(document.getElementById('initialAmount').value);
        const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
        const monthlyContribution = this.parseCurrency(document.getElementById('monthlyContribution').value);
        const period = parseInt(document.getElementById('period').value) || 0;

        return initialAmount >= 0 && interestRate >= 0 && monthlyContribution >= 0 && period > 0;
    }

    calculate() {
        const initialAmount = this.parseCurrency(document.getElementById('initialAmount').value);
        const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
        const rateType = document.getElementById('rateType').value;
        const monthlyContribution = this.parseCurrency(document.getElementById('monthlyContribution').value);
        let period = parseInt(document.getElementById('period').value) || 0;
        const periodType = document.getElementById('periodType').value;

        if (period <= 0) {
            this.showError('O período deve ser maior que zero');
            return;
        }

        // Converte período para meses se estiver em anos
        const periodInMonths = periodType === 'years' ? period * 12 : period;

        // Converte taxa para mensal usando taxa equivalente (juros compostos)
        let monthlyRate;
        if (rateType === 'annual') {
            // Taxa equivalente: (1 + taxa_anual)^(1/12) - 1
            monthlyRate = Math.pow(1 + interestRate / 100, 1 / 12) - 1;
        } else {
            monthlyRate = interestRate / 100;
        }

        const results = this.generateProjection(initialAmount, monthlyRate, monthlyContribution, periodInMonths);
        
        this.updateSummary(results);
        this.updateChart(results, periodType);
        this.updateTable(results, periodType);
    }

    generateProjection(initialAmount, monthlyRate, monthlyContribution, period) {
        const results = [];
        let balance = initialAmount;
        let totalInvested = initialAmount;

        for (let month = 1; month <= period; month++) {
            const previousBalance = balance;
            
            // Calcula juros sobre o saldo anterior (antes do aporte)
            const monthlyInterest = balance * monthlyRate;
            
            // Aplica juros primeiro
            balance = balance + monthlyInterest;
            
            // Depois adiciona o aporte
            balance = balance + monthlyContribution;
            totalInvested += monthlyContribution;

            results.push({
                month: month,
                contribution: monthlyContribution,
                previousBalance: previousBalance,
                monthlyInterest: monthlyInterest,
                finalBalance: balance,
                totalInvested: totalInvested,
                totalInterest: balance - totalInvested
            });
        }

        return results;
    }

    updateSummary(results) {
        if (results.length === 0) return;

        const lastResult = results[results.length - 1];
        
        document.getElementById('totalInvested').textContent = this.formatCurrency(lastResult.totalInvested);
        document.getElementById('totalInterest').textContent = this.formatCurrency(lastResult.totalInterest);
        document.getElementById('finalValue').textContent = this.formatCurrency(lastResult.finalBalance);
        
        document.getElementById('summaryResults').classList.remove('hidden');
    }

    updateChart(results, periodType) {
        const ctx = document.getElementById('growthChart').getContext('2d');
        
        let labels, investedData, balanceData, interestData;
        
        if (periodType === 'years') {
            // Agrupa por ano (a cada 12 meses)
            const yearlyResults = results.filter((r, i) => (i + 1) % 12 === 0 || i === results.length - 1);
            labels = yearlyResults.map((r, i) => `Ano ${Math.ceil(r.month / 12)}`);
            investedData = yearlyResults.map(r => r.totalInvested);
            balanceData = yearlyResults.map(r => r.finalBalance);
            interestData = yearlyResults.map(r => r.totalInterest);
        } else {
            labels = results.map(r => `Mês ${r.month}`);
            investedData = results.map(r => r.totalInvested);
            balanceData = results.map(r => r.finalBalance);
            interestData = results.map(r => r.totalInterest);
        }

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Investido',
                        data: investedData,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Valor Final',
                        data: balanceData,
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Juros Acumulados',
                        data: interestData,
                        borderColor: 'rgb(245, 158, 11)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            color: '#d1d5db'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += 'R$ ' + context.parsed.y.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Período',
                            color: '#9ca3af'
                        },
                        ticks: {
                            maxTicksLimit: 12,
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Valor (R$)',
                            color: '#9ca3af'
                        },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return 'R$ ' + value.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                });
                            }
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    updateTable(results, periodType) {
        const tableBody = document.getElementById('resultsTable');
        const tableTitle = document.getElementById('tableTitle');
        const tableHeader = document.getElementById('tableHeader');
        
        // Atualiza título e cabeçalho da tabela conforme o tipo de período
        const periodLabel = periodType === 'years' ? 'Ano' : 'Mês';
        const periodLabelPlural = periodType === 'years' ? 'Anual' : 'Mensal';
        const interestLabel = periodType === 'years' ? 'Juros do Ano' : 'Juros do Mês';
        
        tableTitle.innerHTML = `<i class="fas fa-table text-purple-500 mr-2"></i>Evolução ${periodLabelPlural}`;
        tableHeader.innerHTML = `
            <tr class="border-b-2 border-gray-700">
                <th class="text-left py-2 px-2 font-semibold text-gray-300">${periodLabel}</th>
                <th class="text-right py-2 px-2 font-semibold text-gray-300">Aporte</th>
                <th class="text-right py-2 px-2 font-semibold text-gray-300">Saldo Anterior</th>
                <th class="text-right py-2 px-2 font-semibold text-gray-300">${interestLabel}</th>
                <th class="text-right py-2 px-2 font-semibold text-gray-300">Saldo Final</th>
            </tr>
        `;
        
        if (results.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-gray-500">
                        Preencha os parâmetros e clique em "Calcular" para ver os resultados
                    </td>
                </tr>
            `;
            return;
        }

        let displayResults;
        
        if (periodType === 'years') {
            // Agrupa por ano - mostra o resultado ao final de cada ano
            displayResults = results.filter((r, i) => (i + 1) % 12 === 0);
            // Se o último resultado não for múltiplo de 12, adiciona
            if (results.length % 12 !== 0) {
                displayResults.push(results[results.length - 1]);
            }
        } else {
            // Mostra apenas os primeiros 12 meses e o último mês
            displayResults = results.slice(0, 12);
            if (results.length > 12) {
                displayResults.push(results[results.length - 1]);
            }
        }

        tableBody.innerHTML = displayResults.map((result, index) => {
            const periodNumber = periodType === 'years' ? Math.ceil(result.month / 12) : result.month;
            const contribution = periodType === 'years' ? result.contribution * 12 : result.contribution;
            
            // Calcula juros do período (ano ou mês)
            let periodInterest = result.monthlyInterest;
            if (periodType === 'years') {
                // Para anos, calcula o total de juros do ano
                const startMonth = (Math.ceil(result.month / 12) - 1) * 12;
                const endMonth = result.month;
                periodInterest = 0;
                for (let i = startMonth; i < endMonth && i < results.length; i++) {
                    periodInterest += results[i].monthlyInterest;
                }
            }
            
            // Saldo anterior do período
            let previousBalance = result.previousBalance;
            if (periodType === 'years' && index > 0) {
                const prevYearEnd = (Math.ceil(result.month / 12) - 1) * 12 - 1;
                if (prevYearEnd >= 0 && prevYearEnd < results.length) {
                    previousBalance = results[prevYearEnd].finalBalance;
                }
            }
            
            if (periodType === 'months' && results.length > 12 && index === 12) {
                return `
                    <tr class="border-t-2 border-gray-600">
                        <td class="text-center py-2 px-2 font-semibold text-gray-400">...</td>
                        <td class="text-center py-2 px-2 text-gray-400">...</td>
                        <td class="text-center py-2 px-2 text-gray-400">...</td>
                        <td class="text-center py-2 px-2 text-gray-400">...</td>
                        <td class="text-center py-2 px-2 text-gray-400">...</td>
                    </tr>
                    <tr class="border-t-2 border-gray-600 bg-gray-700">
                        <td class="text-left py-2 px-2 font-semibold">${periodLabel} ${periodNumber}</td>
                        <td class="text-right py-2 px-2">${this.formatCurrency(contribution)}</td>
                        <td class="text-right py-2 px-2">${this.formatCurrency(previousBalance)}</td>
                        <td class="text-right py-2 px-2 text-green-500 font-semibold">${this.formatCurrency(periodInterest)}</td>
                        <td class="text-right py-2 px-2 font-semibold text-blue-400">${this.formatCurrency(result.finalBalance)}</td>
                    </tr>
                `;
            }

            return `
                <tr class="border-b border-gray-700 hover:bg-gray-700/50">
                    <td class="text-left py-2 px-2 font-medium">${periodLabel} ${periodNumber}</td>
                    <td class="text-right py-2 px-2">${this.formatCurrency(contribution)}</td>
                    <td class="text-right py-2 px-2">${this.formatCurrency(previousBalance)}</td>
                    <td class="text-right py-2 px-2 text-green-500">${this.formatCurrency(periodInterest)}</td>
                    <td class="text-right py-2 px-2 font-semibold">${this.formatCurrency(result.finalBalance)}</td>
                </tr>
            `;
        }).join('');
    }

    formatCurrency(value) {
        return 'R$ ' + value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    showError(message) {
        // Implementar notificação de erro se necessário
        console.error(message);
    }
}

// Inicializa a calculadora quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new CompoundInterestCalculator();
});
