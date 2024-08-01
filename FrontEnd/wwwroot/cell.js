export default class CellManager {
    constructor(dataManager,uiManager) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.selectedCells = [];
        this.copiedCells = null;

        this.copySelectedCells = this.copySelectedCells.bind(this);
        this.pasteCells = this.pasteCells.bind(this);
        this.updateSelectedCells = this.updateSelectedCells.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.handlePaste = this.handlePaste.bind(this);

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('copy', this.handleCopy);
        document.addEventListener('paste', this.handlePaste);
    }

    handleKeyDown(event) {
        if (event.ctrlKey && event.key === 'c') {
            this.copySelectedCells();
            console.log('Ctrl + C pressed: Cells copied');
        } else if (event.ctrlKey && event.key === 'v') {
            this.pasteCells();
            console.log('Ctrl + V pressed: Cells pasted');
        }
    }

    handleCopy(event) {
        if (this.selectedCells.length > 0) {
            const copiedData = this.selectedCells.map(({ row, col }) => {
                const header = this.dataManager.headers[col];
                console.log(`Determined cell: row=${row}, col=${col}, header=${header}`);
                return this.dataManager.parsedData[row][header];
            });

            const copiedText = copiedData.join('\t');

            event.preventDefault();

            event.clipboardData.setData('text/plain', copiedText);
            console.log("Copied to clipboard:", copiedText);
        }
    }

    async handlePaste(event) {
        const clipboardData = event.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('text');

        if (pastedData && this.selectedCells.length > 0) {
            event.preventDefault();

            const pastedRows = pastedData.split('\n').map(row => row.split('\t'));
            const rowCount = pastedRows.length;
            const colCount = pastedRows[0].length;

            if (rowCount > 0 && colCount > 0) {
                for (let i = 0; i < rowCount; i++) {
                    for (let j = 0; j < colCount; j++) {
                        const selectedCellIndex = i * colCount + j;
                        if (selectedCellIndex < this.selectedCells.length) {
                            const { row, col } = this.selectedCells[selectedCellIndex];
                            const newValue = pastedRows[i][j];
                            const colheader = this.dataManager.headers[col];

                            if (row < this.dataManager.parsedData.length && col < this.dataManager.headers.length) {
                                this.dataManager.parsedData[row][colheader] = newValue;

                                try {
                                    const response = await fetch(
                                        `http://localhost:5213/api/users/data/${row + 1}/${colheader}`,
                                        {
                                            method: "PUT",
                                            headers: {
                                                "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                                Value: newValue,
                                            }),
                                        }
                                    );

                                    if (!response.ok) {
                                        throw new Error(`Error: ${response.statusText}`);
                                    }

                                    const data = await response.json();
                                    console.log(`Updated cell at row=${row}, col=${col} with value=${newValue}`);
                                } catch (error) {
                                    console.error('Error updating cell:', error);
                                }
                            }
                        }
                    }
                }
                
                this.uiManager.
                console.log("Pasted cells from clipboard");
            }
        }
    }

    copySelectedCells() {
        if (this.selectedCells.length > 0) {
            this.copiedCells = this.selectedCells.map(({ row, col }) => {
                const header = this.dataManager.headers[col];
                console.log(`Determined cell: row=${row}, col=${col}, header=${header}`);
                return this.dataManager.parsedData[row][header];
            });
            console.log("Copied cells:", this.copiedCells);
        }
    }

    async pasteCells() {
        if (this.copiedCells && this.selectedCells.length > 0) {
            if (this.copiedCells.length !== this.selectedCells.length) {
                console.error('Error: Number of copied cells does not match number of selected cells');
                return;
            }

            for (let i = 0; i < this.copiedCells.length; i++) {
                const { row, col } = this.selectedCells[i];
                if (row < this.dataManager.parsedData.length && col < this.dataManager.headers.length) {
                    const newValue = this.copiedCells[i];
                    const colheader = this.dataManager.headers[col];
                    this.dataManager.parsedData[row][colheader] = newValue;

                    try {
                        const response = await fetch(
                            `http://localhost:5213/api/users/data/${row + 1}/${colheader}`,
                            {
                                method: "PUT",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    Value: newValue,
                                }),
                            }
                        );

                        if (!response.ok) {
                            throw new Error(`Error: ${response.statusText}`);
                        }

                        const data = await response.json();
                        console.log(`Updated cell at row=${row}, col=${col} with value=${newValue}`);
                    } catch (error) {
                        console.error('Error updating cell:', error);
                    }
                }
            }
            this.uiManager.drawGrid();
            console.log("Pasted cells:", this.copiedCells);
        }
    }

    updateSelectedCells(selectionStart, selectionEnd) {
        if (selectionStart && selectionEnd) {
            const startX = Math.min(selectionStart.col, selectionEnd.col);
            const endX = Math.max(selectionStart.col, selectionEnd.col);
            const startY = Math.min(selectionStart.row, selectionEnd.row);
            const endY = Math.max(selectionStart.row, selectionEnd.row);
            this.selectedCells = [];

            console.log(`UpdateSelectedCells - startX: ${startX}, endX: ${endX}, startY: ${startY}, endY: ${endY}`);

            for (let row = startY; row <= endY; row++) {
                for (let col = startX; col <= endX; col++) {
                    this.selectedCells.push({ row, col });
                }
            }

            console.log(`Selected Cells: ${JSON.stringify(this.selectedCells)}`);
        }
    }

    clearSelectedCells() {
        this.selectedCells = [];
    }
}