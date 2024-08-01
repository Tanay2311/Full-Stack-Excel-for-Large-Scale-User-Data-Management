export default class UIManager {
  constructor(dataManager, cellManager) {
    this.dataManager = dataManager;
    this.cellManager = cellManager;
    this.canvas = document.getElementById("spreadsheet-canvas");
    this.context = this.canvas.getContext("2d");
    this.cellHeight = 30;
    this.resizeThreshold = 5;
    this.resizeState = {
      isResizing: false,
      type: "",
      index: -1,
      startX: 0,
      startY: 0,
    };
    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.translatedX = 0; 

    this.bindMethods();
  }

  bindMethods() {
    this.drawGrid = this.drawGrid.bind(this);
    this.resizeCanvas = this.resizeCanvas.bind(this);
    this.updateFooter = this.updateFooter.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.setupInfiniteScroll = this.setupInfiniteScroll.bind(this);
    this.setupCellEditing = this.setupCellEditing.bind(this);
    this.populateSearchColumns = this.populateSearchColumns.bind(this);
    this.setupSearch = this.setupSearch.bind(this);
    this.displaySearchResults = this.displaySearchResults.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this); 
  }

  setupEventListeners() {
    window.addEventListener("resize", this.resizeCanvas);
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("dblclick", this.setupCellEditing);
    window.addEventListener("keydown", this.handleKeyDown); 
  }

  handleKeyDown(event) {
    const scrollAmount = 100;
    const minTranslatedX = 0;

    if (event.key === "ArrowLeft") {
      this.translatedX = Math.max(
        minTranslatedX,
        this.translatedX - scrollAmount
      );
      this.drawGrid();
    } else if (event.key === "ArrowRight") {
      this.translatedX += scrollAmount;
      this.drawGrid();
    }
  }


  drawGrid() {
    console.log("Drawing grid");
    const { parsedData, headers, cellWidths, rowHeights } = this.dataManager;
    const selectedCells = this.cellManager.selectedCells;
  
    if (!parsedData || parsedData.length === 0) {
      console.log("No data to draw");
      return;
    }
  
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
    const totalColumns = 520;
  
    // Headers
    let x = cellWidths[0] - this.translatedX;
    for (let i = 0; i < totalColumns; i++) {
      const columnWidth = cellWidths[i + 1] || 100;
      this.context.fillStyle = "#f0f0f0";
      this.context.fillRect(x, 0, columnWidth, this.cellHeight);
      this.context.strokeRect(x, 0, columnWidth, this.cellHeight);
      this.context.fillStyle = "black";
  
      const columnHeader = this.generateColumnHeader(i);
      this.context.fillText(columnHeader, x + 5, 20);

      x += columnWidth;
    }
  
    x = cellWidths[0] - this.translatedX;
    headers.forEach((header, index) => {
      const columnWidth = cellWidths[index + 1] || 100;
      this.context.fillStyle = "#f0f0f0";
      this.context.fillRect(x, this.cellHeight, columnWidth, this.cellHeight);
      this.context.strokeRect(x, this.cellHeight, columnWidth, this.cellHeight);
      this.context.fillStyle = "black";
      this.context.fillText(header, x + 5, this.cellHeight + 20);
      x += columnWidth;
    });
  
    for (let i = headers.length; i < totalColumns; i++) {
      const columnWidth = 100;
      this.context.fillStyle = "#f0f0f0";
      this.context.fillRect(x, this.cellHeight, columnWidth, this.cellHeight);
      this.context.strokeRect(x, this.cellHeight, columnWidth, this.cellHeight);
      x += columnWidth;
    }
  
    // Grid lines
    this.context.strokeStyle = "#ddd";
    this.context.lineWidth = 1;
  
    // Horizontal lines
    let y = this.cellHeight * 2;
    for (let i = 0; i <= parsedData.length; i++) {
      this.context.beginPath();
      this.context.moveTo(0, y + 0.5);
      this.context.lineTo(this.canvas.width, y + 0.5);
      this.context.stroke();
      y += rowHeights[i] || this.cellHeight;
    }
  
    // Vertical lines
    let currentX = -this.translatedX;
    for (let i = 0; i <= totalColumns; i++) {
      this.context.beginPath();
      this.context.moveTo(currentX + 0.5, 0);
      this.context.lineTo(currentX + 0.5, this.canvas.height);
      this.context.stroke();
      if (i < cellWidths.length) {
        currentX += cellWidths[i] || 100;
      } else {
        currentX += 100;
      }
    }
  
    // Cell content
    y = this.cellHeight * 2;
    for (let i = 0; i < parsedData.length; i++) {
      this.context.fillStyle = "#f0f0f0";
      this.context.beginPath();
      this.context.moveTo(0, y);
      this.context.lineTo(0, y, cellWidths[0], rowHeights[i]);
      this.context.stroke();
      this.context.fillStyle = "black";
      this.context.fillText((i + 1).toString(), 5, y + rowHeights[i] / 2);
  
      const row = parsedData[i];
      x = cellWidths[0] - this.translatedX;
  
      headers.forEach((header, colIndex) => {
        const cell = row[header];
        const cellText = cell ? cell.toString() : "";
  
        const textWidth = this.context.measureText(cellText).width;
        const columnWidth = cellWidths[colIndex + 1];
  
        // Clipping
        this.context.save();
        this.context.beginPath();
        this.context.rect(x, y, columnWidth, rowHeights[i]);
        this.context.clip();
  
        this.context.fillText(cellText, x + 5, y + rowHeights[i] / 2);
  
        this.context.restore();
  
        x += cellWidths[colIndex + 1];
      });
  
      y += rowHeights[i];
    }
  
    // Selection
    if (selectedCells.length > 0) {
      const minCol = Math.min(...selectedCells.map(cell => cell.col));
      const maxCol = Math.max(...selectedCells.map(cell => cell.col));
      const minRow = Math.min(...selectedCells.map(cell => cell.row));
      const maxRow = Math.max(...selectedCells.map(cell => cell.row));
    
      this.context.strokeStyle = "rgba(0, 85, 0, 0.8)";
      this.context.lineWidth = 1.5;
    
      // Draw selection border
      let x1 = cellWidths.slice(0, minCol + 1).reduce((a, b) => a + b, 0) - this.translatedX;
      let y1 = this.cellHeight * 2 + rowHeights.slice(0, minRow).reduce((a, b) => a + b, 0);
      let x2 = cellWidths.slice(0, maxCol + 2).reduce((a, b) => a + b, 0) - this.translatedX;
      let y2 = this.cellHeight * 2 + rowHeights.slice(0, maxRow + 1).reduce((a, b) => a + b, 0);
    
      this.context.strokeRect(x1, y1, x2 - x1, y2 - y1);
    
      // Highlight selected cells
      this.context.fillStyle = "rgba(211, 211, 211, 0.5)";
      for (let i = minRow; i <= maxRow; i++) {
        let rowY = this.cellHeight * 2 + rowHeights.slice(0, i).reduce((a, b) => a + b, 0);
        for (let j = minCol; j <= maxCol; j++) {
          let colX = cellWidths.slice(0, j + 1).reduce((a, b) => a + b, 0) - this.translatedX;
          let cellWidth = cellWidths[j + 1];
          let cellHeight = rowHeights[i];
          this.context.fillRect(colX, rowY, cellWidth, cellHeight);
        }
      }
    
      // Highlight row and column headers
      this.context.fillStyle = "rgba(0, 128, 0, 0.3)"; // Light green color
    
      // Highlight column headers
      for (let j = minCol; j <= maxCol; j++) {
        let colX = cellWidths.slice(0, j + 1).reduce((a, b) => a + b, 0) - this.translatedX;
        let cellWidth = cellWidths[j + 1];
        this.context.fillRect(colX, 0, cellWidth, this.cellHeight * 2);
      }
    
      // Highlight row headers
      let rowHeaderWidth = cellWidths[0];
      for (let i = minRow; i <= maxRow; i++) {
        let rowY = this.cellHeight * 2 + rowHeights.slice(0, i).reduce((a, b) => a + b, 0);
        let cellHeight = rowHeights[i];
        this.context.fillRect(0, rowY, rowHeaderWidth, cellHeight);
      }
    }
    
    this.updateFooter();  
  }

  generateColumnHeader(index) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let header = "";
    if (index >= 26) {
      header += alphabet[Math.floor(index / 26) - 1];
    }
    header += alphabet[index % 26];
    return header;
  }

  resizeCanvas() {
    const { parsedData } = this.dataManager;
    this.canvas.width = window.innerWidth;
    this.canvas.height = Math.max(
      window.innerHeight,
      parsedData.length * this.cellHeight + this.cellHeight * 2
    );
    this.drawGrid();
  }

  updateFooter() {
    const { parsedData, headers } = this.dataManager;
    const { selectedCells } = this.cellManager;
    const sumElement = document.getElementById("sum");
    const countElement = document.getElementById("count");
    const averageElement = document.getElementById("average");
    const minElement = document.getElementById("min");
    const maxElement = document.getElementById("max");

    if (selectedCells.length === 0) {
      sumElement.textContent = "";
      countElement.textContent = "";
      averageElement.textContent = "";
      minElement.textContent = "";
      maxElement.textContent = "";
      return;
    }

    const values = selectedCells
      .map(({ row, col }) => {
        const cellValue = parsedData[row][headers[col]];
        return parseFloat(cellValue);
      })
      .filter((value) => !isNaN(value));

    if (values.length === 0) {
      sumElement.textContent = "";
      countElement.textContent = "";
      averageElement.textContent = "";
      minElement.textContent = "";
      maxElement.textContent = "";
      return;
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    const count = values.length;
    const average = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);

    sumElement.textContent = `Sum: ${sum}`;
    countElement.textContent = `Count: ${count}`;
    averageElement.textContent = `Average: ${average}`;
    minElement.textContent = `Min: ${min}`;
    maxElement.textContent = `Max: ${max}`;
  }

  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const columnIndex = this.getColumnIndexAtX(x);
    const rowIndex = this.getRowIndexAtY(y);

    if (columnIndex !== -1) {
      this.resizeState = {
        isResizing: true,
        type: "column",
        index: columnIndex,
        startX: event.clientX,
      };
    } else if (rowIndex !== -1) {
      this.resizeState = {
        isResizing: true,
        type: "row",
        index: rowIndex,
        startY: event.clientY,
      };
    } else {
      this.isSelecting = true;
      this.selectionStart = this.getCellFromCoordinates(x, y);
      this.selectionEnd = this.selectionStart;
      this.cellManager.clearSelectedCells();
    }
  }

  handleMouseMove(event) {
    const { cellWidths, rowHeights } = this.dataManager;
    if (this.isSelecting) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.selectionEnd = this.getCellFromCoordinates(x, y);
      console.log(`Mouse Move - x: ${x}, y: ${y}`);
      console.log(
        `Selection End - row: ${this.selectionEnd.row}, col: ${this.selectionEnd.col}`
      );

      this.cellManager.updateSelectedCells(
        this.selectionStart,
        this.selectionEnd
      );
      this.drawGrid();
    }

    if (this.resizeState.isResizing) {
      if (this.resizeState.type === "column") {
        const diff = event.clientX - this.resizeState.startX;
        const newWidth = Math.max(
          50,
          cellWidths[this.resizeState.index] + diff
        );
        cellWidths[this.resizeState.index] = newWidth;
        this.resizeState.startX = event.clientX;
      } else if (this.resizeState.type === "row") {
        const diff = event.clientY - this.resizeState.startY;
        const newHeight = Math.max(
          20,
          rowHeights[this.resizeState.index] + diff
        );
        rowHeights[this.resizeState.index] = newHeight;
        this.resizeState.startY = event.clientY;
      }
      this.drawGrid();
    } else {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (this.getColumnIndexAtX(x) !== -1 || this.getRowIndexAtY(y) !== -1) {
        this.canvas.style.cursor = "col-resize";
      } else {
        this.canvas.style.cursor = "default";
      }
    }
  }

  handleMouseUp(event) {
    if (this.isSelecting) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.selectionEnd = this.getCellFromCoordinates(x, y);
      console.log(`Mouse Up - x: ${x}, y: ${y}`);
      console.log(
        `Final Selection - Start: (${this.selectionStart.row}, ${this.selectionStart.col}), End: (${this.selectionEnd.row}, ${this.selectionEnd.col})`
      );

      this.cellManager.updateSelectedCells(
        this.selectionStart,
        this.selectionEnd
      );
      this.isSelecting = false;
      this.drawGrid();
    }

    this.resizeState.isResizing = false;
  }

  getColumnIndexAtX(x) {
    const { cellWidths } = this.dataManager;
    let currentX = 0;
    for (let i = 0; i < cellWidths.length; i++) {
      currentX += cellWidths[i];
      if (Math.abs(currentX - x) <= this.resizeThreshold) {
        return i;
      }
    }
    return -1;
  }

  getRowIndexAtY(y) {
    const { rowHeights } = this.dataManager;
    let currentY = this.cellHeight * 2;
    for (let i = 0; i < rowHeights.length; i++) {
      currentY += rowHeights[i];
      if (Math.abs(currentY - y) <= this.resizeThreshold) {
        return i;
      }
    }
    return -1;
  }

  getCellFromCoordinates(x, y) {
    const { cellWidths, rowHeights, headers } = this.dataManager;
    let colX = cellWidths[0];
    let rowY = this.cellHeight * 2;
    let col = -1;
    let row = -1;

    for (let i = 0; i < headers.length; i++) {
      if (x >= colX && x < colX + cellWidths[i + 1]) {
        col = i;
        break;
      }
      colX += cellWidths[i + 1];
    }

    for (let i = 0; i < rowHeights.length; i++) {
      if (y >= rowY && y < rowY + rowHeights[i]) {
        row = i;
        break;
      }
      rowY += rowHeights[i];
    }

    return { row, col };
  }

  setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.dataManager.isLoading) {
          this.dataManager.startRow = this.dataManager.endRow;
          this.dataManager.endRow += 100;
          this.dataManager.fetchAndRenderData().then(() => {
            this.drawGrid();
            this.updateLoadMorePosition();
          });
        }
      });
    });

    const loadMoreDiv = document.createElement("div");
    loadMoreDiv.id = "load-more";
    loadMoreDiv.style.height = "20px";
    loadMoreDiv.style.width = "100%";
    this.canvas.parentNode.appendChild(loadMoreDiv);

    observer.observe(loadMoreDiv);

    this.resizeCanvas();
    this.dataManager.fetchAndRenderData().then(() => {
      this.drawGrid();
      this.updateLoadMorePosition();
    });
  }

  updateLoadMorePosition() {
    const loadMoreDiv = document.getElementById("load-more");
    const canvasHeight = this.canvas.height;
    loadMoreDiv.style.top = `${canvasHeight}px`;
  }

  setupCellEditing() {
    this.canvas.addEventListener("dblclick", (event) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left + this.translatedX; // Adjust for horizontal scroll
        const y = event.clientY - rect.top;

        // Find the correct column
        let currentX = this.dataManager.cellWidths[0]; // Start after row header
        let colIndex = -1;
        for (let i = 1; i < this.dataManager.cellWidths.length; i++) {
            if (x >= currentX && x < currentX + this.dataManager.cellWidths[i]) {
                colIndex = i;
                break;
            }
            currentX += this.dataManager.cellWidths[i];
        }

        // Find the correct row
        let currentY = this.dataManager.cellHeight * 2; // Start after header rows
        let rowIndex = -1;
        for (let i = 0; i < this.dataManager.rowHeights.length; i++) {
            if (y >= currentY && y < currentY + this.dataManager.rowHeights[i]) {
                rowIndex = i;
                break;
            }
            currentY += this.dataManager.rowHeights[i];
        }

        if (
            rowIndex >= 0 &&
            rowIndex < this.dataManager.parsedData.length &&
            colIndex > 0
        ) {
            const headers = Object.keys(this.dataManager.parsedData[0] || {});
            const cell = headers[colIndex - 1]; 
            const selectedCell = this.dataManager.parsedData[rowIndex][cell];

            const input = document.createElement("input");
            input.type = "text";
            input.value = selectedCell;
            input.style.position = "absolute";
            input.style.left = `${rect.left + currentX - this.translatedX}px`; // Adjust for horizontal scroll
            input.style.top = `${rect.top + currentY}px`;
            input.style.width = `${this.dataManager.cellWidths[colIndex]}px`;
            input.style.height = `${this.dataManager.rowHeights[rowIndex]}px`;
            input.style.fontSize = "16px";
            input.style.border = "1px solid black";
            input.style.backgroundColor = "white";
            input.style.padding = "0";
            input.style.margin = "0";
            input.style.boxSizing = "border-box";

            input.addEventListener("keydown", async (e) => {
                if (e.key === "Enter") {
                    e.preventDefault(); 
                    const newValue = input.value;
                    console.log(
                        `Attempting to update row ${
                            rowIndex + 1
                        }, column ${cell} with value: ${newValue}`
                    );

                    try {
                        const response = await fetch(
                            `http://localhost:5213/api/users/data/${rowIndex + 1}/${cell}`,
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

                        console.log("Response status:", response.status);
                        const result = await response.json();
                        console.log("Parsed result:", result);

                        if (result.success) {
                            console.log("Cell updated successfully");
                            this.dataManager.parsedData[rowIndex][cell] = newValue;
                            this.drawGrid(); // Redraw the grid to show the updated value
                        } else {
                            console.log("Failed to update cell:", result.message);
                            alert(result.message || "Failed to update cell");
                        }
                    } catch (error) {
                        console.error("Update error:", error);
                        alert("An error occurred while updating the cell");
                    }

                    document.body.removeChild(input); // Remove the input after update attempt
                }
            });

            // Keep the blur event to handle clicks outside the input
            input.addEventListener("blur", () => {
                document.body.removeChild(input);
            });

            document.body.appendChild(input);
            input.focus();
        }
    });
}

  populateSearchColumns() {
    const searchColumn = document.getElementById("search-column");

    searchColumn.innerHTML = "";
    this.dataManager.headers.forEach((header) => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      searchColumn.appendChild(option);
    });
  }

  setupSearch() {
    const searchToggle = document.getElementById("search-toggle");
    const searchInput = document.getElementById("search-input");
    const searchColumn = document.getElementById("search-column");
    let originalData = null;

    searchToggle.addEventListener("change", async () => {
      if (searchToggle.checked) {
        // Toggle is ON - perform search
        const searchValue = searchInput.value.trim();
        const columnValue = searchColumn.value;

        if (!columnValue) {
          alert("Please choose a column to search in.");
          searchToggle.checked = false;
          return;
        }

        if (!searchValue) {
          alert("Please enter a search term.");
          searchToggle.checked = false;
          return;
        }

        console.log("Searching for:", columnValue, searchValue);
        const searchResults = await this.dataManager.search(
          columnValue,
          searchValue
        );
        console.log("Search results:", searchResults);

        if (searchResults.length === 0) {
          alert("No results found.");
          searchToggle.checked = false;
          return;
        }

        this.displaySearchResults(searchResults);
      } else {
        // Toggle is OFF - display all data
        console.log("Resetting to full data view");

        if (originalData === null) {
          // Fetch and store the original data
          originalData = this.dataManager.fetchAndRenderData();
        }

        // Display the original data
        this.displaySearchResults(originalData);
      }
    });
  }

  displaySearchResults(results) {
    if (results.length === 0) {
      alert("No results found.");
      document.getElementById("search-toggle").checked = false;
    } else {
      this.dataManager.parsedData = results;
      this.drawGrid();
    }
  }
}
