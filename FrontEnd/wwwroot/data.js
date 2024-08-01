export default class DataManager {
    constructor(uiManager,cellManager) {
        this.cellManager = cellManager;
        this.uiManager = uiManager;
        this.parsedData = [];
        this.totalRows = 0;
        this.startRow = 0;
        this.endRow = 100;
        this.isLoading = false;
        this.headers = [];
        this.cellWidths = [];
        this.rowHeights = [];
        this.cellHeight = 30; 

        this.fetchAndRenderData = this.fetchAndRenderData.bind(this);
        this.findAndReplace = this.findAndReplace.bind(this);
        this.promptColumnSelection = this.promptColumnSelection.bind(this);

        document.getElementById("find-replace").addEventListener("click", () => {
            const findValue = prompt("Enter the value to find:");
            const replaceValue = prompt("Enter the value to replace with:");
            if (findValue !== null && replaceValue !== null) {
                this.findAndReplace(findValue, replaceValue);
            }
        });
    }

    async fetchAndRenderData() {
        console.log("Fetch data from", this.startRow, "to", this.endRow);
        this.isLoading = true;
        try {
            const response = await fetch(
                `http://localhost:5213/api/users/fetch?startRow=${this.startRow}&endRow=${this.endRow}`
            );
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            const result = await response.json();

            console.log("Raw API response:", result);
            if (result.data && Array.isArray(result.data)) {
                this.parsedData = this.parsedData.concat(result.data);

                console.log(this.parsedData);
                this.totalRows = result.total || 0;
                console.log(
                    `Fetched ${result.data.length} rows, total parsed: ${this.parsedData.length} out of ${this.totalRows} total rows`
                );
                if (!this.headers.length) {
                    this.headers = Object.keys(this.parsedData[0] || {});
                    this.cellWidths = [100, ...this.headers.map(() => 90)];
                    this.rowHeights = new Array(this.parsedData.length).fill(this.cellHeight);
                } else {
                    this.rowHeights = new Array(this.parsedData.length).fill(this.cellHeight);
                }
                
                this.uiManager.resizeCanvas();
                this.uiManager.drawGrid();

                
            } else {
                console.error("Unexpected data format received from API");
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            this.isLoading = false;
        }
    }

    async findAndReplace(findValue, replaceValue) {
        try {
            const headers = this.parsedData.length > 0 ? Object.keys(this.parsedData[0]) : [];

            const column = await this.promptColumnSelection(headers);
            if (!column) {
                alert("Column name selection canceled.");
                return;
            }

            const response = await fetch("http://localhost:5213/api/users/find_replace", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    column,
                    oldValue: findValue,
                    newValue: replaceValue,
                }),
            });

            const result = await response.json();
            if (result.success) {
                alert(`Values updated successfully. Rows affected: ${result.rowsAffected}`);
                this.parsedData = [];
                this.startRow = 0;
                this.endRow = 100;
                await this.fetchAndRenderData();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error("Error during find and replace:", error);
            alert("An error occurred during the find and replace operation.");
        }
    }

    promptColumnSelection(headers) {
        return new Promise((resolve) => {
            const columnSelect = document.createElement("select");
            columnSelect.style.marginRight = "10px";

            headers.forEach((header) => {
                const option = document.createElement("option");
                option.value = header;
                option.textContent = header;
                columnSelect.appendChild(option);
            });

            const columnSelectionDialog = document.createElement("div");
            columnSelectionDialog.appendChild(document.createTextNode("Select Column:"));
            columnSelectionDialog.appendChild(columnSelect);

            const okButton = document.createElement("button");
            okButton.textContent = "OK";
            okButton.addEventListener("click", () => {
                document.body.removeChild(columnSelectionDialog);
                resolve(columnSelect.value);
            });

            const cancelButton = document.createElement("button");
            cancelButton.textContent = "Cancel";
            cancelButton.addEventListener("click", () => {
                document.body.removeChild(columnSelectionDialog);
                resolve(null);
            });

            columnSelectionDialog.appendChild(okButton);
            columnSelectionDialog.appendChild(cancelButton);

            columnSelectionDialog.style.position = "fixed";
            columnSelectionDialog.style.top = "50%";
            columnSelectionDialog.style.left = "50%";
            columnSelectionDialog.style.transform = "translate(-50%, -50%)";
            columnSelectionDialog.style.backgroundColor = "white";
            columnSelectionDialog.style.padding = "20px";
            columnSelectionDialog.style.border = "1px solid #ccc";
            columnSelectionDialog.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";

            document.body.appendChild(columnSelectionDialog);
        });
    }

    async search(header, data) {
        console.log("Searching:", header, data);
        try {
            const url = `http://localhost:5213/api/users/search/${header}/${data}`;
            console.log("Fetch URL:", url);
            const response = await fetch(url);
            console.log("Response status:", response.status);
                
            
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            const result = await response.json();

            if (result.data && Array.isArray(result.data)) {
                this.parsedData = result.data;
                this.totalRows = result.total || 0;
                this.uiManager.resizeCanvas();
                this.uiManager.drawGrid();
                return this.parsedData;
            } else {
                console.error("Unexpected data format received from API");
                return [];
            }
        } catch (error) {
            console.error("Fetch error:", error);
            if (error instanceof Response) {
                const text = await error.text();
                console.error("Response text:", text);
            }
            return [];
        }
    }

}




