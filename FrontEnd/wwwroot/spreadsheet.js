import DataManager from './data.js';
import UIManager from './UI.js';
import CellManager from './cell.js';

export default class Spreadsheet {
  constructor() {
    this.uiManager = new UIManager(null, null); 
    this.cellManager = new CellManager(null, this.uiManager); 
    this.dataManager = new DataManager(this.uiManager, this.cellManager);
    this.uiManager.dataManager = this.dataManager; 
    this.uiManager.cellManager = this.cellManager; 
    this.cellManager.dataManager = this.dataManager;
  }

  initialize() {
    this.uiManager.setupEventListeners();
    this.uiManager.setupInfiniteScroll();
    this.uiManager.setupSearch(); 

    this.uiManager.resizeCanvas();
    this.dataManager.fetchAndRenderData().then(() => {
      this.uiManager.populateSearchColumns();

      this.uiManager.drawGrid();
    });
    this.uiManager.drawGrid();
    
  }
}
