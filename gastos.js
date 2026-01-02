class ExpenseController {
    constructor() {
        this.storageKey = 'expenseController';
        this.categories = [
            { id: 'custos_fixos', name: 'Custos fixos', percentage: 30, color: 'bg-red-500' },
            { id: 'conforto', name: 'Conforto', percentage: 15, color: 'bg-blue-500' },
            { id: 'metas', name: 'Metas', percentage: 15, color: 'bg-green-500' },
            { id: 'prazeres', name: 'Prazeres', percentage: 10, color: 'bg-pink-500' },
            { id: 'liberdade_financeira', name: 'Liberdade financeira', percentage: 25, color: 'bg-yellow-500' },
            { id: 'conhecimento', name: 'Conhecimento', percentage: 5, color: 'bg-purple-500' }
        ];
        this.expenses = [];
        this.monthlyIncome = 5000;
        this.currentMonth = new Date().getMonth() + 1;
        this.currentYear = new Date().getFullYear();
        
        this.pdfLibsLoaded = false;
        this.isExportingPdf = false;
        
        this.initializeYearSelect();
        this.loadFromStorage();
        this.initializeEventListeners();
        this.initializeCurrencyInputs();
        this.render();
    }

    initializeYearSelect() {
        const yearSelect = document.getElementById('yearSelect');
        const currentYear = new Date().getFullYear();
        for (let year = currentYear - 2; year <= currentYear + 2; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                
                if (data.categories) {
                    this.categories = data.categories;
                }
                if (data.expenses) {
                    this.expenses = data.expenses;
                }
                if (data.monthlyIncome !== undefined) {
                    this.monthlyIncome = data.monthlyIncome;
                    document.getElementById('monthlyIncome').value = this.formatCurrencyInput(data.monthlyIncome);
                }
                if (data.currentMonth) {
                    this.currentMonth = data.currentMonth;
                    document.getElementById('monthSelect').value = String(data.currentMonth).padStart(2, '0');
                }
                if (data.currentYear) {
                    this.currentYear = data.currentYear;
                    document.getElementById('yearSelect').value = data.currentYear;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar dados do localStorage:', e);
        }
    }

    saveToStorage() {
        try {
            const data = {
                categories: this.categories,
                expenses: this.expenses,
                monthlyIncome: this.monthlyIncome,
                currentMonth: this.currentMonth,
                currentYear: this.currentYear
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Erro ao salvar dados no localStorage:', e);
        }
    }

    initializeEventListeners() {
        // Renda mensal
        document.getElementById('monthlyIncome').addEventListener('blur', (e) => {
            this.monthlyIncome = this.parseCurrency(e.target.value);
            this.saveToStorage();
            this.render();
        });

        // Mês e ano
        document.getElementById('monthSelect').addEventListener('change', (e) => {
            this.currentMonth = parseInt(e.target.value);
            this.saveToStorage();
            this.filterExpensesByPeriod();
            this.render();
        });

        document.getElementById('yearSelect').addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.saveToStorage();
            this.filterExpensesByPeriod();
            this.render();
        });

        // Formulário de gastos
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Limpar gastos
        document.getElementById('clearExpenses').addEventListener('click', () => {
            if (confirm('Tem certeza que deseja limpar todos os gastos do período atual?')) {
                this.clearCurrentPeriodExpenses();
            }
        });

        // Exportar PDF
        document.getElementById('exportPdf').addEventListener('click', () => {
            this.exportToPdf();
        });
    }

    async loadPdfLibraries() {
        if (this.pdfLibsLoaded) return;

        if (window.jspdf?.jsPDF && typeof window.jspdf?.jsPDF === 'function' && typeof window.jspdf?.jsPDF?.API?.autoTable === 'function') {
            this.pdfLibsLoaded = true;
            return;
        }

        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const existing = document.querySelector(`script[src="${src}"]`);
                if (existing) {
                    existing.addEventListener('load', () => resolve());
                    existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)));
                    return;
                }

                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
                document.head.appendChild(script);
            });
        };

        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');

        // Confirma que a API ficou disponível
        if (!window.jspdf?.jsPDF) {
            throw new Error('jsPDF não foi carregado corretamente.');
        }

        this.pdfLibsLoaded = true;
    }

    initializeCurrencyInputs() {
        const currencyInputs = document.querySelectorAll('.currency-input');
        currencyInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^\d.,]/g, '');
                e.target.value = value;
            });

            input.addEventListener('blur', (e) => {
                const value = this.parseCurrency(e.target.value);
                e.target.value = this.formatCurrencyInput(value);
            });

            input.addEventListener('focus', (e) => {
                const value = this.parseCurrency(e.target.value);
                if (value > 0) {
                    e.target.value = value.toString().replace('.', ',');
                }
                e.target.select();
            });
        });
    }

    parseCurrency(value) {
        if (!value || value === '') return 0;
        const cleanValue = value.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanValue) || 0;
    }

    formatCurrencyInput(value) {
        if (isNaN(value) || value === 0) return '0,00';
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatCurrency(value) {
        return 'R$ ' + this.formatCurrencyInput(value);
    }

    render() {
        this.renderMetas();
        this.renderResumo();
        this.renderExpenseCategory();
        this.renderExpensesList();
    }

    renderMetas() {
        const container = document.getElementById('metasContainer');
        container.innerHTML = this.categories.map(cat => `
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2 flex-1">
                    <div class="w-3 h-3 rounded-full ${cat.color}"></div>
                    <span class="text-gray-300">${cat.name}</span>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" 
                        class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-right text-white percentage-input"
                        data-category="${cat.id}"
                        value="${cat.percentage}"
                        min="0" max="100" step="1">
                    <span class="text-gray-400">%</span>
                </div>
            </div>
        `).join('');

        // Event listeners para inputs de porcentagem
        container.querySelectorAll('.percentage-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const categoryId = e.target.dataset.category;
                const newValue = parseInt(e.target.value) || 0;
                this.updateCategoryPercentage(categoryId, newValue);
            });
        });

        this.updateTotalPercentage();
    }

    updateCategoryPercentage(categoryId, newValue) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) {
            category.percentage = Math.max(0, Math.min(100, newValue));
            this.saveToStorage();
            this.updateTotalPercentage();
            this.renderResumo();
        }
    }

    updateTotalPercentage() {
        const total = this.categories.reduce((sum, cat) => sum + cat.percentage, 0);
        const totalElement = document.getElementById('totalPercentage');
        const warningElement = document.getElementById('percentageWarning');
        
        totalElement.textContent = `${total}%`;
        
        if (total === 100) {
            totalElement.classList.remove('text-red-500');
            totalElement.classList.add('text-green-500');
            warningElement.classList.add('hidden');
        } else {
            totalElement.classList.remove('text-green-500');
            totalElement.classList.add('text-red-500');
            warningElement.classList.remove('hidden');
        }
    }

    renderResumo() {
        const tbody = document.getElementById('resumoTable');
        const currentExpenses = this.getCurrentPeriodExpenses();
        
        let totalGasto = 0;
        let totalDevoGastar = 0;

        tbody.innerHTML = this.categories.map(cat => {
            const devoGastar = (this.monthlyIncome * cat.percentage) / 100;
            const valorGasto = currentExpenses
                .filter(exp => exp.categoryId === cat.id)
                .reduce((sum, exp) => sum + exp.value, 0);
            const utilizado = devoGastar > 0 ? (valorGasto / devoGastar) * 100 : 0;
            const restante = devoGastar - valorGasto;

            totalGasto += valorGasto;
            totalDevoGastar += devoGastar;

            const utilizadoClass = utilizado > 100 ? 'text-red-500' : utilizado > 80 ? 'text-yellow-500' : 'text-green-500';
            const restanteClass = restante < 0 ? 'text-red-500' : 'text-green-500';

            return `
                <tr class="border-b border-gray-700 hover:bg-gray-700/50">
                    <td class="py-3 px-2">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full ${cat.color}"></div>
                            ${cat.name}
                        </div>
                    </td>
                    <td class="text-right py-3 px-2">${this.formatCurrency(valorGasto)}</td>
                    <td class="text-right py-3 px-2">${this.formatCurrency(devoGastar)}</td>
                    <td class="text-right py-3 px-2 ${utilizadoClass}">${utilizado.toFixed(2)}%</td>
                    <td class="text-right py-3 px-2 ${restanteClass}">${this.formatCurrency(restante)}</td>
                </tr>
            `;
        }).join('');

        // Atualiza totais
        const totalUtilizado = totalDevoGastar > 0 ? (totalGasto / totalDevoGastar) * 100 : 0;
        const totalRestante = totalDevoGastar - totalGasto;

        document.getElementById('totalGasto').textContent = this.formatCurrency(totalGasto);
        document.getElementById('totalDevoGastar').textContent = this.formatCurrency(totalDevoGastar);
        document.getElementById('totalUtilizado').textContent = `${totalUtilizado.toFixed(2)}%`;
        document.getElementById('totalRestante').textContent = this.formatCurrency(totalRestante);

        // Classes de cor para totais
        const totalUtilizadoEl = document.getElementById('totalUtilizado');
        totalUtilizadoEl.className = 'text-right py-3 px-2 ' + (totalUtilizado > 100 ? 'text-red-500' : totalUtilizado > 80 ? 'text-yellow-500' : 'text-green-500');

        const totalRestanteEl = document.getElementById('totalRestante');
        totalRestanteEl.className = 'text-right py-3 px-2 ' + (totalRestante < 0 ? 'text-red-500' : 'text-green-500');
    }

    renderExpenseCategory() {
        const select = document.getElementById('expenseCategory');
        select.innerHTML = this.categories.map(cat => 
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');
    }

    renderExpensesList() {
        const container = document.getElementById('expensesList');
        const currentExpenses = this.getCurrentPeriodExpenses();

        if (currentExpenses.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum gasto lançado ainda</p>';
            return;
        }

        // Ordena por data (mais recente primeiro)
        const sortedExpenses = [...currentExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = sortedExpenses.map(exp => {
            const category = this.categories.find(c => c.id === exp.categoryId);
            return `
                <div class="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full ${category?.color || 'bg-gray-500'}"></div>
                        <div>
                            <p class="font-medium">${exp.description}</p>
                            <p class="text-sm text-gray-400">${category?.name || 'Categoria'} • ${new Date(exp.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="font-semibold text-red-400">- ${this.formatCurrency(exp.value)}</span>
                        <button class="text-gray-400 hover:text-red-500 transition" onclick="expenseController.deleteExpense('${exp.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getCurrentPeriodExpenses() {
        return this.expenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate.getMonth() + 1 === this.currentMonth && 
                   expDate.getFullYear() === this.currentYear;
        });
    }

    filterExpensesByPeriod() {
        // Apenas re-renderiza, os filtros são aplicados em getCurrentPeriodExpenses
    }

    addExpense() {
        const categoryId = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value.trim();
        const value = this.parseCurrency(document.getElementById('expenseValue').value);

        if (!description) {
            alert('Por favor, insira uma descrição para o gasto.');
            return;
        }

        if (value <= 0) {
            alert('Por favor, insira um valor válido.');
            return;
        }

        const expense = {
            id: Date.now().toString(),
            categoryId,
            description,
            value,
            date: new Date(this.currentYear, this.currentMonth - 1, new Date().getDate()).toISOString()
        };

        this.expenses.push(expense);
        this.saveToStorage();
        this.render();

        // Limpa o formulário
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseValue').value = '0,00';
    }

    deleteExpense(expenseId) {
        this.expenses = this.expenses.filter(exp => exp.id !== expenseId);
        this.saveToStorage();
        this.render();
    }

    clearCurrentPeriodExpenses() {
        this.expenses = this.expenses.filter(exp => {
            const expDate = new Date(exp.date);
            return !(expDate.getMonth() + 1 === this.currentMonth && 
                     expDate.getFullYear() === this.currentYear);
        });
        this.saveToStorage();
        this.render();
    }

    async loadPdfLibraries() {
        if (this.pdfLibsLoaded) return;

        // Se já estiverem disponíveis (por algum motivo), só marca como carregado.
        if (window.jspdf?.jsPDF && typeof window.jspdf.jsPDF === 'function' && typeof window.jspdf?.jsPDF?.API?.autoTable === 'function') {
            this.pdfLibsLoaded = true;
            return;
        }

        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const existing = document.querySelector(`script[src="${src}"]`);
                if (existing) {
                    if (existing.dataset.loaded === 'true') {
                        resolve();
                        return;
                    }
                    existing.addEventListener('load', () => resolve());
                    existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)));
                    return;
                }

                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = () => {
                    script.dataset.loaded = 'true';
                    resolve();
                };
                script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
                document.head.appendChild(script);
            });
        };

        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');

        if (!window.jspdf?.jsPDF) {
            throw new Error('jsPDF não foi carregado corretamente.');
        }

        this.pdfLibsLoaded = true;
    }

    getMonthName(month) {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return months[month - 1];
    }

    async exportToPdf() {
        if (this.isExportingPdf) return;
        this.isExportingPdf = true;

        const exportButton = document.getElementById('exportPdf');
        const originalButtonHtml = exportButton?.innerHTML;
        if (exportButton) {
            exportButton.disabled = true;
            exportButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gerando...';
            exportButton.classList.add('opacity-75', 'cursor-not-allowed');
        }

        try {
            await this.loadPdfLibraries();

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
        
        const currentExpenses = this.getCurrentPeriodExpenses();
        const monthName = this.getMonthName(this.currentMonth);
        const title = `Relatório de Gastos - ${monthName}/${this.currentYear}`;
        
        // Configurações
        const pageWidth = doc.internal.pageSize.getWidth();
        let yPos = 20;
        
        // Título
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;
        
        // Informações gerais
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Renda Mensal: ${this.formatCurrency(this.monthlyIncome)}`, 14, yPos);
        yPos += 8;
        doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 14, yPos);
        yPos += 15;
        
        // Tabela de Resumo por Categoria
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo por Categoria', 14, yPos);
        yPos += 8;
        
        const resumoData = this.categories.map(cat => {
            const devoGastar = (this.monthlyIncome * cat.percentage) / 100;
            const valorGasto = currentExpenses
                .filter(exp => exp.categoryId === cat.id)
                .reduce((sum, exp) => sum + exp.value, 0);
            const utilizado = devoGastar > 0 ? (valorGasto / devoGastar) * 100 : 0;
            const restante = devoGastar - valorGasto;
            
            return [
                cat.name,
                `${cat.percentage}%`,
                this.formatCurrency(valorGasto),
                this.formatCurrency(devoGastar),
                `${utilizado.toFixed(1)}%`,
                this.formatCurrency(restante)
            ];
        });
        
        // Calcular totais
        let totalGasto = 0;
        let totalDevoGastar = 0;
        this.categories.forEach(cat => {
            const devoGastar = (this.monthlyIncome * cat.percentage) / 100;
            const valorGasto = currentExpenses
                .filter(exp => exp.categoryId === cat.id)
                .reduce((sum, exp) => sum + exp.value, 0);
            totalGasto += valorGasto;
            totalDevoGastar += devoGastar;
        });
        const totalUtilizado = totalDevoGastar > 0 ? (totalGasto / totalDevoGastar) * 100 : 0;
        const totalRestante = totalDevoGastar - totalGasto;
        
        // Adicionar linha de total
        resumoData.push([
            'TOTAL',
            '100%',
            this.formatCurrency(totalGasto),
            this.formatCurrency(totalDevoGastar),
            `${totalUtilizado.toFixed(1)}%`,
            this.formatCurrency(totalRestante)
        ]);
        
        doc.autoTable({
            startY: yPos,
            head: [['Categoria', 'Meta %', 'Gasto', 'Orçamento', 'Utilizado', 'Restante']],
            body: resumoData,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            footStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'center' },
                5: { halign: 'right' }
            },
            didParseCell: function(data) {
                // Destacar linha de total
                if (data.row.index === resumoData.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [229, 231, 235];
                }
            }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
        
        // Lista de Gastos Detalhados
        if (currentExpenses.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Gastos Detalhados', 14, yPos);
            yPos += 8;
            
            const gastosData = currentExpenses
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(exp => {
                    const category = this.categories.find(c => c.id === exp.categoryId);
                    return [
                        new Date(exp.date).toLocaleDateString('pt-BR'),
                        category?.name || 'N/A',
                        exp.description,
                        this.formatCurrency(exp.value)
                    ];
                });
            
            doc.autoTable({
                startY: yPos,
                head: [['Data', 'Categoria', 'Descrição', 'Valor']],
                body: gastosData,
                theme: 'striped',
                headStyles: { fillColor: [147, 51, 234], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 80 },
                    3: { halign: 'right', cellWidth: 30 }
                }
            });
        } else {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.text('Nenhum gasto lançado neste período.', 14, yPos);
        }
        
        // Rodapé com link do site
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Linha separadora
            doc.setDrawColor(200, 200, 200);
            doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);
            
            // Link do site
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(59, 130, 246);
            doc.textWithLink('igorsilvadev.com/finance', 14, pageHeight - 14, { url: 'https://igorsilvadev.com/finance/' });
            
            // Informações de página
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(128, 128, 128);
            doc.setFontSize(8);
            doc.text(
                `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
                pageWidth - 14,
                pageHeight - 14,
                { align: 'right' }
            );
        }
        
        // Resetar cor do texto
        doc.setTextColor(0, 0, 0);
        
        // Salvar PDF
        const fileName = `relatorio-gastos-${monthName.toLowerCase()}-${this.currentYear}.pdf`;
        doc.save(fileName);
        } catch (err) {
            console.error(err);
            alert('Não foi possível gerar o PDF. Verifique sua conexão e tente novamente.');
        } finally {
            this.isExportingPdf = false;
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerHTML = originalButtonHtml;
                exportButton.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    }
}

// Inicializa o controlador quando o DOM estiver carregado
let expenseController;
document.addEventListener('DOMContentLoaded', () => {
    expenseController = new ExpenseController();
});
